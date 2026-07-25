/**
 * Dependency-graph utilities.
 *
 * Everything here is pure and operates on the canonical `Plan` node list. The
 * scheduler and simulator both assume the graph is acyclic; `validateGraph` is
 * what guarantees that, and callers must run it before scheduling.
 */

import type { Plan, PlanNode, Dependency } from './types';
import { isGenesis, isNote } from './types';

export interface GraphIssue {
  severity: 'error' | 'warning';
  code:
    | 'CYCLE'
    | 'MISSING_DEPENDENCY'
    | 'SELF_DEPENDENCY'
    | 'NO_GENESIS'
    | 'MULTIPLE_ACTIVE_GENESIS'
    | 'ORPHANED'
    | 'DUPLICATE_ID';
  message: string;
  /** Nodes implicated. For CYCLE this is the cycle in order. */
  nodeIds: string[];
}

export const depId = (d: Dependency | string): string => (typeof d === 'string' ? d : d.id);

/** Normalises the legacy `string | {id}` dependency shape to `Dependency`. */
export const toDependency = (d: Dependency | string): Dependency =>
  typeof d === 'string' ? { id: d } : d;

/** Adjacency in dependency order: `predecessors[x]` are the nodes x waits on. */
export function buildAdjacency(nodes: PlanNode[]): {
  predecessors: Map<string, string[]>;
  successors: Map<string, string[]>;
} {
  const ids = new Set(nodes.map((n) => n.id));
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();

  for (const n of nodes) {
    predecessors.set(n.id, []);
    successors.set(n.id, []);
  }

  for (const n of nodes) {
    for (const raw of n.dependsOn ?? []) {
      const pid = depId(raw);
      // Silently skip dangling edges here; validateGraph reports them.
      if (!ids.has(pid) || pid === n.id) continue;
      predecessors.get(n.id)!.push(pid);
      successors.get(pid)!.push(n.id);
    }
  }

  return { predecessors, successors };
}

/**
 * Finds one cycle if the graph has any, using an explicit-stack DFS with
 * white/grey/black colouring. Returns the cycle as an ordered node-id list, or
 * null when the graph is acyclic.
 */
export function findCycle(nodes: PlanNode[]): string[] | null {
  const { successors } = buildAdjacency(nodes);
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const n of nodes) color.set(n.id, WHITE);

  for (const start of nodes) {
    if (color.get(start.id) !== WHITE) continue;

    // Iterative DFS so deep graphs cannot blow the JS stack.
    const stack: Array<{ id: string; childIndex: number }> = [{ id: start.id, childIndex: 0 }];
    color.set(start.id, GREY);
    parent.set(start.id, null);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const children = successors.get(frame.id) ?? [];

      if (frame.childIndex >= children.length) {
        color.set(frame.id, BLACK);
        stack.pop();
        continue;
      }

      const child = children[frame.childIndex++];
      const childColor = color.get(child);

      if (childColor === GREY) {
        // Walk back up the stack to reconstruct the cycle.
        const cycle: string[] = [child];
        for (let i = stack.length - 1; i >= 0; i--) {
          cycle.push(stack[i].id);
          if (stack[i].id === child) break;
        }
        return cycle.reverse();
      }

      if (childColor === WHITE) {
        color.set(child, GREY);
        parent.set(child, frame.id);
        stack.push({ id: child, childIndex: 0 });
      }
    }
  }

  return null;
}

/**
 * Kahn topological sort. Returns null if the graph contains a cycle, so callers
 * that skipped validation still cannot silently schedule an impossible plan.
 *
 * Ties are broken by the node's index in `nodes`, which keeps the ordering
 * stable across runs — important, because the simulator must be deterministic.
 */
export function topologicalOrder(nodes: PlanNode[]): string[] | null {
  const { predecessors, successors } = buildAdjacency(nodes);
  const indegree = new Map<string, number>();
  const order = new Map<string, number>();

  nodes.forEach((n, i) => {
    indegree.set(n.id, predecessors.get(n.id)!.length);
    order.set(n.id, i);
  });

  // Stable min-heap behaviour via a sorted ready list. Node counts here are
  // small (tens to low hundreds), so an O(n^2 log n) sort is not worth avoiding.
  const ready = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  ready.sort((a, b) => order.get(a)! - order.get(b)!);

  const result: string[] = [];

  while (ready.length > 0) {
    const id = ready.shift()!;
    result.push(id);

    for (const succ of successors.get(id) ?? []) {
      const next = indegree.get(succ)! - 1;
      indegree.set(succ, next);
      if (next === 0) {
        ready.push(succ);
        ready.sort((a, b) => order.get(a)! - order.get(b)!);
      }
    }
  }

  return result.length === nodes.length ? result : null;
}

