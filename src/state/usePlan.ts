/**
 * The single owner of application state — and the persistence seam.
 *
 * Everything outside this file takes a `Plan` object and does not care where
 * it came from. There are two modes, fixed for the lifetime of the hook:
 *
 * - **Local mode** (no signed-in user): exactly the pre-accounts behavior.
 *   One plan in `sovereign.plan.v2`, snapshots beside it, v1 migration on
 *   first load. Nothing leaves the browser.
 *
 * - **Account mode** (Clerk user passed in): plans live on the server, with
 *   a per-user localStorage cache in front so the app renders instantly and
 *   keeps working offline. Every mutation lands in the cache first, then an
 *   idempotent operation queue replays it against the API; last write wins
 *   per plan. The queue survives reloads.
 *
 * History is coalesced by key rather than recorded per change. v1 pushed a
 * snapshot on every keystroke, so typing a five-digit number consumed five of
 * the fifty available undo slots and "undo" moved the cursor one character.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PLAN_SCHEMA_VERSION,
  archiveLegacyState,
  createDefaultPlan,
  migrateLegacyState,
  readLegacyState,
  type Plan,
} from '../engine';
import { ApiError, ApiOffline, createApiClient, type GetToken } from './apiClient';

const PLAN_KEY = 'sovereign.plan.v2';
const SNAPSHOT_KEY = 'sovereign.snapshots.v2';
const NOTES_KEY = 'sovereign.migration-notes.v2';

const accountKey = (userId: string) => `sovereign.account.v3.${userId}`;

/** Consecutive edits sharing a key inside this window collapse into one undo step. */
const HISTORY_COALESCE_MS = 700;
const HISTORY_LIMIT = 100;
const PERSIST_DEBOUNCE_MS = 400;
const FLUSH_DEBOUNCE_MS = 1000;
const FLUSH_RETRY_MS = 30_000;

export interface AuthContext {
  userId: string;
  getToken: GetToken;
}

export interface PlanSnapshot {
  id: string;
  name: string;
  createdAt: number;
  plan: Plan;
}

export interface PlanListEntry {
  id: string;
  name: string;
  /** Local wall-clock of the copy this device holds. */
  updatedAt: number;
}

export type SyncState = 'local' | 'syncing' | 'synced' | 'offline' | 'error';

export interface UpdateOptions {
  /**
   * Edits sharing a key within the coalesce window become a single undo step.
   * Pass something stable and specific, e.g. `name:${nodeId}`. Omit the key for
   * discrete structural actions (adding a node, deleting an edge) so each gets
   * its own undo entry.
   */
  historyKey?: string;
  /** Skip history entirely. For transient state that should not be undoable. */
  skipHistory?: boolean;
}

const clone = <T,>(value: T): T =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);

// ---------------------------------------------------------------------------
// Account-mode store (the localStorage cache + operation queue)
// ---------------------------------------------------------------------------

interface StoredPlan {
  plan: Plan;
  /** Server's updated_at for the version this copy is based on, if any. */
  serverUpdatedAt: string | null;
  /** Has this plan ever been confirmed present on the server? */
  synced: boolean;
  /** Local wall-clock of the last edit on this device. */
  touchedAt: number;
}

interface StoredSnapshot extends PlanSnapshot {
  planId: string;
  synced: boolean;
}

type SyncOp =
  | { t: 'putPlan'; id: string }
  | { t: 'delPlan'; id: string }
  | { t: 'putSnap'; id: string; retries?: number }
  | { t: 'delSnap'; id: string };

interface AccountStore {
  activePlanId: string | null;
  plans: Record<string, StoredPlan>;
  snapshots: Record<string, StoredSnapshot>;
  queue: SyncOp[];
  importFlag?: 'imported' | 'declined';
  notes?: string[];
}

function emptyStore(): AccountStore {
  return { activePlanId: null, plans: {}, snapshots: {}, queue: [] };
}

function readAccountStore(key: string): AccountStore {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as AccountStore;
    if (!parsed || typeof parsed.plans !== 'object') return emptyStore();
    return {
      activePlanId: parsed.activePlanId ?? null,
      plans: parsed.plans ?? {},
      snapshots: parsed.snapshots ?? {},
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
      importFlag: parsed.importFlag,
      notes: parsed.notes,
    };
  } catch {
    return emptyStore();
  }
}

