/**
 * Application shell: gate, navigation, live header, and view routing.
 *
 * All calculation lives in `src/engine` and all state in `src/state`. This file
 * wires them together and does no arithmetic of its own — which is the reason
 * it is ~400 lines rather than the 3,349 it used to be.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Info, Lock, Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Sidebar, TABS, type TabId } from './components/Sidebar';
import { DashboardView } from './views/DashboardView';
import { CanvasView, layoutPosition, useNarrowViewport } from './views/CanvasView';
import { ScenarioLabView } from './views/ScenarioLabView';
import { RiskView } from './views/RiskView';
import { ConstraintsView } from './views/ConstraintsView';
import { ExecutionView } from './views/ExecutionView';
import { SettingsView } from './views/SettingsView';
import { usePlan } from './state/usePlan';
import { useAnalysis } from './state/useAnalysis';
import * as actions from './state/actions';
import type { Assumptions, Constraint, Plan, PlanNode, TaskNode, Variant } from './engine';
import { isTask } from './engine';
import { Badge } from './ui/primitives';
import { hours, money, monthToken, percent } from './ui/format';
import { cn } from './lib/utils';

const MASTER_PASSCODE = 'ARCHITECT-01';
const GUEST_PASSCODE = 'GUEST-24H';
const GUEST_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [showDedication, setShowDedication] = useState(true);

  useEffect(() => {
    const mode = localStorage.getItem('sovereign_unlocked');
    if (mode === 'master') {
      setUnlocked(true);
    } else if (mode === 'guest') {
      const expiry = Number(localStorage.getItem('sovereign_guest_expires') ?? 0);
      if (Date.now() < expiry) {
        setUnlocked(true);
      } else {
        localStorage.removeItem('sovereign_unlocked');
        localStorage.removeItem('sovereign_guest_expires');
      }
    }
  }, []);

  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;
  if (showDedication) return <Dedication onEnter={() => setShowDedication(false)} />;

  return (
    <Workspace
      onLock={() => {
        localStorage.removeItem('sovereign_unlocked');
        localStorage.removeItem('sovereign_guest_expires');
        setUnlocked(false);
        setShowDedication(true);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

function Workspace({ onLock }: { onLock: () => void }) {
  const controller = usePlan();
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
        mobileOpen={menuOpen}
        onMobileClose={() => setMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          headline={headline}
          saveState={controller.saveState}
          onLock={onLock}
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
  onLock,
  issueCount,
  tabLabel,
  onOpenMenu,
}: {
  headline: { netWorth: number; freeHours: number; health: number; breaches: number; finish: number };
  saveState: 'idle' | 'saving' | 'saved';
  onLock: () => void;
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
          {saveBadge}
          {status}
          <button
            onClick={onLock}
            aria-label="Lock"
            className="flex items-center justify-center min-h-10 min-w-10 -mr-1 border border-secondary/40 text-secondary hover:bg-secondary/10 transition-colors"
          >
            <Lock size={14} />
          </button>
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
          {saveBadge}
          <button
            onClick={onLock}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-secondary/40 text-secondary hover:bg-secondary/10 transition-colors text-[9px] font-mono font-bold uppercase tracking-wider"
          >
            <Lock size={10} /> Lock
          </button>
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

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const attempt = () => {
    if (code === MASTER_PASSCODE) {
      localStorage.setItem('sovereign_unlocked', 'master');
      onUnlock();
    } else if (code === GUEST_PASSCODE) {
      localStorage.setItem('sovereign_unlocked', 'guest');
      localStorage.setItem('sovereign_guest_expires', String(Date.now() + GUEST_WINDOW_MS));
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => setError(false), 1800);
    }
    setCode('');
  };

  return (
    <div className="h-[100dvh] w-full bg-neutral-950 flex items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <div className="w-14 h-14 border-2 border-primary flex items-center justify-center text-primary font-black text-2xl mx-auto mb-6">
            S
          </div>
          <h1 className="text-primary font-headline font-bold text-lg tracking-[0.3em] uppercase">
            System Locked
          </h1>
          <p className="text-on-surface-variant font-mono text-[9px] uppercase tracking-[0.2em] mt-2">
            Deterministic Life Architect
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            value={code}
            autoFocus
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && attempt()}
            placeholder="ENTER PASSCODE"
            className={cn(
              'w-full bg-neutral-900 border px-4 py-3 text-primary font-mono text-sm text-center focus:outline-none transition-colors placeholder:text-on-surface-variant/30',
              error ? 'border-secondary' : 'border-outline-variant/30 focus:border-primary',
            )}
          />
          <button
            onClick={attempt}
            className="w-full bg-primary text-on-primary py-3 font-headline font-bold text-[10px] tracking-[0.2em] uppercase hover:brightness-110 transition-all"
          >
            [ Initiate Handshake ]
          </button>
          {error && (
            <p className="text-[10px] font-mono text-secondary uppercase tracking-wider">
              Passcode not recognised
            </p>
          )}
        </div>

        <p className="text-[8px] font-mono text-on-surface-variant/40 uppercase tracking-[0.2em] leading-relaxed">
          This gate is a curtain, not a safe. Everything is stored unencrypted in this browser.
        </p>
      </div>
    </div>
  );
}

function Dedication({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="h-[100dvh] w-full bg-neutral-950 flex items-center justify-center p-5 sm:p-6 relative overflow-y-auto">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-3xl space-y-9 sm:space-y-14 relative z-10 text-center py-8">
        <div className="space-y-5">
          <p className="text-primary font-bold text-lg sm:text-2xl md:text-3xl tracking-wide leading-relaxed font-serif">
            "And when you have decided, then rely upon Allah. Indeed, Allah loves those who rely
            [upon Him]."
          </p>
          <p className="text-white/50 font-mono text-xs tracking-[0.2em] uppercase">
            — Surah Ali 'Imran [3:159]
          </p>
        </div>

        <div className="w-2/3 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent mx-auto" />

        <div className="space-y-4">
          <p className="text-white font-mono text-base sm:text-lg md:text-xl tracking-wide">
            Dedicated to Eman Endris.
          </p>
          <p className="text-white/70 font-mono text-xs sm:text-sm md:text-base leading-relaxed max-w-xl mx-auto italic">
            My best friend, my anchor, and the only person I can truly depend on.
          </p>
          <p className="text-primary/80 font-mono text-xs tracking-[0.2em] pt-4 uppercase">
            — Yitbarek Tegene (Barack Mohammed)
          </p>
        </div>

        <button
          onClick={onEnter}
          className="border border-primary/50 text-primary hover:bg-primary/10 px-10 py-4 font-mono text-xs tracking-[0.2em] transition-all hover:scale-105"
        >
          [ ENTER ARCHITECTURE ]
        </button>
      </div>
    </div>
  );
}
