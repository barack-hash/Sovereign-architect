/**
 * The dependency canvas.
 *
 * Differences from v1 that matter:
 *  - Edge labels show *true* slack from the backward pass, not `target.month −
 *    source.month`, which measured a calendar gap and was frequently 0 for
 *    nodes with plenty of scheduling freedom.
 *  - The critical path is the real zero-slack chain, not the longest node count.
 *  - A connection that would create a cycle is refused at drag time with a
 *    reason, instead of being written into the plan where it would hang the
 *    month-shifting loop.
 *  - Node positions are stored on the node. v1 derived x from `month`, so
 *    dragging a node horizontally silently rescheduled it and then snapped back.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Flag,
  Info,
  LayoutGrid,
  Plus,
  Redo2,
  Target,
  Trash2,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Analysis } from '../state/useAnalysis';
import type { Plan, PlanNode } from '../engine';
import { isGenesis, isNote, isObjective, isTask } from '../engine';
import { NodeInspector } from './NodeInspector';
import { Badge, Button } from '../ui/primitives';
import { linkSlackLabel, moneyShort, percent } from '../ui/format';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Node presentation
// ---------------------------------------------------------------------------

const KIND_STYLE = {
  genesis: { border: '#22d3ee', header: '[ ORIGIN ]', Icon: Zap },
  task: { border: '#4be277', header: '[ TASK ]', Icon: Target },
  objective: { border: '#fbbf24', header: '[ OBJECTIVE ]', Icon: Flag },
  note: { border: '#6b7280', header: '[ NOTE ]', Icon: Info },
} as const;

type CanvasNodeData = {
  label: string;
  kind: keyof typeof KIND_STYLE;
  runStatus: 'locked' | 'ready' | 'active' | 'completed';
  isCritical: boolean;
  dimmed: boolean;
  lines: Array<{ label: string; value: string; tone?: 'good' | 'bad' | 'muted' }>;
  badge?: string;
  progress?: number;
};

function Handles({ color }: { color: string }) {
  const common = 'w-2.5 h-2.5 border-none hover:scale-150 transition-transform';
  return (
    <>
      <Handle type="target" position={Position.Left} id="left" className={cn(common, '!left-[-5px]')} style={{ background: color }} />
      <Handle type="target" position={Position.Top} id="top" className={cn(common, '!top-[-5px]')} style={{ background: color }} />
      <Handle type="source" position={Position.Right} id="right" className={cn(common, '!right-[-5px]')} style={{ background: color }} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={cn(common, '!bottom-[-5px]')} style={{ background: color }} />
    </>
  );
}

function CanvasNode({ data, selected }: NodeProps<Node<CanvasNodeData>>) {
  const style = KIND_STYLE[data.kind];
  const Icon = style.Icon;

  return (
    <div
      className={cn(
        'bg-surface-lowest min-w-[13rem] max-w-[15rem] shadow-2xl relative transition-opacity',
        data.dimmed && 'opacity-25',
      )}
      style={{
        border: `${selected ? 3 : 1.5}px solid ${data.isCritical ? '#ff6b35' : style.border}`,
        boxShadow: data.isCritical
          ? '0 0 20px rgba(255,107,53,0.35)'
          : selected
            ? `0 0 20px ${style.border}55`
            : 'none',
      }}
    >
      <span
        className="absolute -top-2.5 left-3 px-1.5 py-0.5 text-[7px] font-headline font-black uppercase tracking-[0.15em]"
        style={{ background: data.isCritical ? '#ff6b35' : style.border, color: '#0e0e10' }}
      >
        {data.isCritical ? '[ CRITICAL ]' : style.header}
      </span>

      {data.badge && (
        <span className="absolute -top-2.5 right-3 px-1.5 py-0.5 bg-surface-container border border-outline-variant/40 text-[7px] font-mono font-bold uppercase text-on-surface-variant">
          {data.badge}
        </span>
      )}

      <div className="p-3.5">
        <div className="flex items-center gap-2.5 mb-3 pb-2 border-b border-outline-variant/15">
          <span
            className={cn(
              'p-1.5 shrink-0',
              data.runStatus === 'completed' && 'bg-primary/15 text-primary',
              data.runStatus === 'active' && 'bg-cyan-400/15 text-cyan-300',
              (data.runStatus === 'locked' || data.runStatus === 'ready') && 'bg-surface-container text-on-surface-variant',
            )}
          >
            {data.runStatus === 'completed' ? <CheckCircle2 size={14} /> : <Icon size={14} />}
          </span>
          <p className="text-[10px] font-headline font-bold uppercase tracking-[0.12em] text-on-surface leading-tight break-words">
            {data.label}
          </p>
        </div>

        <dl className="space-y-1">
          {data.lines.map((line, i) => (
            <div key={i} className="flex justify-between items-baseline gap-3">
              <dt className="text-[8px] font-headline uppercase tracking-wider text-on-surface-variant truncate">
                {line.label}
              </dt>
              <dd
                className={cn(
                  'text-[10px] font-mono font-bold tabular-nums shrink-0',
                  line.tone === 'good' && 'text-primary',
                  line.tone === 'bad' && 'text-secondary',
                  line.tone === 'muted' && 'text-on-surface-variant',
                  !line.tone && 'text-on-surface',
                )}
              >
                {line.value}
              </dd>
            </div>
          ))}
        </dl>

        {data.progress !== undefined && (
          <div className="mt-3 h-1 bg-surface-container overflow-hidden">
            <div
              className={cn('h-full transition-all', data.progress >= 1 ? 'bg-primary' : 'bg-amber-400')}
              style={{ width: `${Math.min(100, data.progress * 100)}%` }}
            />
          </div>
        )}
      </div>

      <Handles color={data.isCritical ? '#ff6b35' : style.border} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

type SlackEdgeData = {
  slack: number;
  isCritical: boolean;
  onDelete: () => void;
};

function SlackEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
}: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edge = data as SlackEdgeData | undefined;
  const slack = edge?.slack ?? 0;
  const isCritical = edge?.isCritical ?? false;
  const [hovered, setHovered] = useState(false);

  const stroke = slack < 0 ? '#ff4444' : isCritical ? '#ff6b35' : '#4be277';

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          ...style,
          stroke,
          strokeWidth: isCritical ? 3 : 1.5,
          opacity: isCritical ? 1 : 0.55,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute flex items-center gap-1"
          style={{ transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <span
            className={cn(
              'px-1.5 py-0.5 border text-[7px] font-mono font-bold uppercase tracking-tight shadow-lg',
              slack < 0
                ? 'bg-secondary text-surface-lowest border-secondary animate-pulse'
                : isCritical
                  ? 'bg-[#ff6b35] text-surface-lowest border-[#ff6b35]'
                  : 'bg-surface-container text-primary border-primary/30',
            )}
          >
            {linkSlackLabel(slack)}
          </span>
          <AnimatePresence>
            {hovered && edge?.onDelete && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  edge.onDelete();
                }}
                className="p-1 bg-secondary text-surface-lowest shadow-lg hover:brightness-110"
                title="Remove this dependency"
              >
                <Trash2 size={9} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { plan: CanvasNode };
const edgeTypes = { slack: SlackEdge };

/**
 * Default layout geometry. Nodes are placed in bands by scheduled start, so the
 * canvas reads as time. The pitch is deliberately tight: a 48-month horizon at
 * 300px/band is a 14,000px canvas that no zoom level makes legible.
 */