function enqueue(store: AccountStore, op: SyncOp) {
  if (op.t === 'delPlan') {
    // A deleted plan's pending writes (its own and its snapshots') are moot.
    const snapIds = new Set(
      Object.values(store.snapshots)
        .filter((s) => s.planId === op.id)
        .map((s) => s.id),
    );
    store.queue = store.queue.filter(
      (q) =>
        !((q.t === 'putPlan' || q.t === 'delPlan') && q.id === op.id) &&
        !(q.t === 'putSnap' && snapIds.has(q.id)),
    );
    store.queue.push(op);
    return;
  }
  if (op.t === 'delSnap') {
    store.queue = store.queue.filter((q) => !(q.t === 'putSnap' && q.id === op.id));
  }
  if (!store.queue.some((q) => q.t === op.t && q.id === op.id)) {
    store.queue.push(op);
  }
}

function snapshotsForPlan(store: AccountStore, planId: string): PlanSnapshot[] {
  return Object.values(store.snapshots)
    .filter((s) => s.planId === planId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(({ id, name, createdAt, plan }) => ({ id, name, createdAt, plan }));
}

/** Is there pre-account data in this browser worth offering to import? */
function legacyLocalDataExists(): boolean {
  try {
    if (window.localStorage.getItem(PLAN_KEY)) return true;
    const legacy = readLegacyState(window.localStorage);
    return migrateLegacyState(legacy).migrated;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Initial load
// ---------------------------------------------------------------------------

interface LoadResult {
  plan: Plan;
  migrationNotes: string[];
  snapshots: PlanSnapshot[];
  store: AccountStore | null;
  /** Set when account mode had to invent a default plan (empty cache). */
  autoCreatedId: string | null;
}

function loadInitialLocal(): LoadResult {
  const base = { snapshots: loadLocalSnapshots(), store: null, autoCreatedId: null };

  // 1. An existing v2 plan always wins.
  try {
    const raw = window.localStorage.getItem(PLAN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Plan;
      if (parsed && Array.isArray(parsed.nodes)) {
        const notesRaw = window.localStorage.getItem(NOTES_KEY);
        return {
          ...base,
          plan: { ...parsed, version: PLAN_SCHEMA_VERSION },
          migrationNotes: notesRaw ? (JSON.parse(notesRaw) as string[]) : [],
        };
      }
    }
  } catch (error) {
    console.error('[sovereign] Saved plan could not be read; falling back.', error);
  }

  // 2. Otherwise try to bring a v1 save forward.
  try {
    const legacy = readLegacyState(window.localStorage);
    const { plan, notes, migrated } = migrateLegacyState(legacy);

    if (migrated) {
      window.localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
      window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
      // Keep the old keys under a backup prefix rather than destroying them.
      archiveLegacyState(window.localStorage);
      return { ...base, plan, migrationNotes: notes };
    }
  } catch (error) {
    console.error('[sovereign] Migration from the previous version failed.', error);
  }

  // 3. Fresh start.
  return { ...base, plan: createDefaultPlan(), migrationNotes: [] };
}

function loadLocalSnapshots(): PlanSnapshot[] {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as PlanSnapshot[]) : [];
  } catch {
    return [];
  }
}

function loadInitialAccount(storeKey: string): LoadResult {
  const store = readAccountStore(storeKey);

  const active = store.activePlanId ? store.plans[store.activePlanId] : undefined;
  if (active) {
    return {
      plan: clone(active.plan),
      migrationNotes: store.notes ?? [],
      snapshots: snapshotsForPlan(store, active.plan.id),
      store,
      autoCreatedId: null,
    };
  }

  // Fall back to any cached plan before inventing a new one.
  const first = Object.values(store.plans).sort((a, b) => b.touchedAt - a.touchedAt)[0];
  if (first) {
    store.activePlanId = first.plan.id;
    return {
      plan: clone(first.plan),
      migrationNotes: store.notes ?? [],
      snapshots: snapshotsForPlan(store, first.plan.id),
      store,
      autoCreatedId: null,
    };
  }

  // Nothing cached: start with a default plan. The reconcile pass may replace
  // it with the account's real plans, and drops it if it was never edited.
  const plan = createDefaultPlan();
  store.activePlanId = plan.id;
  return { plan, migrationNotes: [], snapshots: [], store, autoCreatedId: plan.id };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePlan(auth: AuthContext | null = null) {
  // The mode is fixed for the lifetime of the component that calls this hook:
  // the app remounts the workspace when the signed-in user changes.
  const storeKey = auth ? accountKey(auth.userId) : null;

  const getTokenRef = useRef<GetToken | null>(auth?.getToken ?? null);
  getTokenRef.current = auth?.getToken ?? null;
  const api = useMemo(
    () => (auth ? createApiClient(() => getTokenRef.current!()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auth?.userId],
  );

  const initial = useMemo(
    () => (storeKey ? loadInitialAccount(storeKey) : loadInitialLocal()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [plan, setPlan] = useState<Plan>(initial.plan);
  const [migrationNotes, setMigrationNotes] = useState<string[]>(initial.migrationNotes);
  const [snapshots, setSnapshots] = useState<PlanSnapshot[]>(initial.snapshots);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [syncState, setSyncState] = useState<SyncState>(auth ? 'syncing' : 'local');
  const [importOfferOpen, setImportOfferOpen] = useState(false);
  const [planListTick, setPlanListTick] = useState(0);

  const storeRef = useRef<AccountStore | null>(initial.store);
  const autoCreatedRef = useRef<string | null>(initial.autoCreatedId);
  const editedRef = useRef(false);
  const flushingRef = useRef(false);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Suppresses the persist effect when the plan state was set FROM the store. */
  const adoptingRef = useRef(0);

  const past = useRef<Plan[]>([]);
  const future = useRef<Plan[]>([]);
  const lastHistory = useRef<{ key: string; at: number } | null>(null);
  // Forces a re-render when only the history refs changed.
  const [historyTick, setHistoryTick] = useState(0);

  const resetHistory = useCallback(() => {
    past.current = [];
    future.current = [];
    lastHistory.current = null;
    setHistoryTick((t) => t + 1);
  }, []);

  // ---- Cache persistence -------------------------------------------------
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const writeStoreNow = useCallback(() => {
    const store = storeRef.current;
    if (!store || !storeKey) return;
    try {
      window.localStorage.setItem(storeKey, JSON.stringify(store));
    } catch (error) {
      console.error('[sovereign] Could not save the account cache.', error);
    }
  }, [storeKey]);

  const scheduleSave = useCallback(
    (write: () => void) => {
      setSaveState('saving');
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        try {
          write();
          setSaveState('saved');
          // Clear the badge after a moment so it reads as an event, not a status.
          setTimeout(() => setSaveState('idle'), 1500);
        } catch (error) {
          console.error('[sovereign] Could not save. Storage may be full.', error);
          setSaveState('idle');
        }
      }, PERSIST_DEBOUNCE_MS);
    },
    [],
  );

  // ---- Sync engine (account mode only) ------------------------------------
  const flush = useCallback(async () => {
    const store = storeRef.current;
    if (!api || !store || flushingRef.current) return;
    if (store.queue.length === 0) {
      setSyncState('synced');
      return;
    }

    flushingRef.current = true;
    setSyncState('syncing');
    try {
      while (store.queue.length > 0) {
        const op = store.queue[0];
        try {
          if (op.t === 'putPlan') {
            const entry = store.plans[op.id];
            if (entry) {
              const result = await api.putPlan(entry.plan);
              entry.serverUpdatedAt = result.updatedAt;
              entry.synced = true;
            }
          } else if (op.t === 'delPlan') {
            await api.deletePlan(op.id);
          } else if (op.t === 'putSnap') {
            const snap = store.snapshots[op.id];
            if (snap) {
              await api.putSnapshot({
                id: snap.id,
                planId: snap.planId,
                name: snap.name,
                data: snap.plan,
                createdAt: snap.createdAt,
              });
              snap.synced = true;
            }
          } else {
            await api.deleteSnapshot(op.id);
          }
          store.queue.shift();
        } catch (error) {
          if (error instanceof ApiError) {
            if (op.t === 'putSnap' && error.status === 409 && (op.retries ?? 0) < 3) {
              // Parent plan not on the server yet; let its putPlan go first.
              store.queue.shift();
              store.queue.push({ ...op, retries: (op.retries ?? 0) + 1 });
              continue;
            }
            if (error.status === 400 || error.status === 404 || error.status === 413) {
              // A poison op would wedge the queue forever; drop it and say so.
              console.error('[sovereign] Sync operation rejected and dropped.', op, error.message);
              store.queue.shift();
              continue;
            }
          }
          throw error;
        }
      }
      setSyncState('synced');
    } catch (error) {
      setSyncState(error instanceof ApiOffline ? 'offline' : 'error');
      if (!(error instanceof ApiOffline)) {
        console.error('[sovereign] Sync failed; will retry.', error);
      }
    } finally {
      flushingRef.current = false;
      writeStoreNow();
    }
  }, [api, writeStoreNow]);

  const scheduleFlush = useCallback(() => {
    if (!api) return;
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => void flush(), FLUSH_DEBOUNCE_MS);
  }, [api, flush]);

  // Retry when the connection returns, and periodically while work is queued.
  useEffect(() => {
    if (!api) return;
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    const interval = setInterval(() => {
      if ((storeRef.current?.queue.length ?? 0) > 0) void flush();
    }, FLUSH_RETRY_MS);
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(interval);
    };
  }, [api, flush]);

  // ---- Server reconcile on mount (account mode only) -----------------------
  useEffect(() => {
    if (!api) return;
    const store = storeRef.current;
    if (!store) return;
    let cancelled = false;

    // The import offer does not need the server: it is about data already in
    // this browser, and must appear even on a first sign-in that is offline.
    if (!store.importFlag && legacyLocalDataExists()) setImportOfferOpen(true);

    (async () => {
      setSyncState('syncing');
      const metas = await api.listPlans();
      if (cancelled) return;

      const serverIds = new Set(metas.map((m) => m.id));
      const pendingPut = new Set(
        store.queue.filter((q) => q.t === 'putPlan').map((q) => q.id),
      );

      for (const meta of metas) {
        const entry = store.plans[meta.id];
        const stale = !entry || (!pendingPut.has(meta.id) && entry.serverUpdatedAt !== meta.updatedAt);
        if (stale) {
          const remote = await api.getPlan(meta.id);
          if (cancelled) return;
          store.plans[meta.id] = {
            plan: { ...remote.data, version: PLAN_SCHEMA_VERSION },
            serverUpdatedAt: remote.updatedAt,
            synced: true,
            touchedAt: Date.parse(remote.updatedAt) || Date.now(),
          };
        }
      }

      for (const id of Object.keys(store.plans)) {
        if (serverIds.has(id)) continue;
        const entry = store.plans[id];
        if (entry.synced && !pendingPut.has(id)) {
          // It was on the server once and is gone now: deleted elsewhere.
          delete store.plans[id];
          for (const snap of Object.values(store.snapshots)) {
            if (snap.planId === id) delete store.snapshots[snap.id];
          }
        } else {
          // Created here (possibly offline) and never uploaded.
          enqueue(store, { t: 'putPlan', id });
        }
      }

      // If the server had real plans, the untouched auto-created default is noise.
      const autoId = autoCreatedRef.current;
      if (autoId && !editedRef.current && serverIds.size > 0 && !serverIds.has(autoId)) {
        delete store.plans[autoId];
        store.queue = store.queue.filter((q) => !(q.t === 'putPlan' && q.id === autoId));
        autoCreatedRef.current = null;
      }

      if (!store.activePlanId || !store.plans[store.activePlanId]) {
        const newest = Object.values(store.plans).sort((a, b) => b.touchedAt - a.touchedAt)[0];
        store.activePlanId = newest ? newest.plan.id : null;
      }

      if (!store.activePlanId) {
        // Genuinely empty account and empty cache: keep the invented default.
        const fallback = autoCreatedRef.current
          ? store.plans[autoCreatedRef.current]?.plan
          : undefined;
        const freshPlan = fallback ?? createDefaultPlan();
        store.plans[freshPlan.id] = {
          plan: freshPlan,
          serverUpdatedAt: null,
          synced: false,
          touchedAt: Date.now(),
        };
        store.activePlanId = freshPlan.id;
        enqueue(store, { t: 'putPlan', id: freshPlan.id });
      }

      // Adopt the reconciled active plan unless the user is mid-edit on it.
      const activeId = store.activePlanId;
      const active = store.plans[activeId];
      adoptingRef.current += 1;
      setPlan(clone(active.plan));

      // Snapshots for the active plan: the server is the truth for synced
      // ones; anything still queued locally is kept.
      try {
        const serverSnaps = await api.listSnapshots(activeId);
        if (cancelled) return;
        for (const snap of Object.values(store.snapshots)) {
          if (snap.planId === activeId && snap.synced) delete store.snapshots[snap.id];
        }
        for (const snap of serverSnaps) {
          store.snapshots[snap.id] = {
            id: snap.id,
            planId: snap.planId,
            name: snap.name,
            createdAt: Date.parse(snap.createdAt) || Date.now(),
            plan: { ...snap.data, version: PLAN_SCHEMA_VERSION },
            synced: true,
          };
        }
      } catch {
        // Snapshot listing is not worth failing the whole reconcile over.
      }

      setSnapshots(snapshotsForPlan(store, activeId));
      setPlanListTick((t) => t + 1);
      writeStoreNow();
      void flush();
    })().catch((error: unknown) => {
      if (cancelled) return;
      setSyncState(error instanceof ApiOffline ? 'offline' : 'error');
      if (!(error instanceof ApiOffline)) {
        console.error('[sovereign] Could not load plans from the server.', error);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // ---- Persist the plan on every change ------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!storeKey) {
      scheduleSave(() => window.localStorage.setItem(PLAN_KEY, JSON.stringify(plan)));
      return;
    }

    const store = storeRef.current;
    if (!store) return;

    if (adoptingRef.current > 0) {
      // The state was just set FROM the store; writing it back would enqueue
      // a spurious upload of content the server already has.
      adoptingRef.current -= 1;
      return;
    }

    const existing = store.plans[plan.id];
    store.plans[plan.id] = {
      plan,
      serverUpdatedAt: existing?.serverUpdatedAt ?? null,
      synced: existing?.synced ?? false,
      touchedAt: Date.now(),
    };
    store.activePlanId = plan.id;
    enqueue(store, { t: 'putPlan', id: plan.id });
    setPlanListTick((t) => t + 1);
    scheduleSave(writeStoreNow);
    scheduleFlush();
  }, [plan, storeKey, scheduleSave, scheduleFlush, writeStoreNow]);

  // Local mode keeps its own snapshot key in step; account mode snapshots are
  // written to the store by the mutators themselves.
  useEffect(() => {
    if (typeof window === 'undefined' || storeKey) return;
    try {
      window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
    } catch (error) {
      console.error('[sovereign] Could not save snapshots.', error);
    }
  }, [snapshots, storeKey]);

  useEffect(
    () => () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      if (flushTimer.current) clearTimeout(flushTimer.current);
    },
    [],
  );

  // ---- Core mutation -----------------------------------------------------
  const update = useCallback((mutator: (draft: Plan) => void, options: UpdateOptions = {}) => {
    editedRef.current = true;
    setPlan((current) => {
      const { historyKey, skipHistory } = options;

      if (!skipHistory) {
        const now = Date.now();
        const previous = lastHistory.current;
        const coalesce =
          historyKey !== undefined &&
          previous !== null &&
          previous.key === historyKey &&
          now - previous.at < HISTORY_COALESCE_MS;

        if (!coalesce) {
          past.current = [...past.current, clone(current)].slice(-HISTORY_LIMIT);
          future.current = [];
        }
        // Refresh the timestamp so a continuous run of typing keeps coalescing.
        lastHistory.current = { key: historyKey ?? `discrete:${now}`, at: now };
      }

      const draft = clone(current);
      mutator(draft);
      return draft;
    });

    setHistoryTick((t) => t + 1);
  }, []);

  /** Replaces the whole plan. Used by import, snapshot load and reset. */
  const replacePlan = useCallback((next: Plan, notes: string[] = []) => {
    editedRef.current = true;
    setPlan((current) => {
      past.current = [...past.current, clone(current)].slice(-HISTORY_LIMIT);
      future.current = [];
      lastHistory.current = null;
      return { ...clone(next), version: PLAN_SCHEMA_VERSION };
    });
    setMigrationNotes(notes);
    const store = storeRef.current;
    if (store) {
      store.notes = notes.length > 0 ? notes : undefined;
    }
    setHistoryTick((t) => t + 1);
  }, []);

  // ---- Undo / redo -------------------------------------------------------
  const undo = useCallback(() => {
    setPlan((current) => {
      const previous = past.current[past.current.length - 1];
      if (!previous) return current;
      past.current = past.current.slice(0, -1);
      future.current = [clone(current), ...future.current].slice(0, HISTORY_LIMIT);
      lastHistory.current = null;
      return previous;
    });
    setHistoryTick((t) => t + 1);
  }, []);

  const redo = useCallback(() => {
    setPlan((current) => {
      const next = future.current[0];
      if (!next) return current;
      future.current = future.current.slice(1);
      past.current = [...past.current, clone(current)].slice(-HISTORY_LIMIT);
      lastHistory.current = null;
      return next;
    });
    setHistoryTick((t) => t + 1);
  }, []);

  /**
   * Ends the current coalescing run, so the next edit starts a fresh undo step.
   * Call from onBlur to make each field a discrete unit of undo.
   */
  const commitHistory = useCallback(() => {
    lastHistory.current = null;
  }, []);

  // ---- Snapshots ---------------------------------------------------------
  const saveSnapshot = useCallback(
    (name: string) => {
      const snapshot: PlanSnapshot = {
        id: `snap_${Date.now().toString(36)}_${Math.floor(Math.random() * 1296).toString(36)}`,
        name: name.trim() || `Scenario ${snapshots.length + 1}`,
        createdAt: Date.now(),
        plan: clone(plan),
      };

      const store = storeRef.current;
      if (store) {
        store.snapshots[snapshot.id] = { ...snapshot, planId: plan.id, synced: false };
        enqueue(store, { t: 'putSnap', id: snapshot.id });
        setSnapshots(snapshotsForPlan(store, plan.id));
        scheduleSave(writeStoreNow);
        scheduleFlush();
      } else {
        setSnapshots((current) => [snapshot, ...current]);
      }
    },
    [plan, snapshots.length, scheduleSave, scheduleFlush, writeStoreNow],
  );

  const loadSnapshot = useCallback(
    (id: string) => {
      const snapshot = snapshots.find((s) => s.id === id);
      if (snapshot) replacePlan(snapshot.plan);
    },
    [snapshots, replacePlan],
  );

  const deleteSnapshot = useCallback(
    (id: string) => {
      const store = storeRef.current;
      if (store) {
        const snap = store.snapshots[id];
        delete store.snapshots[id];
        if (snap?.synced) enqueue(store, { t: 'delSnap', id });
        else store.queue = store.queue.filter((q) => !(q.t === 'putSnap' && q.id === id));
        setSnapshots(snapshotsForPlan(store, plan.id));
        scheduleSave(writeStoreNow);
        scheduleFlush();
      } else {
        setSnapshots((current) => current.filter((s) => s.id !== id));
      }
    },
    [plan.id, scheduleSave, scheduleFlush, writeStoreNow],
  );

  // ---- Multiple plans (account mode; local mode has exactly one) -----------
  const planList: PlanListEntry[] = useMemo(() => {
    const store = storeRef.current;
    if (!store) return [{ id: plan.id, name: plan.name, updatedAt: Date.now() }];
    return Object.values(store.plans)
      .map((entry) => ({ id: entry.plan.id, name: entry.plan.name, updatedAt: entry.touchedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    // planListTick invalidates this when the store changes; plan covers renames.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, planListTick]);

  const selectPlan = useCallback(
    (id: string) => {
      const store = storeRef.current;
      const entry = store?.plans[id];
      if (!store || !entry || id === store.activePlanId) return;

      store.activePlanId = id;
      adoptingRef.current += 1;
      setPlan(clone(entry.plan));
      setSnapshots(snapshotsForPlan(store, id));
      resetHistory();
      scheduleSave(writeStoreNow);

      // Refresh this plan's snapshots from the server in the background.
      if (api) {
        void api
          .listSnapshots(id)
          .then((serverSnaps) => {
            const current = storeRef.current;
            if (!current) return;
            for (const snap of Object.values(current.snapshots)) {
              if (snap.planId === id && snap.synced) delete current.snapshots[snap.id];
            }
            for (const snap of serverSnaps) {
              current.snapshots[snap.id] = {
                id: snap.id,
                planId: snap.planId,
                name: snap.name,
                createdAt: Date.parse(snap.createdAt) || Date.now(),
                plan: { ...snap.data, version: PLAN_SCHEMA_VERSION },
                synced: true,
              };
            }
            if (current.activePlanId === id) setSnapshots(snapshotsForPlan(current, id));
          })
          .catch(() => undefined);
      }
    },
    [api, resetHistory, scheduleSave, writeStoreNow],
  );

  const createPlan = useCallback(
    (template?: Plan) => {
      const store = storeRef.current;
      const fresh = template ? clone(template) : createDefaultPlan();
      if (!store) {
        // Local mode holds exactly one plan: starting fresh replaces it,
        // undoably, exactly like resetPlan.
        replacePlan(fresh);
        return;
      }
      if (store.plans[fresh.id]) fresh.id = `${fresh.id}_${Date.now().toString(36)}`;
      adoptingRef.current = 0; // A brand-new plan must persist and upload.
      setMigrationNotes([]);
      store.notes = undefined;
      setPlan(fresh);
      setSnapshots([]);
      resetHistory();
      // The persist effect adds it to the store and queues the upload.
    },
    [resetHistory, replacePlan],
  );

  const deletePlan = useCallback(
    (id: string) => {
      const store = storeRef.current;
      if (!store || !store.plans[id]) return;

      const wasSynced = store.plans[id].synced;
      delete store.plans[id];
      for (const snap of Object.values(store.snapshots)) {
        if (snap.planId === id) delete store.snapshots[snap.id];
      }
      if (wasSynced) enqueue(store, { t: 'delPlan', id });
      else {
        store.queue = store.queue.filter(
          (q) => !((q.t === 'putPlan' || q.t === 'putSnap') && 'id' in q && q.id === id),
        );
        // Unsynced snapshots of an unsynced plan: drop their pending puts too.
        store.queue = store.queue.filter(
          (q) => !(q.t === 'putSnap' && !store.snapshots[q.id]),
        );
      }

      if (store.activePlanId === id) {
        const next = Object.values(store.plans).sort((a, b) => b.touchedAt - a.touchedAt)[0];
        if (next) {
          store.activePlanId = next.plan.id;
          adoptingRef.current += 1;
          setPlan(clone(next.plan));
          setSnapshots(snapshotsForPlan(store, next.plan.id));
        } else {
          const fresh = createDefaultPlan();
          store.activePlanId = fresh.id;
          setPlan(fresh); // Persist effect stores and queues it.
          setSnapshots([]);
        }
        resetHistory();
      }

      setPlanListTick((t) => t + 1);
      scheduleSave(writeStoreNow);
      scheduleFlush();
    },
    [resetHistory, scheduleSave, scheduleFlush, writeStoreNow],
  );

  // ---- Import / export ---------------------------------------------------
  const exportPlan = useCallback(() => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${plan.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'plan'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [plan]);

  const importPlan = useCallback(
    (file: File): Promise<{ ok: boolean; error?: string }> =>
      new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = () => {
          try {
            const parsed = JSON.parse(String(reader.result));

            // A v2 export.
            if (parsed && Array.isArray(parsed.nodes) && parsed.assumptions) {
              // The imported file replaces the CURRENT plan's content, so it
              // must keep the current plan's identity.
              replacePlan({ ...(parsed as Plan), id: plan.id });
              resolve({ ok: true });
              return;
            }

            // A v1 export, which used `nodes`/`edges` alongside flat fields.
            if (parsed && (Array.isArray(parsed.nodes) || parsed.currentCash !== undefined)) {
              const { plan: migrated, notes } = migrateLegacyState({
                events: parsed.nodes,
                cash: parsed.currentCash,
                debt: parsed.currentDebt,
                income: parsed.baseMonthlyIncome,
                goalName: parsed.goalName,
                targetCapital: parsed.targetCapital,
                targetTimeline: parsed.targetTimeline,
                healthRedline: parsed.healthRedline,
                burnLedger: parsed.burnRateLedger,
                investmentYield: parsed.investmentYield,
                systemConstraints: parsed.systemConstraints,
                salahActive: parsed.salahActive,
                familyTime: parsed.familyTime,
                sleepTime: parsed.sleepTime,
                commutingTime: parsed.commutingTime,
                hygieneMealsTime: parsed.hygieneMealsTime,
                skillStudyTime: parsed.skillStudyTime,
                readingLearningTime: parsed.readingLearningTime,
                fitnessGymTime: parsed.fitnessGymTime,
                socialMediaTime: parsed.socialMediaTime,
                entertainmentTime: parsed.entertainmentTime,
              });
              replacePlan({ ...migrated, id: plan.id }, notes);
              resolve({ ok: true });
              return;
            }

            resolve({ ok: false, error: 'That file is not a Sovereign plan.' });
          } catch {
            resolve({ ok: false, error: 'That file could not be parsed as JSON.' });
          }
        };

        reader.onerror = () => resolve({ ok: false, error: 'The file could not be read.' });
        reader.readAsText(file);
      }),
    [replacePlan, plan.id],
  );

  const resetPlan = useCallback(
    () => replacePlan({ ...createDefaultPlan(), id: plan.id }),
    [replacePlan, plan.id],
  );

  const dismissMigrationNotes = useCallback(() => {
    setMigrationNotes([]);
    if (typeof window === 'undefined') return;
    if (storeKey) {
      const store = storeRef.current;
      if (store) {
        store.notes = undefined;
        scheduleSave(writeStoreNow);
      }
    } else {
      window.localStorage.removeItem(NOTES_KEY);
    }
  }, [storeKey, scheduleSave, writeStoreNow]);

  // ---- Importing this browser's pre-account plan into the account ----------
  const localImportAvailable = useMemo(
    () => (auth ? legacyLocalDataExists() : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auth?.userId],
  );

  const acceptLocalImport = useCallback(() => {
    const store = storeRef.current;
    if (!store) return;

    let imported: Plan | null = null;
    let notes: string[] = [];
    let legacySnapshots: PlanSnapshot[] = [];

    try {
      const raw = window.localStorage.getItem(PLAN_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Plan;
        if (parsed && Array.isArray(parsed.nodes)) {
          imported = { ...parsed, version: PLAN_SCHEMA_VERSION };
          legacySnapshots = loadLocalSnapshots();
        }
      }
      if (!imported) {
        const legacy = readLegacyState(window.localStorage);
        const result = migrateLegacyState(legacy);
        if (result.migrated) {
          imported = result.plan;
          notes = result.notes;
        }
      }
    } catch (error) {
      console.error('[sovereign] The local plan could not be read for import.', error);
    }

    if (!imported) {
      setImportOfferOpen(false);
      store.importFlag = 'imported';
      scheduleSave(writeStoreNow);
      return;
    }

    // Avoid colliding with a plan the account already has.
    if (store.plans[imported.id]) {
      imported = { ...imported, id: `${imported.id}_imported` };
    }
    const importedId = imported.id;

    // The untouched auto-created default has served its purpose.
    const autoId = autoCreatedRef.current;
    if (autoId && !editedRef.current && autoId !== importedId && store.plans[autoId]) {
      delete store.plans[autoId];
      store.queue = store.queue.filter((q) => !(q.t === 'putPlan' && q.id === autoId));
      autoCreatedRef.current = null;
    }

    for (const snap of legacySnapshots) {
      const id = store.snapshots[snap.id] ? `${snap.id}_imported` : snap.id;
      store.snapshots[id] = {
        ...snap,
        id,
        plan: { ...snap.plan, id: importedId, version: PLAN_SCHEMA_VERSION },
        planId: importedId,
        synced: false,
      };
      enqueue(store, { t: 'putSnap', id });
    }

    store.importFlag = 'imported';
    const allNotes = [
      ...notes,
      'Imported the plan stored in this browser into your account. The browser copy was left untouched.',
    ];

    replacePlan(imported, allNotes);
    setSnapshots(snapshotsForPlan(store, importedId));
    resetHistory();
    setImportOfferOpen(false);
    setPlanListTick((t) => t + 1);
    // The persist effect stores the plan, sets it active, and queues the upload;
    // the snapshot puts queued above ride the same flush.
  }, [replacePlan, resetHistory, scheduleSave, writeStoreNow]);

  const declineLocalImport = useCallback(() => {
    const store = storeRef.current;
    if (store) {
      store.importFlag = 'declined';
      scheduleSave(writeStoreNow);
    }
    setImportOfferOpen(false);
  }, [scheduleSave, writeStoreNow]);

  return {
    plan,
    update,
    replacePlan,
    undo,
    redo,
    commitHistory,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    historyTick,
    saveState,
    snapshots,
    saveSnapshot,
    loadSnapshot,
    deleteSnapshot,
    exportPlan,
    importPlan,
    resetPlan,
    migrationNotes,
    dismissMigrationNotes,

    // Account mode additions. In local mode these are inert: planList has one
    // entry, selectPlan/createPlan/deletePlan no-op, syncState is 'local'.
    syncState,
    planList,
    activePlanId: plan.id,
    selectPlan,
    createPlan,
    deletePlan,
    canManagePlans: auth !== null,
    importOfferOpen,
    localImportAvailable,
    acceptLocalImport,
    declineLocalImport,
    api,
  };
}

export type PlanController = ReturnType<typeof usePlan>;
