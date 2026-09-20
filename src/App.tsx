/**
 * Application shell: gate, navigation, live header, and view routing.
 *
 * All calculation lives in `src/engine` and all state in `src/state`. This file
 * wires them together and does no arithmetic of its own — which is the reason
 * it is ~400 lines rather than the 3,349 it used to be.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Info, Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { UserButton, useAuth, useUser } from '@clerk/react';
import { Sidebar, TABS, type TabId } from './components/Sidebar';
import { DedicationScreen } from './components/Dedication';
import { LandingView } from './views/LandingView';
import { AboutView } from './views/AboutView';
import { clerkEnabled, ownerUserId } from './lib/authConfig';
import { DashboardView } from './views/DashboardView';
import { CanvasView, layoutPosition, useNarrowViewport } from './views/CanvasView';
import { ScenarioLabView } from './views/ScenarioLabView';
import { RiskView } from './views/RiskView';
import { ConstraintsView } from './views/ConstraintsView';
import { ExecutionView } from './views/ExecutionView';
import { SettingsView } from './views/SettingsView';
import { usePlan, type AuthContext } from './state/usePlan';
import { ImportOfferModal } from './components/ImportOfferModal';
import { useAnalysis } from './state/useAnalysis';
import * as actions from './state/actions';
import type { Assumptions, Constraint, Plan, PlanNode, TaskNode, Variant } from './engine';
import { isTask } from './engine';
import { Badge } from './ui/primitives';
import { hours, money, monthToken, percent } from './ui/format';
import { cn } from './lib/utils';

export default function App() {
  const [showAbout, setShowAbout] = useState(false);

  if (showAbout) return <AboutView onBack={() => setShowAbout(false)} />;

  // No Clerk key configured: the app is local-only, exactly what it was
  // before accounts existed. The dedication still opens each session.
  if (!clerkEnabled) return <LocalOnlyApp />;

  return <ClerkGate onShowAbout={() => setShowAbout(true)} />;
}

/** Routes between the landing page and the workspace. Rendered only inside ClerkProvider. */
function ClerkGate({ onShowAbout }: { onShowAbout: () => void }) {
  const { isLoaded, isSignedIn } = useAuth();

  // While Clerk resolves the session, show the app's backdrop rather than
  // flashing the landing page at someone who is already signed in.
  if (!isLoaded) return <div className="h-[100dvh] w-full bg-neutral-950" />;
  if (!isSignedIn) return <LandingView onShowAbout={onShowAbout} />;
  return <AuthedApp />;
}

function LocalOnlyApp() {
  const [entered, setEntered] = useState(false);
  if (!entered) return <DedicationScreen onEnter={() => setEntered(true)} />;
  return <Workspace auth={null} accountArea={null} />;
}

/**
 * Signed-in shell. The dedication screen is personal: it appears only for
 * the owner's own account, once per session, before the workspace.
 */