export const COLUMN_PITCH = 150;
export const ROW_PITCH = 210;
export const LAYOUT_ORIGIN = { x: 60, y: 80 };

/**
 * Time runs left-to-right on a wide screen and top-to-bottom on a narrow one.
 *
 * A horizontal timeline is the natural reading on a desktop, but on a phone it
 * produces a canvas several thousand pixels wide that only fits at ~0.1 zoom —
 * every node illegible. Flipping the axis gives a tall, narrow graph that
 * matches the shape of the screen and fits at a readable scale.
 *
 * `band` is the scheduled start (position along the time axis); `offset` is the
 * node's index within that band (position across it).
 */
export function layoutPosition(band: number, offset: number, vertical: boolean) {
  return vertical
    ? { x: LAYOUT_ORIGIN.x + offset * 250, y: LAYOUT_ORIGIN.y + band * 190 }
    : { x: LAYOUT_ORIGIN.x + band * COLUMN_PITCH, y: LAYOUT_ORIGIN.y + offset * ROW_PITCH };
}

/** True while the viewport is phone-sized. Kept in sync with the `md` breakpoint. */
export function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    query.addEventListener('change', onChange);
    setNarrow(query.matches);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return narrow;
}

/**
 * Canvas toolbar sizing. Below md each button is a square 40px touch target with
 * its label hidden; at md and up it returns to the stock padded, labelled shape.
 * The icons are sized in CSS rather than with lucide's `size` prop so they can
 * grow on a phone and keep their original 11px on desktop.
 */
