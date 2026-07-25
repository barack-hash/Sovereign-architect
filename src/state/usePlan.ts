/**
 * The single owner of application state.
 *
 * v1 spread its state across roughly 30 `useLocalStorage` calls, several of
 * which held competing copies of the same fact — the sidebar's cash value and
 * the Genesis node's cash value were independent, and only the latter reached
 * the simulator. Here there is exactly one `Plan`, every edit goes through
 * `update`, and every derived number is computed from it.
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

const PLAN_KEY = 'sovereign.plan.v2';
const SNAPSHOT_KEY = 'sovereign.snapshots.v2';
const NOTES_KEY = 'sovereign.migration-notes.v2';

/** Consecutive edits sharing a key inside this window collapse into one undo step. */
const HISTORY_COALESCE_MS = 700;
const HISTORY_LIMIT = 100;
const PERSIST_DEBOUNCE_MS = 400;

export interface PlanSnapshot {
  id: string;
  name: string;
  createdAt: number;
  plan: Plan;
}

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
// Initial load
// ---------------------------------------------------------------------------

interface LoadResult {
  plan: Plan;
  migrationNotes: string[];
}

function loadInitialPlan(): LoadResult {
  if (typeof window === 'undefined') {
    return { plan: createDefaultPlan(), migrationNotes: [] };
  }

  // 1. An existing v2 plan always wins.
  try {
    const raw = window.localStorage.getItem(PLAN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Plan;
      if (parsed && Array.isArray(parsed.nodes)) {
        const notesRaw = window.localStorage.getItem(NOTES_KEY);
        return {
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
      return { plan, migrationNotes: notes };
    }
  } catch (error) {
    console.error('[sovereign] Migration from the previous version failed.', error);
  }

  // 3. Fresh start.
  return { plan: createDefaultPlan(), migrationNotes: [] };
}

function loadSnapshots(): PlanSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as PlanSnapshot[]) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePlan() {
  const initial = useMemo(loadInitialPlan, []);

  const [plan, setPlan] = useState<Plan>(initial.plan);
  const [migrationNotes, setMigrationNotes] = useState<string[]>(initial.migrationNotes);
  const [snapshots, setSnapshots] = useState<PlanSnapshot[]>(loadSnapshots);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const past = useRef<Plan[]>([]);
  const future = useRef<Plan[]>([]);
  const lastHistory = useRef<{ key: string; at: number } | null>(null);
  // Forces a re-render when only the history refs changed.
  const [historyTick, setHistoryTick] = useState(0);

  // ---- Persistence -------------------------------------------------------
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setSaveState('saving');
    if (persistTimer.current) clearTimeout(persistTimer.current);

    persistTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
        setSaveState('saved');
        // Clear the badge after a moment so it reads as an event, not a status.
        setTimeout(() => setSaveState('idle'), 1500);
      } catch (error) {
        console.error('[sovereign] Could not save. Storage may be full.', error);
        setSaveState('idle');
      }
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [plan]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
    } catch (error) {
      console.error('[sovereign] Could not save snapshots.', error);
    }
  }, [snapshots]);

  // ---- Core mutation -----------------------------------------------------
  const update = useCallback((mutator: (draft: Plan) => void, options: UpdateOptions = {}) => {
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
    setPlan((current) => {
      past.current = [...past.current, clone(current)].slice(-HISTORY_LIMIT);
      future.current = [];
      lastHistory.current = null;
      return { ...clone(next), version: PLAN_SCHEMA_VERSION };
    });
    setMigrationNotes(notes);
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
      setSnapshots((current) => [
        {
          id: `snap_${Date.now().toString(36)}`,
          name: name.trim() || `Scenario ${current.length + 1}`,
          createdAt: Date.now(),
          plan: clone(plan),
        },
        ...current,
      ]);
    },
    [plan],
  );

  const loadSnapshot = useCallback(
    (id: string) => {
      const snapshot = snapshots.find((s) => s.id === id);
      if (snapshot) replacePlan(snapshot.plan);
    },
    [snapshots, replacePlan],
  );

  const deleteSnapshot = useCallback((id: string) => {
    setSnapshots((current) => current.filter((s) => s.id !== id));
  }, []);

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
              replacePlan(parsed as Plan);
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
              replacePlan(migrated, notes);
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
    [replacePlan],
  );

  const resetPlan = useCallback(() => replacePlan(createDefaultPlan()), [replacePlan]);

  const dismissMigrationNotes = useCallback(() => {
    setMigrationNotes([]);
    if (typeof window !== 'undefined') window.localStorage.removeItem(NOTES_KEY);
  }, []);

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
  };
}

export type PlanController = ReturnType<typeof usePlan>;