function AuthedApp() {
  const { user } = useUser();
  const { userId, getToken } = useAuth();
  const [dedicationDone, setDedicationDone] = useState(false);

  const auth = useMemo(
    () => (userId ? { userId, getToken } : null),
    // getToken is captured by reference inside usePlan; only the user matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId],
  );

  const isOwner = ownerUserId !== undefined && user?.id === ownerUserId;
  if (isOwner && !dedicationDone) {
    return <DedicationScreen onEnter={() => setDedicationDone(true)} />;
  }

  // Key by user so a sign-out/sign-in never leaks one account's state into another.
  return <Workspace key={userId ?? 'anon'} auth={auth} accountArea={<UserButton />} />;
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

function Workspace({
  auth,
  accountArea,
}: {
  auth: AuthContext | null;
  accountArea: React.ReactNode;
}) {
  const controller = usePlan(auth);
  const { plan, update, commitHistory, undo, redo } = controller;
  const analysis = useAnalysis(plan);

  const [tab, setTab] = useState<TabId>('dashboard');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const narrow = useNarrowViewport();

  const flash = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
  }, []);

  // ---- Keyboard ----------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      const mod = e.metaKey || e.ctrlKey;
      if (!mod || typing) return;

      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // ---- Plan mutations ----------------------------------------------------
  const updateNode = useCallback(
    (id: string, patch: Partial<PlanNode>, historyKey?: string) =>
      update((draft) => actions.updateNode(draft, id, patch), { historyKey }),
    [update],
  );

  const addNode = useCallback(
    (kind: PlanNode['kind'], position?: { x: number; y: number }) => {
      let created: string | null = null;
      update((draft) => {
        const node = actions.addNode(draft, kind, position);
        created = node.id;
      });
      if (created) setSelectedNodeId(created);
    },
    [update],
  );

  const deleteNode = useCallback(
    (id: string) => {
      update((draft) => actions.deleteNode(draft, id));
      setSelectedNodeId((current) => (current === id ? null : current));
    },
    [update],
  );

  const connect = useCallback(
    (source: string, target: string, sourceHandle?: string, targetHandle?: string) => {
      let result: actions.ConnectResult = { ok: true };
      update((draft) => {
        result = actions.connectNodes(draft, source, target, sourceHandle, targetHandle);
      });
      if (!result.ok) {
        setConnectionError(result.reason ?? 'That connection is not allowed.');
        setTimeout(() => setConnectionError(null), 4000);
      }
    },
    [update],
  );

  const disconnect = useCallback(
    (source: string, target: string) => update((draft) => actions.disconnectNodes(draft, source, target)),
    [update],
  );

  const moveNode = useCallback(
    (id: string, position: { x: number; y: number }) =>
      update((draft) => actions.updateNode(draft, id, { position }), { historyKey: `pos:${id}` }),
    [update],
  );

  /**
   * Arranges nodes in bands by scheduled start. Time runs down the screen on a
   * phone and across it on a desktop, matching the canvas's own default layout —
   * otherwise tidying on a phone would produce a canvas thousands of pixels wide.
   */
  const tidy = useCallback(() => {
    update((draft) => {
      const counts = new Map<number, number>();

      // Match the canvas's own fallback: rank bands on a phone so tidying does
      // not stretch the graph by the duration of every task.
      const rank = new Map<number, number>();
      if (narrow) {
        [...new Set(draft.nodes.map((n) => analysis.schedule.nodes.get(n.id)?.earlyStart ?? 0))]
          .sort((a, b) => a - b)
          .forEach((value, i) => rank.set(value, i));
      }

      for (const node of draft.nodes) {
        const startMonth = analysis.schedule.nodes.get(node.id)?.earlyStart ?? 0;
        const band = narrow ? (rank.get(startMonth) ?? 0) : startMonth;
        const index = counts.get(band) ?? 0;
        counts.set(band, index + 1);
        node.position = layoutPosition(band, index, narrow);
      }
    });
    flash('Nodes arranged by scheduled start.');
  }, [update, analysis.schedule, flash, narrow]);

  const applyVariant = useCallback(
    (variant: Variant) => {
      update((draft) => actions.applyVariant(draft, variant.startMonths, variant.omitted));
      analysis.clearDerived();
      flash(`Adopted "${variant.ruleLabel}". Undo to revert.`);
      setTab('dashboard');
    },
    [update, analysis, flash],
  );

  const goToNode = useCallback((id: string) => {
    setSelectedNodeId(id);
    setTab('canvas');
  }, []);

  // ---- Header metrics ----------------------------------------------------
  const headline = useMemo(() => {
    const months = analysis.simulation.months;
    const final = months[months.length - 1];
    const nowMonth = Math.min(Math.max(1, plan.currentMonth || 1), months.length - 1);
    const now = months[nowMonth] ?? final;

    return {
      netWorth: final?.netWorth ?? 0,
      freeHours: now?.freeHours ?? 0,
      health: now?.emotional ?? 0,
      breaches: analysis.simulation.violations.filter((v) => v.severity === 'critical').length,
      finish: analysis.schedule.projectFinish,
    };
  }, [analysis, plan.currentMonth]);

  return (
    // dvh rather than vh: mobile browser chrome collapses and expands, and vh would
    // leave the footer stranded under the address bar.
    <div className="flex h-[100dvh] bg-surface-lowest text-on-surface selection:bg-primary/30">
      <Sidebar
        activeTab={tab}
        onSelect={setTab}
        planName={plan.name}
        planList={controller.planList}
        activePlanId={controller.activePlanId}
        canManagePlans={controller.canManagePlans}
        onSelectPlan={controller.selectPlan}
        onCreatePlan={() => {
          controller.createPlan();
          flash('Started a new plan.');
        }}
        mobileOpen={menuOpen}
        onMobileClose={() => setMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          headline={headline}
          saveState={controller.saveState}
          syncState={controller.syncState}
          accountArea={accountArea}
          issueCount={analysis.issues.filter((i) => i.severity === 'error').length}
          tabLabel={TABS.find((t) => t.id === tab)?.label ?? 'Settings'}
          onOpenMenu={() => setMenuOpen(true)}
        />

        {controller.migrationNotes.length > 0 && (
          <MigrationBanner
            notes={controller.migrationNotes}
            onDismiss={controller.dismissMigrationNotes}
          />
        )}

        <main className="flex-1 flex overflow-hidden">
          {tab === 'dashboard' && (
            <DashboardView plan={plan} analysis={analysis} onSelectNode={goToNode} />
          )}

          {tab === 'canvas' && (
            <CanvasView
              plan={plan}
              analysis={analysis}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onAddNode={addNode}
              onUpdateNode={updateNode}
              onDeleteNode={deleteNode}
              onConnect={connect}
              onDisconnect={disconnect}
              onMoveNode={moveNode}
              onTidy={tidy}
              onCommit={commitHistory}
              undo={undo}
              redo={redo}
              canUndo={controller.canUndo}
              canRedo={controller.canRedo}
              connectionError={connectionError}
            />
          )}

          {tab === 'lab' && (
            <ScenarioLabView plan={plan} analysis={analysis} onApplyVariant={applyVariant} />
          )}

          {tab === 'risk' && <RiskView plan={plan} analysis={analysis} />}

          {tab === 'constraints' && (
            <ConstraintsView
              plan={plan}
              analysis={analysis}
              onUpdate={(id, patch, historyKey) =>
                update((draft) => actions.updateConstraint(draft, id, patch), { historyKey })
              }
              onAdd={(constraint: Constraint) =>
                update((draft) => actions.addConstraint(draft, constraint))
              }
              onDelete={(id) => update((draft) => actions.deleteConstraint(draft, id))}
              onCommit={commitHistory}
            />
          )}

          {tab === 'execution' && (
            <ExecutionView
              plan={plan}
              analysis={analysis}
              onSetCurrentMonth={(month) => update((draft) => void (draft.currentMonth = month))}
              onSetTaskStatus={(id, status: TaskNode['status']) =>
                update((draft) => actions.setTaskStatus(draft, id, status))
              }
              onAddTelemetry={(entry) => update((draft) => actions.addTelemetry(draft, entry))}
              onDeleteTelemetry={(id) => update((draft) => actions.deleteTelemetry(draft, id))}
              onSelectNode={goToNode}
            />
          )}

          {tab === 'settings' && (
            <SettingsView
              plan={plan}
              controller={controller}
              onUpdateAssumptions={(patch: Partial<Assumptions>, historyKey?: string) =>
                update((draft) => void Object.assign(draft.assumptions, patch), { historyKey })
              }
              onUpdatePlan={(patch: Partial<Plan>, historyKey?: string) =>
                update((draft) => void Object.assign(draft, patch), { historyKey })
              }
            />
          )}
        </main>

        <Ticker plan={plan} analysis={analysis} />
      </div>

      {controller.importOfferOpen && (
        <ImportOfferModal
          onAccept={() => {
            controller.acceptLocalImport();
            flash('Your local plan is now in your account.');
          }}
          onDecline={controller.declineLocalImport}
        />
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-surface border border-primary/40 px-4 py-2.5 shadow-2xl"
          >
            <CheckCircle2 size={13} className="text-primary shrink-0" />
            <span className="text-[10px] font-mono text-on-surface">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

/**
 * On a phone there is no room for four metrics plus badges plus a lock button, so
 * the header becomes two rows: a title bar with the menu trigger and status, and a
 * horizontally scrollable metric strip beneath it. At md and up it collapses back
 * to the original single row.
 */
function Header({
  headline,
  saveState,
  syncState,
  accountArea,
  issueCount,
  tabLabel,
  onOpenMenu,
}: {
  headline: { netWorth: number; freeHours: number; health: number; breaches: number; finish: number };
  saveState: 'idle' | 'saving' | 'saved';
  syncState: 'local' | 'syncing' | 'synced' | 'offline' | 'error';
  accountArea: React.ReactNode;
  issueCount: number;
  tabLabel: string;
  onOpenMenu: () => void;
}) {
  const status =
    issueCount > 0 ? (
      <Badge tone="bad" pulse>
        {issueCount} BLOCKING
      </Badge>
    ) : headline.breaches > 0 ? (
      <Badge tone="bad">{headline.breaches} BREACHES</Badge>
    ) : (
      <Badge tone="good">NOMINAL</Badge>
    );

  const metrics = (
    <>
      <Metric label="Projected" value={money(headline.netWorth)} tone={headline.netWorth < 0 ? 'bad' : 'good'} />
      <Metric
        label="Free / day"
        value={hours(headline.freeHours)}
        tone={headline.freeHours < 0 ? 'bad' : headline.freeHours < 1 ? 'warn' : 'good'}
      />
      <Metric
        label="Health"
        value={percent(headline.health, 0)}
        tone={headline.health < 30 ? 'bad' : headline.health < 55 ? 'warn' : 'good'}
      />
      <Metric label="Plan ends" value={monthToken(headline.finish)} tone="neutral" />
    </>
  );

  const saveBadge = (
    <span
      className={cn(
        'text-[9px] font-mono uppercase tracking-wider transition-opacity',
        saveState === 'idle' ? 'opacity-0' : 'opacity-100',
        saveState === 'saved' ? 'text-primary' : 'text-on-surface-variant',
      )}
    >
      {saveState === 'saved' ? 'saved' : 'saving…'}
    </span>
  );

  // Quiet when healthy: only trouble ('offline', 'error') earns a permanent
  // label. Work is safe locally in both cases; the queue uploads on return.
  const syncBadge =
    syncState === 'offline' ? (
      <span
        className="text-[9px] font-mono uppercase tracking-wider text-amber-400"
        title="No connection. Changes are saved on this device and will upload when you're back online."
      >
        offline
      </span>
    ) : syncState === 'error' ? (
      <span
        className="text-[9px] font-mono uppercase tracking-wider text-secondary"
        title="The server could not be reached or rejected the last sync. Changes are safe on this device; sync will retry."
      >
        sync error
      </span>
    ) : null;

  return (
    <header className="bg-surface/90 backdrop-blur border-b border-outline-variant/20 shrink-0 z-10">
      {/* Mobile: title bar */}
      <div className="md:hidden flex items-center justify-between gap-3 px-3 h-14">
        <button
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="p-2 -ml-1 text-on-surface-variant hover:text-primary transition-colors"
        >
          <Menu size={20} />
        </button>

        <span className="font-headline text-sm text-on-surface truncate flex-1">{tabLabel}</span>

        <div className="flex items-center gap-2 shrink-0">
          {syncBadge}
          {saveBadge}
          {status}
          {accountArea && <div className="flex items-center -mr-1">{accountArea}</div>}
        </div>
      </div>

      {/* Mobile: metric strip, scrolls sideways rather than wrapping or clipping */}
      <div className="md:hidden flex items-center gap-4 px-3 pb-2.5 overflow-x-auto terminal-scroll">
        {metrics}
      </div>

      {/* Desktop */}
      <div className="hidden md:flex h-14 items-center justify-between px-6 gap-6">
        <div className="flex items-center gap-5 min-w-0 overflow-x-auto">{metrics}</div>
        <div className="flex items-center gap-3 shrink-0">
          {issueCount > 0 && (
            <Badge tone="bad" pulse>
              {issueCount} BLOCKING
            </Badge>
          )}
          {headline.breaches > 0 ? (
            <Badge tone="bad">{headline.breaches} BREACHES</Badge>
          ) : (
            <Badge tone="good">NOMINAL</Badge>
          )}
          {syncBadge}
          {saveBadge}
          {accountArea && <div className="flex items-center">{accountArea}</div>}
        </div>
      </div>
    </header>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  return (
    <span className="flex items-baseline gap-2 whitespace-nowrap">
      <span className="text-[9px] font-headline uppercase tracking-[0.15em] text-on-surface-variant">
        {label}
      </span>
      <span
        className={cn(
          'text-[11px] font-mono font-bold tabular-nums',
          tone === 'good' && 'text-primary',
          tone === 'warn' && 'text-amber-400',
          tone === 'bad' && 'text-secondary',
          tone === 'neutral' && 'text-on-surface',
        )}
      >
        {value}
      </span>
    </span>
  );
}

function MigrationBanner({ notes, onDismiss }: { notes: string[]; onDismiss: () => void }) {
  return (
    <div className="bg-cyan-400/5 border-b border-cyan-400/25 px-6 py-3 shrink-0">
      <div className="flex items-start gap-3">
        <Info size={14} className="text-cyan-300 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-cyan-300 mb-2">
            Your previous plan was brought forward
          </p>
          <ul className="space-y-1">
            {notes.map((note, i) => (
              <li key={i} className="text-[10px] font-mono text-on-surface-variant leading-relaxed">
                — {note}
              </li>
            ))}
          </ul>
        </div>
        <button onClick={onDismiss} className="text-on-surface-variant hover:text-on-surface shrink-0">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function Ticker({ plan, analysis }: { plan: Plan; analysis: ReturnType<typeof useAnalysis> }) {
  const { simulation, schedule } = analysis;
  const taskCount = plan.nodes.filter(isTask).length;

  const items = [
    ['NET WORTH', money(simulation.finalNetWorth)],
    ['TROUGH', money(simulation.troughNetWorth)],
    ['HEALTH FLOOR', percent(simulation.minEmotional, 0)],
    ['RELATIONAL FLOOR', percent(simulation.minRelational, 0)],
    ['SPIRITUAL FLOOR', percent(simulation.minSpiritual, 0)],
    ['FREE TIME FLOOR', hours(simulation.minFreeHours)],
    ['CRITICAL PATH', `${schedule.criticalNodeIds.size} OF ${taskCount + 2} NODES`],
    ['OBJECTIVES', `${simulation.objectives.filter((o) => o.satisfiedMonth !== null).length}/${simulation.objectives.length}`],
  ] as const;

  const row = (keyPrefix: string) =>
    items.map(([label, value]) => (
      <span key={`${keyPrefix}-${label}`} className="flex items-center gap-2.5 whitespace-nowrap">
        <span className="text-[8px] font-headline uppercase tracking-[0.15em] text-on-surface-variant/60">
          {label}
        </span>
        <span className="text-[9px] font-mono font-bold text-on-surface-variant">{value}</span>
      </span>
    ));

  return (
    // Decorative, and screen space is scarce on a phone — desktop only.
    <footer className="hidden md:flex h-7 bg-surface-lowest border-t border-outline-variant/15 items-center overflow-hidden shrink-0">
      <div className="flex items-center gap-10 px-6 animate-marquee">
        {row('a')}
        {row('b')}
      </div>
    </footer>
  );
}
