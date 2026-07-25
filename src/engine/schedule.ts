/**
 * Critical Path Method (CPM) over the plan graph.
 *
 * Time convention
 * ---------------
 * Time is measured in elapsed months from Genesis, at month *boundaries*:
 *
 *   earlyStart  = months elapsed before the node may begin
 *   earlyFinish = earlyStart + durationMonths
 *
 * A task with earlyStart 2 and duration 3 is in progress during calendar months
 * 3, 4 and 5, and is complete at the end of month 5. Genesis and Objectives are
 * milestones: duration 0, so start and finish coincide.
 *
 * Slack
 * -----
 *   totalSlack = lateStart - earlyStart
 *     How long this can be delayed without pushing out the project end.
 *   freeSlack  = min(earlyStart of successors) - earlyFinish
 *     How long it can be delayed without disturbing any successor at all.
 *
 * A node is on the critical path when totalSlack is 0: any delay to it delays
 * everything downstream. This is the number the old implementation approximated
 * with `target.month - source.month`, which measured a calendar gap rather than
 * scheduling freedom.
 */

import type { Plan, PlanNode } from './types';
import { isTask, isNote } from './types';
import { activeGenesis, buildAdjacency, reachableFrom, topologicalOrder } from './graph';

export interface ScheduledNode {
  id: string;
  name: string;
  kind: PlanNode['kind'];
  durationMonths: number;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalSlack: number;
  freeSlack: number;
  isCritical: boolean;
  /** Set when a deadline exists and earlyFinish overruns it. */
  missesDeadlineBy: number;
  /** True when the node cannot finish inside the plan horizon. */
  beyondHorizon: boolean;
}

export interface Schedule {
  /** Keyed by node id. Only contains nodes reachable from the active Genesis. */
  nodes: Map<string, ScheduledNode>;
  /** Earliest month by which every scheduled node is complete. */
  projectFinish: number;
  /** Ordered node ids forming the longest zero-slack chain from Genesis. */
  criticalPath: string[];
  /** Ids of every zero-slack node, which may include parallel critical chains. */
  criticalNodeIds: Set<string>;
  /** Edges (as `${source}->${target}`) that lie on a zero-slack chain. */
  criticalEdgeIds: Set<string>;
  /** Nodes that overrun a deadline or the horizon. */
  infeasible: ScheduledNode[];
}

const durationOf = (node: PlanNode): number => (isTask(node) ? Math.max(1, node.durationMonths) : 0);

const earliestStartOf = (node: PlanNode): number =>
  isTask(node) ? Math.max(0, node.earliestStartMonth) : 0;

const deadlineOf = (node: PlanNode): number => {
  if (isTask(node)) return node.deadlineMonth > 0 ? node.deadlineMonth : Infinity;
  if (node.kind === 'objective') return node.deadlineMonth > 0 ? node.deadlineMonth : Infinity;
  return Infinity;
};

/**
 * Runs the forward and backward pass.
 *
 * Returns an empty schedule (rather than throwing) when the graph has no
 * Genesis or contains a cycle — the caller surfaces those through
 * `validateGraph`, and a broken graph should degrade the UI, not crash it.
 */