/** The active Genesis node, or the first Genesis, or undefined. */
export function activeGenesis(plan: Plan) {
  const geneses = plan.nodes.filter(isGenesis);
  return geneses.find((g) => g.isActive) ?? geneses[0];
}

/**
 * Every node reachable downstream from `rootId` by following dependency edges,
 * inclusive of the root. Nodes outside this set have no causal link to your
 * starting point and are excluded from simulation.
 */
export function reachableFrom(nodes: PlanNode[], rootId: string): Set<string> {
  const { successors } = buildAdjacency(nodes);
  const seen = new Set<string>([rootId]);
  const queue = [rootId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const succ of successors.get(id) ?? []) {
      if (!seen.has(succ)) {
        seen.add(succ);
        queue.push(succ);
      }
    }
  }

  return seen;
}

/** All transitive prerequisites of `nodeId`, exclusive of the node itself. */
export function ancestorsOf(nodes: PlanNode[], nodeId: string): Set<string> {
  const { predecessors } = buildAdjacency(nodes);
  const seen = new Set<string>();
  const queue = [...(predecessors.get(nodeId) ?? [])];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...(predecessors.get(id) ?? []));
  }

  return seen;
}

/** All transitive dependents of `nodeId`, exclusive of the node itself. */
export function descendantsOf(nodes: PlanNode[], nodeId: string): Set<string> {
  const set = reachableFrom(nodes, nodeId);
  set.delete(nodeId);
  return set;
}

/**
 * Would adding source -> target introduce a cycle? Used by the canvas to reject
 * an edge at drag time rather than letting it corrupt the plan.
 */
export function wouldCreateCycle(nodes: PlanNode[], sourceId: string, targetId: string): boolean {
  if (sourceId === targetId) return true;
  // A cycle appears iff source is already reachable from target.
  return reachableFrom(nodes, targetId).has(sourceId);
}

/**
 * Full structural validation. Errors mean the plan cannot be simulated;
 * warnings mean it can, but something is probably not what the user intended.
 */
export function validateGraph(plan: Plan): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const nodes = plan.nodes;

  // Duplicate IDs corrupt every Map keyed by id, so check first.
  const seenIds = new Set<string>();
  for (const n of nodes) {
    if (seenIds.has(n.id)) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_ID',
        message: `Duplicate node id "${n.id}". Node ids must be unique.`,
        nodeIds: [n.id],
      });
    }
    seenIds.add(n.id);
  }

  const geneses = nodes.filter(isGenesis);
  if (geneses.length === 0) {
    issues.push({
      severity: 'error',
      code: 'NO_GENESIS',
      message: 'No Genesis node. The plan has no starting point to simulate from.',
      nodeIds: [],
    });
  }
  if (geneses.filter((g) => g.isActive).length > 1) {
    issues.push({
      severity: 'warning',
      code: 'MULTIPLE_ACTIVE_GENESIS',
      message: 'More than one Genesis is marked active. The first one will be used.',
      nodeIds: geneses.filter((g) => g.isActive).map((g) => g.id),
    });
  }

  for (const n of nodes) {
    for (const raw of n.dependsOn ?? []) {
      const pid = depId(raw);
      if (pid === n.id) {
        issues.push({
          severity: 'error',
          code: 'SELF_DEPENDENCY',
          message: `"${n.name}" depends on itself.`,
          nodeIds: [n.id],
        });
      } else if (!seenIds.has(pid)) {
        issues.push({
          severity: 'error',
          code: 'MISSING_DEPENDENCY',
          message: `"${n.name}" depends on a node that no longer exists (${pid}).`,
          nodeIds: [n.id],
        });
      }
    }
  }

  const cycle = findCycle(nodes);
  if (cycle) {
    const names = cycle
      .map((id) => nodes.find((n) => n.id === id)?.name ?? id)
      .join(' → ');
    issues.push({
      severity: 'error',
      code: 'CYCLE',
      message: `Circular dependency: ${names}. Nothing in this loop can ever start.`,
      nodeIds: cycle,
    });
  }

  // Orphan detection is only meaningful once we know the graph is sane.
  const root = activeGenesis(plan);
  if (root && !cycle) {
    const reachable = reachableFrom(nodes, root.id);
    for (const n of nodes) {
      if (isNote(n) || isGenesis(n)) continue;
      if (!reachable.has(n.id)) {
        issues.push({
          severity: 'warning',
          code: 'ORPHANED',
          message: `"${n.name}" is not connected to the active Genesis, so it is excluded from the simulation.`,
          nodeIds: [n.id],
        });
      }
    }
  }

  return issues;
}

export const hasBlockingIssue = (issues: GraphIssue[]) => issues.some((i) => i.severity === 'error');