const TOOLBAR_BUTTON =
  'flex items-center justify-center min-h-[40px] min-w-[40px] px-3 md:min-h-0 md:min-w-0 md:px-4';
const TOOLBAR_ICON = 'shrink-0 w-3.5 h-3.5 md:w-[11px] md:h-[11px]';

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export interface CanvasProps {
  plan: Plan;
  analysis: Analysis;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onAddNode: (kind: PlanNode['kind'], position?: { x: number; y: number }) => void;
  onUpdateNode: (id: string, patch: Partial<PlanNode>, historyKey?: string) => void;
  onDeleteNode: (id: string) => void;
  onConnect: (source: string, target: string, sourceHandle?: string, targetHandle?: string) => void;
  onDisconnect: (source: string, target: string) => void;
  onMoveNode: (id: string, position: { x: number; y: number }) => void;
  onTidy: () => void;
  onCommit: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  connectionError: string | null;
}

export function CanvasView(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasInner({
  plan,
  analysis,
  selectedNodeId,
  onSelectNode,
  onAddNode,
  onUpdateNode,
  onDeleteNode,
  onConnect,
  onDisconnect,
  onMoveNode,
  onTidy,
  onCommit,
  undo,
  redo,
  canUndo,
  canRedo,
  connectionError,
}: CanvasProps) {
  const { schedule, simulation } = analysis;
  const { screenToFlowPosition, fitView, setViewport } = useReactFlow();
  const narrow = useNarrowViewport();
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const finalMonth = simulation.months[simulation.months.length - 1];

  // ---- Derive React Flow graph from the plan ------------------------------
  const derived = useMemo(() => {
    const flowNodes: Node<CanvasNodeData>[] = [];
    const flowEdges: Edge[] = [];

    // Fallback layout for nodes that have never been positioned: banded by
    // scheduled start, stacked within the band. Orientation follows the screen.
    const bandCounts = new Map<number, number>();

    /*
     * On a phone, bands are placed by *rank* rather than by raw start month.
     * Spacing proportional to the month number leaves a dead gap the length of
     * every task — a six-month certification pushes the next node 1,140px down
     * an otherwise empty canvas. Ranking keeps the chronological order while
     * collapsing the gaps. Desktop keeps true time-proportional spacing, where
     * the horizontal room makes it read as a real timeline.
     */
    const bandRank = new Map<number, number>();
    if (narrow) {
      const distinct = [...new Set(plan.nodes.map((n) => schedule.nodes.get(n.id)?.earlyStart ?? 0))].sort(
        (a, b) => a - b,
      );
      distinct.forEach((value, i) => bandRank.set(value, i));
    }

    for (const node of plan.nodes) {
      const scheduled = schedule.nodes.get(node.id);
      const runStatus = (finalMonth?.nodeStatus?.[node.id] ?? 'locked') as CanvasNodeData['runStatus'];
      const isCritical = schedule.criticalNodeIds.has(node.id) && !isNote(node);

      const startMonth = scheduled?.earlyStart ?? 0;
      const band = narrow ? (bandRank.get(startMonth) ?? 0) : startMonth;
      const index = bandCounts.get(band) ?? 0;
      bandCounts.set(band, index + 1);

      const position = node.position ?? layoutPosition(band, index, narrow);

      const lines: CanvasNodeData['lines'] = [];
      let badge: string | undefined;
      let progress: number | undefined;

      if (isGenesis(node)) {
        lines.push({ label: 'Cash', value: moneyShort(node.initialCash), tone: 'good' });
        if (node.initialDebt > 0) {
          lines.push({ label: 'Debt', value: moneyShort(node.initialDebt), tone: 'bad' });
        }
        lines.push({ label: 'Health', value: percent(node.initialEmotional, 0), tone: 'muted' });
        if (node.isActive) badge = 'ACTIVE';
      } else if (isTask(node)) {
        if (scheduled) badge = `M${scheduled.earlyStart + 1}–${scheduled.earlyFinish}`;
        lines.push({
          label: 'Duration',
          value: `${node.durationMonths} mo`,
          tone: 'muted',
        });
        if (node.immediateCost > 0) {
          lines.push({ label: 'Cost', value: moneyShort(-node.immediateCost), tone: 'bad' });
        }
        if (node.ongoingIncome > 0) {
          lines.push({ label: 'Income', value: `${moneyShort(node.ongoingIncome)}/mo`, tone: 'good' });
        }
        if (node.hoursPerDayWhileActive > 0) {
          lines.push({ label: 'Time', value: `${node.hoursPerDayWhileActive}h/day`, tone: 'bad' });
        }
        if (node.hoursPerDayReclaimed > 0) {
          lines.push({ label: 'Frees', value: `${node.hoursPerDayReclaimed}h/day`, tone: 'good' });
        }
        if (node.optional) lines.push({ label: 'Optional', value: 'yes', tone: 'muted' });
      } else if (isObjective(node)) {
        const outcome = simulation.objectives.find((o) => o.id === node.id);
        if (node.targetCapital > 0) {
          lines.push({ label: 'Target', value: moneyShort(node.targetCapital) });
        }
        lines.push({
          label: 'Status',
          value:
            outcome?.satisfiedMonth != null
              ? `MET M${outcome.satisfiedMonth}`
              : outcome
                ? 'NOT MET'
                : '—',
          tone: outcome?.satisfiedMonth != null ? 'good' : 'bad',
        });
        if (node.deadlineMonth > 0) badge = `BY M${node.deadlineMonth}`;
        progress = outcome?.peakProgress ?? 0;
      } else {
        lines.push({ label: '', value: node.content.slice(0, 60) || '—', tone: 'muted' });
      }

      flowNodes.push({
        id: node.id,
        type: 'plan',
        position,
        data: {
          label: node.name,
          kind: node.kind,
          runStatus,
          isCritical,
          dimmed: showCriticalOnly && !isCritical,
          lines,
          badge,
          progress,
        },
      });

      // Edges point from prerequisite to dependent.
      for (const dep of node.dependsOn) {
        const depScheduled = schedule.nodes.get(dep.id);
        const isCriticalEdge = schedule.criticalEdgeIds.has(`${dep.id}->${node.id}`);

        // Link slack: how long *this particular* prerequisite can run over before
        // it delays this dependent. Using the source node's total slack instead
        // would label every edge leaving Genesis "critical", since Genesis is by
        // definition on the critical path.
        const slack =
          depScheduled && scheduled ? scheduled.earlyStart - depScheduled.earlyFinish : 0;

        flowEdges.push({
          id: `${dep.id}->${node.id}`,
          source: dep.id,
          target: node.id,
          sourceHandle: dep.sourceHandle,
          targetHandle: dep.targetHandle,
          type: 'slack',
          animated: isCriticalEdge,
          data: {
            slack,
            isCritical: isCriticalEdge,
            onDelete: () => onDisconnect(dep.id, node.id),
          },
          style: { opacity: showCriticalOnly && !isCriticalEdge ? 0.1 : 1 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: slack < 0 ? '#ff4444' : isCriticalEdge ? '#ff6b35' : '#4be277',
          },
        });
      }
    }

    return { flowNodes, flowEdges };
  }, [plan, schedule, simulation, finalMonth, showCriticalOnly, onDisconnect, narrow]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CanvasNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  React.useEffect(() => {
    setNodes(derived.flowNodes);
    setEdges(derived.flowEdges);
  }, [derived, setNodes, setEdges]);

  const paneRef = React.useRef<HTMLDivElement | null>(null);
  const hasFitted = React.useRef(false);

  /**
   * Frames the graph for the current screen.
   *
   * On a desktop, fitting the whole graph is the useful default. On a phone it
   * is not: a plan spanning eighteen months only fits at roughly 0.1–0.2 zoom,
   * where no node is legible. Fitting is the wrong goal there — the graph opens
   * at a readable zoom, anchored at the start, and you pan through it. A tall
   * vertical layout makes that a natural thumb scroll.
   */
  const applyInitialView = React.useCallback(() => {
    if (narrow) {
      const zoom = 0.62;
      // Put the first band just inside the top-left corner.
      setViewport(
        {
          x: 16 - LAYOUT_ORIGIN.x * zoom,
          y: 16 - LAYOUT_ORIGIN.y * zoom,
          zoom,
        },
        { duration: 250 },
      );
    } else {
      fitView({ padding: 0.2, duration: 300, minZoom: 0.05 });
    }
  }, [narrow, fitView, setViewport]);

  /*
   * Apply it once, after the first batch of nodes lands.
   *
   * React Flow's own `fitView` prop runs at mount, before the effect above has
   * pushed any nodes in, so it would frame an empty graph. A single rAF is also
   * not enough on a phone: the pane is still being measured while the header
   * settles, so the result is computed against a zero or stale width. Wait for
   * the pane to actually report a size, retrying a bounded number of frames.
   */
  React.useEffect(() => {
    if (hasFitted.current || nodes.length === 0) return;

    let frame = 0;
    let attempts = 0;

    const tryFit = () => {
      const pane = paneRef.current;
      if ((pane?.clientWidth ?? 0) > 0 && (pane?.clientHeight ?? 0) > 0) {
        hasFitted.current = true;
        applyInitialView();
        return;
      }

      // ~1s of frames; if the pane never measures, leave the default view alone.
      if (attempts++ < 60) frame = requestAnimationFrame(tryFit);
    };

    frame = requestAnimationFrame(tryFit);
    return () => cancelAnimationFrame(frame);
  }, [nodes.length, applyInitialView]);

  /*
   * Re-fit when the viewport crosses between phone and desktop widths. Rotating
   * a phone or opening the inspector changes the usable area enough that a fit
   * computed for the old size leaves nodes stranded off-screen.
   */
  React.useEffect(() => {
    const pane = paneRef.current;
    if (!pane || typeof ResizeObserver === 'undefined') return;

    let previous = pane.clientWidth;
    const observer = new ResizeObserver(() => {
      const next = pane.clientWidth;
      // Ignore small reflows; only react to a real change in available space.
      if (next > 0 && Math.abs(next - previous) > 120) {
        previous = next;
        applyInitialView();
      }
    });

    observer.observe(pane);
    return () => observer.disconnect();
  }, [applyInitialView]);

  const handleConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        onConnect(params.source, params.target, params.sourceHandle ?? undefined, params.targetHandle ?? undefined);
      }
    },
    [onConnect],
  );

  const handleAdd = (kind: PlanNode['kind']) => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    onAddNode(kind, position);
    setAddMenuOpen(false);
  };

  const selectedNode = plan.nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div ref={paneRef} className="w-full h-full relative bg-[#0b0b0d]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onPaneClick={() => onSelectNode(null)}
        onNodeDragStop={(_, node) => {
          onMoveNode(node.id, node.position);
          onCommit();
        }}
        /*
         * Keyboard deletion is disabled deliberately. A node here carries a lot
         * of carefully entered data, and React Flow's default binds Backspace
         * and Delete to "remove everything selected" — one stray keypress with a
         * selection active can silently destroy most of a plan. Deletion goes
         * through the inspector's explicit, confirmed button instead.
         */
        deleteKeyCode={null}
        colorMode="dark"
        /*
         * No `fitView` prop: React Flow applies it once nodes first appear, which
         * lands *after* `applyInitialView` and silently overrode the readable
         * mobile framing with a fit-everything zoom. The initial view is managed
         * entirely by the effect above.
         */
        minZoom={0.05}
        maxZoom={2.5}
        /*
         * Touch navigation needs no props here: React Flow already defaults to
         * `panOnDrag` (one-finger drag pans) and `zoomOnPinch`, which is all a
         * phone has. Do not "enable" them explicitly — restating a default
         * reads as load-bearing config and invites someone to change the real
         * one.
         */
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={'dots' as any} color="#2a2a2e" gap={22} />
        {/* Lifted clear of the mobile toolbar below, and given finger-sized
            buttons; both revert to the stock geometry at md. */}
        <Controls className="!bottom-16 md:!bottom-0 !bg-surface !border !border-outline-variant/20 [&>button]:!bg-surface [&>button]:!border-outline-variant/20 [&>button]:!fill-on-surface-variant [&>button]:!w-10 [&>button]:!h-10 md:[&>button]:!w-[26px] md:[&>button]:!h-[26px]" />
        {/* A minimap of a graph this size is unreadable at 390px and only steals
            room from the toolbar and the add button. */}
        <MiniMap
          className="hidden md:block !bg-surface !border !border-outline-variant/20"
          maskColor="rgba(11,11,13,0.75)"
          nodeColor={(n) => {
            const data = n.data as CanvasNodeData;
            if (data.isCritical) return '#ff6b35';
            return KIND_STYLE[data.kind]?.border ?? '#4be277';
          }}
        />
      </ReactFlow>

      {/* ---- Toolbar ----
          Below md the four buttons drop their labels and become square, 40px
          touch targets: the full set of labels needs ~330px, which would wrap
          into the Controls above and under the add button to the right. The
          `title` on each still names it, and desktop is untouched. */}
      <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 z-20">
        <Button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Cmd/Ctrl+Z)"
          className={TOOLBAR_BUTTON}
        >
          <span className="flex items-center gap-1.5">
            <Undo2 className={TOOLBAR_ICON} />
            <span className="hidden md:inline">{' '}Undo</span>
          </span>
        </Button>
        <Button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Cmd/Ctrl+Shift+Z)"
          className={TOOLBAR_BUTTON}
        >
          <span className="flex items-center gap-1.5">
            <Redo2 className={TOOLBAR_ICON} />
            <span className="hidden md:inline">{' '}Redo</span>
          </span>
        </Button>
        <Button
          variant={showCriticalOnly ? 'accent' : 'ghost'}
          onClick={() => setShowCriticalOnly((v) => !v)}
          title="Dim everything with scheduling slack"
          className={TOOLBAR_BUTTON}
        >
          <span className="flex items-center gap-1.5">
            <Activity className={TOOLBAR_ICON} />
            <span className="hidden md:inline">{' '}Critical path</span>
          </span>
        </Button>
        <Button
          onClick={onTidy}
          title="Lay nodes out by scheduled start"
          className={TOOLBAR_BUTTON}
        >
          <span className="flex items-center gap-1.5">
            <LayoutGrid className={TOOLBAR_ICON} />
            <span className="hidden md:inline">{' '}Tidy</span>
          </span>
        </Button>
      </div>

      {/* ---- Critical path summary ----
          Spans the viewport on a phone rather than overflowing it, and caps its
          height so a long chain cannot swallow the whole canvas. */}
      {showCriticalOnly && (
        <div className="absolute top-4 left-4 right-4 md:right-auto z-20 md:max-w-md max-h-[40vh] md:max-h-none overflow-y-auto terminal-scroll bg-surface border border-[#ff6b35]/50 p-4 shadow-2xl">
          <p className="text-[9px] font-headline uppercase tracking-[0.25em] text-[#ff6b35] mb-2">
            Critical path · {schedule.projectFinish} months
          </p>
          <p className="text-[10px] font-mono text-on-surface leading-relaxed break-words">
            {schedule.criticalPath.length > 1
              ? schedule.criticalPath
                  .map((id) => plan.nodes.find((n) => n.id === id)?.name ?? id)
                  .join(' → ')
              : 'No chain of dependent work yet. Connect tasks so the engine has a sequence to measure.'}
          </p>
          <p className="text-[9px] text-on-surface-variant/70 mt-2 leading-relaxed">
            Everything on this chain has zero slack: delay any of it by a month and the whole plan
            moves a month.
          </p>
        </div>
      )}

      {/* ---- Connection error ---- */}
      <AnimatePresence>
        {connectionError && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            /* Inset from both edges on mobile; the half-width recentre only
               applies once there is room for the max-w-lg box. */
            className="absolute top-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-30 flex items-center gap-2.5 bg-surface border-2 border-secondary px-4 py-2.5 shadow-2xl md:max-w-lg"
          >
            <AlertTriangle size={13} className="text-secondary shrink-0" />
            <p className="text-[10px] font-mono text-on-surface leading-relaxed">{connectionError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Add node ---- */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-3">
        <AnimatePresence>
          {addMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              className="flex flex-col gap-1 bg-surface border border-outline-variant/30 p-1.5 shadow-2xl"
            >
              {(
                [
                  ['task', 'Task', '#4be277'],
                  ['objective', 'Objective', '#fbbf24'],
                  ['genesis', 'Alternate start', '#22d3ee'],
                  ['note', 'Note', '#6b7280'],
                ] as const
              ).map(([kind, label, color]) => (
                <button
                  key={kind}
                  onClick={() => handleAdd(kind)}
                  className="px-4 py-3 md:py-2 min-h-[40px] md:min-h-0 text-left text-[10px] font-headline font-bold uppercase tracking-[0.15em] hover:bg-surface-container transition-colors whitespace-nowrap"
                  style={{ color }}
                >
                  + {label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setAddMenuOpen((v) => !v)}
          className={cn(
            'w-13 h-13 p-4 shadow-2xl flex items-center justify-center transition-transform',
            addMenuOpen
              ? 'rotate-45 bg-surface border border-outline-variant/40 text-primary'
              : 'bg-primary text-on-primary hover:scale-110',
          )}
          title="Add a node"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* ---- Inspector ---- */}
      <AnimatePresence>
        {selectedNode && (
          <motion.aside
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'tween', duration: 0.18 }}
            /* `max-w-sm` (384px) keeps the panel inside a 390px viewport; the
               400px enter/exit offset still clears it completely. */
            className="absolute top-0 right-0 bottom-0 w-full max-w-sm md:w-96 bg-surface border-l border-outline-variant/25 z-30 shadow-2xl flex flex-col"
          >
            <header className="flex items-center justify-between gap-2 px-4 md:px-5 py-3 md:py-4 border-b border-outline-variant/15">
              <div className="flex items-center gap-2 min-w-0">
                <Info size={14} className="text-primary shrink-0" />
                <h3 className="text-[10px] font-headline font-bold uppercase tracking-[0.2em] truncate">
                  {selectedNode.kind} inspector
                </h3>
                {schedule.criticalNodeIds.has(selectedNode.id) && <Badge tone="bad">CRITICAL</Badge>}
              </div>
              <button
                onClick={() => onSelectNode(null)}
                aria-label="Close inspector"
                className="flex items-center justify-center shrink-0 w-10 h-10 -mr-2 md:w-auto md:h-auto md:mr-0 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <X size={16} />
              </button>
            </header>

            <NodeInspector
              plan={plan}
              node={selectedNode}
              analysis={analysis}
              onUpdate={onUpdateNode}
              onDelete={onDeleteNode}
              onDisconnect={onDisconnect}
              onCommit={onCommit}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