export function computeSchedule(plan: Plan): Schedule {
  const empty: Schedule = {
    nodes: new Map(),
    projectFinish: 0,
    criticalPath: [],
    criticalNodeIds: new Set(),
    criticalEdgeIds: new Set(),
    infeasible: [],
  };

  const genesis = activeGenesis(plan);
  if (!genesis) return empty;

  // Notes are annotations; they never take time and never gate anything.
  const relevant = plan.nodes.filter((n) => !isNote(n));
  const reachable = reachableFrom(relevant, genesis.id);
  const scope = relevant.filter((n) => reachable.has(n.id));

  const order = topologicalOrder(scope);
  if (!order) return empty; // cyclic — validateGraph reports it

  const byId = new Map(scope.map((n) => [n.id, n]));
  const { predecessors, successors } = buildAdjacency(scope);

  // ---- Forward pass: earliest possible timings -----------------------------
  const earlyStart = new Map<string, number>();
  const earlyFinish = new Map<string, number>();

  for (const id of order) {
    const node = byId.get(id)!;
    const preds = predecessors.get(id) ?? [];

    // A node cannot begin until every prerequisite has finished.
    const readyAt = preds.reduce((max, p) => Math.max(max, earlyFinish.get(p) ?? 0), 0);
    const es = Math.max(readyAt, earliestStartOf(node));
    const ef = es + durationOf(node);

    earlyStart.set(id, es);
    earlyFinish.set(id, ef);
  }

  const projectFinish = order.reduce((max, id) => Math.max(max, earlyFinish.get(id) ?? 0), 0);

  // ---- Backward pass: latest permissible timings ---------------------------
  const lateFinish = new Map<string, number>();
  const lateStart = new Map<string, number>();

  for (const id of [...order].reverse()) {
    const node = byId.get(id)!;
    const succs = successors.get(id) ?? [];

    // With no successors the node may finish as late as the project does —
    // unless it carries its own deadline, which binds tighter.
    const successorBound = succs.length
      ? succs.reduce((min, s) => Math.min(min, lateStart.get(s) ?? Infinity), Infinity)
      : projectFinish;

    const lf = Math.min(successorBound, deadlineOf(node));
    const ls = lf - durationOf(node);

    lateFinish.set(id, lf);
    lateStart.set(id, ls);
  }

  // ---- Assemble ------------------------------------------------------------
  const nodes = new Map<string, ScheduledNode>();
  const criticalNodeIds = new Set<string>();
  const infeasible: ScheduledNode[] = [];

  for (const id of order) {
    const node = byId.get(id)!;
    const es = earlyStart.get(id)!;
    const ef = earlyFinish.get(id)!;
    const ls = lateStart.get(id)!;
    const lf = lateFinish.get(id)!;

    const succs = successors.get(id) ?? [];
    const freeSlack = succs.length
      ? succs.reduce((min, s) => Math.min(min, earlyStart.get(s) ?? Infinity), Infinity) - ef
      : projectFinish - ef;

    const totalSlack = ls - es;
    // Floating-point is not in play here (all integers), so an exact compare is safe.
    const isCritical = totalSlack <= 0;

    const deadline = deadlineOf(node);
    const missesDeadlineBy = deadline === Infinity ? 0 : Math.max(0, ef - deadline);

    const scheduled: ScheduledNode = {
      id,
      name: node.name,
      kind: node.kind,
      durationMonths: durationOf(node),
      earlyStart: es,
      earlyFinish: ef,
      lateStart: ls,
      lateFinish: lf,
      totalSlack,
      freeSlack,
      isCritical,
      missesDeadlineBy,
      beyondHorizon: ef > plan.horizonMonths,
    };

    nodes.set(id, scheduled);
    if (isCritical) criticalNodeIds.add(id);
    if (missesDeadlineBy > 0 || scheduled.beyondHorizon) infeasible.push(scheduled);
  }

  // ---- Trace the critical chain -------------------------------------------
  // Walk forward from Genesis, always stepping to the critical successor that
  // finishes latest. That yields the single chain that sets the project end.
  const criticalPath: string[] = [];
  const criticalEdgeIds = new Set<string>();

  if (nodes.has(genesis.id)) {
    let current: string | undefined = genesis.id;
    const visited = new Set<string>();

    while (current && !visited.has(current)) {
      visited.add(current);
      criticalPath.push(current);

      const candidates: string[] = (successors.get(current) ?? []).filter((s) =>
        criticalNodeIds.has(s),
      );
      if (candidates.length === 0) break;

      const next: string = candidates.reduce((best: string, s: string) =>
        (earlyFinish.get(s) ?? 0) > (earlyFinish.get(best) ?? 0) ? s : best,
      );

      criticalEdgeIds.add(`${current}->${next}`);
      current = next;
    }
  }

  return {
    nodes,
    projectFinish,
    criticalPath,
    criticalNodeIds,
    criticalEdgeIds,
    infeasible,
  };
}

/**
 * The chain of work that determines when `objectiveId` can be reached: the
 * longest-duration path from Genesis to that node.
 *
 * This answers "what is actually holding this goal back", which is a different
 * and usually more useful question than the project-wide critical path — the
 * project end may be set by work you do not care about.
 */
export function criticalPathTo(
  plan: Plan,
  objectiveId: string,
): { path: string[]; months: number } {
  const genesis = activeGenesis(plan);
  if (!genesis) return { path: [], months: 0 };

  const relevant = plan.nodes.filter((n) => !isNote(n));
  const order = topologicalOrder(relevant);
  if (!order) return { path: [], months: 0 };

  const byId = new Map(relevant.map((n) => [n.id, n]));
  const { predecessors } = buildAdjacency(relevant);

  if (!byId.has(objectiveId)) return { path: [], months: 0 };

  // Longest path by duration, computed over the topological order so each node
  // is finalised before anything that depends on it is considered.
  const best = new Map<string, number>();
  const cameFrom = new Map<string, string | null>();

  for (const id of order) {
    const node = byId.get(id)!;
    const preds = predecessors.get(id) ?? [];

    if (id === genesis.id) {
      best.set(id, durationOf(node));
      cameFrom.set(id, null);
      continue;
    }

    let bestPred: string | null = null;
    let bestValue = -Infinity;

    for (const p of preds) {
      const v = best.get(p);
      if (v === undefined) continue; // not reachable from Genesis
      if (v > bestValue) {
        bestValue = v;
        bestPred = p;
      }
    }

    if (bestPred === null) continue; // unreachable from Genesis

    const start = Math.max(bestValue, earliestStartOf(node));
    best.set(id, start + durationOf(node));
    cameFrom.set(id, bestPred);
  }

  if (!best.has(objectiveId)) return { path: [], months: 0 };

  const path: string[] = [];
  let cursor: string | null | undefined = objectiveId;
  while (cursor) {
    path.push(cursor);
    cursor = cameFrom.get(cursor) ?? null;
  }
  path.reverse();

  return { path, months: best.get(objectiveId)! };
}

/**
 * Which calendar months (1-indexed) a node occupies.
 * Milestones (duration 0) return an empty list — they are instants, not spans.
 */
export function activeMonths(node: ScheduledNode): number[] {
  if (node.durationMonths <= 0) return [];
  const months: number[] = [];
  for (let m = node.earlyStart + 1; m <= node.earlyFinish; m++) months.push(m);
  return months;
}
