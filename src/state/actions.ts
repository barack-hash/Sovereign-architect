/**
 * Plan mutations.
 *
 * Each function mutates a draft `Plan` in place and is called from inside
 * `update(draft => ...)`. Keeping them here rather than inline in components
 * means the rules — a dependency edge must not create a cycle, deleting a node
 * must clean up the edges pointing at it — live in one place and cannot drift
 * between the canvas and the terminal view.
 */

import {
  createGenesis,
  createLedgerLine,
  createNote,
  createObjective,
  createTask,
  isGenesis,
  isTask,
  wouldCreateCycle,
  type Constraint,
  type LedgerLine,
  type NodeKind,
  type ObjectiveNode,
  type Plan,
  type PlanNode,
  type TaskNode,
} from '../engine';

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

export function addNode(
  draft: Plan,
  kind: NodeKind,
  position?: { x: number; y: number },
): PlanNode {
  const node: PlanNode =
    kind === 'genesis'
      ? createGenesis({ position, isActive: false, name: 'Alternate start' })
      : kind === 'objective'
        ? createObjective({ position })
        : kind === 'note'
          ? createNote({ position })
          : createTask({ position });

  draft.nodes.push(node);
  return node;
}

export function updateNode(draft: Plan, id: string, patch: Partial<PlanNode>): void {
  const index = draft.nodes.findIndex((n) => n.id === id);
  if (index === -1) return;
  // `kind` is structural; changing it would invalidate every other field.
  const { kind: _ignored, ...safe } = patch as any;
  draft.nodes[index] = { ...draft.nodes[index], ...safe };
}

export function deleteNode(draft: Plan, id: string): void {
  draft.nodes = draft.nodes
    .filter((n) => n.id !== id)
    .map((n) => ({
      ...n,
      dependsOn: n.dependsOn.filter((d) => d.id !== id),
    }));
}

/** Exactly one Genesis may be active; activating one deactivates the rest. */
export function setActiveGenesis(draft: Plan, id: string): void {
  for (const node of draft.nodes) {
    if (isGenesis(node)) node.isActive = node.id === id;
  }
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

export interface ConnectResult {
  ok: boolean;
  reason?: string;
}

export function connectNodes(
  draft: Plan,
  sourceId: string,
  targetId: string,
  sourceHandle?: string,
  targetHandle?: string,
): ConnectResult {
  if (sourceId === targetId) return { ok: false, reason: 'A node cannot depend on itself.' };

  const target = draft.nodes.find((n) => n.id === targetId);
  const source = draft.nodes.find((n) => n.id === sourceId);
  if (!target || !source) return { ok: false, reason: 'One of those nodes no longer exists.' };

  if (target.dependsOn.some((d) => d.id === sourceId)) {
    return { ok: false, reason: 'That dependency already exists.' };
  }

  // Checked before mutating, so a rejected edge leaves the plan untouched.
  if (wouldCreateCycle(draft.nodes, sourceId, targetId)) {
    return {
      ok: false,
      reason: `"${source.name}" already depends on "${target.name}", so this would create a loop.`,
    };
  }

  if (target.kind === 'genesis') {
    return { ok: false, reason: 'Genesis is where the plan starts; nothing can come before it.' };
  }

  target.dependsOn.push({ id: sourceId, sourceHandle, targetHandle });
  return { ok: true };
}

export function disconnectNodes(draft: Plan, sourceId: string, targetId: string): void {
  const target = draft.nodes.find((n) => n.id === targetId);
  if (!target) return;
  target.dependsOn = target.dependsOn.filter((d) => d.id !== sourceId);
}

// ---------------------------------------------------------------------------
// Genesis ledger
// ---------------------------------------------------------------------------

export function addLedgerLine(draft: Plan, genesisId: string, overrides: Partial<LedgerLine> = {}) {
  const genesis = draft.nodes.find((n) => n.id === genesisId);
  if (!genesis || !isGenesis(genesis)) return;
  genesis.ledger.push(createLedgerLine(overrides));
}

export function updateLedgerLine(
  draft: Plan,
  genesisId: string,
  lineId: string,
  patch: Partial<LedgerLine>,
) {
  const genesis = draft.nodes.find((n) => n.id === genesisId);
  if (!genesis || !isGenesis(genesis)) return;
  const index = genesis.ledger.findIndex((l) => l.id === lineId);
  if (index === -1) return;
  genesis.ledger[index] = { ...genesis.ledger[index], ...patch };
}

export function deleteLedgerLine(draft: Plan, genesisId: string, lineId: string) {
  const genesis = draft.nodes.find((n) => n.id === genesisId);
  if (!genesis || !isGenesis(genesis)) return;
  genesis.ledger = genesis.ledger.filter((l) => l.id !== lineId);
}

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------

export function addConstraint(draft: Plan, constraint: Constraint) {
  draft.constraints.push(constraint);
}

export function updateConstraint(draft: Plan, id: string, patch: Partial<Constraint>) {
  const index = draft.constraints.findIndex((c) => c.id === id);
  if (index === -1) return;
  draft.constraints[index] = { ...draft.constraints[index], ...patch };
}

export function deleteConstraint(draft: Plan, id: string) {
  draft.constraints = draft.constraints.filter((c) => c.id !== id);
}

// ---------------------------------------------------------------------------
// Applying an explored variant
// ---------------------------------------------------------------------------

/**
 * Commits a variant found by the explorer into the plan itself: each task's
 * chosen start becomes its earliest-start constraint, and omitted tasks are
 * removed. This is what turns "here is the best ordering" into an actual plan
 * you can execute, rather than a report you have to transcribe by hand.
 */
export function applyVariant(
  draft: Plan,
  startMonths: Record<string, number>,
  omitted: string[],
): void {
  const omitSet = new Set(omitted);
  draft.nodes = draft.nodes.filter((n) => !omitSet.has(n.id));

  for (const node of draft.nodes) {
    node.dependsOn = node.dependsOn.filter((d) => !omitSet.has(d.id));
    if (isTask(node) && startMonths[node.id] !== undefined) {
      node.earliestStartMonth = startMonths[node.id];
    }
  }
}

// ---------------------------------------------------------------------------
// Execution tracking
// ---------------------------------------------------------------------------

export function setTaskStatus(draft: Plan, id: string, status: TaskNode['status']) {
  const node = draft.nodes.find((n) => n.id === id);
  if (node && isTask(node)) node.status = status;
}

export function addTelemetry(
  draft: Plan,
  entry: { month: number; category: Plan['telemetry'][number]['category']; amount: number; description: string },
) {
  draft.telemetry.push({
    id: `tel_${Date.now().toString(36)}_${draft.telemetry.length}`,
    timestamp: Date.now(),
    ...entry,
  });
}

export function deleteTelemetry(draft: Plan, id: string) {
  draft.telemetry = draft.telemetry.filter((t) => t.id !== id);
}

// ---------------------------------------------------------------------------
// Convenience selectors used by several views
// ---------------------------------------------------------------------------

export const findNode = (plan: Plan, id: string | null) =>
  id ? (plan.nodes.find((n) => n.id === id) ?? null) : null;

export const tasksOf = (plan: Plan): TaskNode[] => plan.nodes.filter(isTask);

export const objectivesOf = (plan: Plan): ObjectiveNode[] =>
  plan.nodes.filter((n): n is ObjectiveNode => n.kind === 'objective');
