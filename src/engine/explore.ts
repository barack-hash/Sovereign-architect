/**
 * The permutation explorer.
 *
 * This is the module that answers the actual question: given everything I could
 * do, the order I could do it in, and the fact that a day only has 24 hours —
 * which plan is best, and what does each one cost me?
 *
 * How it works
 * ------------
 * Two degrees of freedom are searched:
 *
 *   1. WHICH tasks to include. Tasks flagged `optional` may be dropped. Dropping
 *      a task also drops everything downstream of it, because a plan that skips
 *      a prerequisite and keeps its dependent is not a plan.
 *
 *   2. WHEN to start them. Rather than enumerating topological orderings (which
 *      is factorial and mostly produces near-identical plans), the explorer runs
 *      a resource-constrained serial scheduler under a set of priority rules —
 *      do the cheapest first, the shortest first, the highest-earning first, the
 *      gentlest first, and so on — plus a bounded number of seeded random
 *      orderings to catch combinations the heuristics miss.
 *
 * Each candidate is then run through the real simulator and scored on every
 * axis. Results come back as a ranked list plus the Pareto front: the set of
 * plans where nothing else is better on every axis at once. Anything not on that
 * front is strictly worse than something else and can be discarded honestly.
 */

import type { Plan, TaskNode } from './types';
import { isTask } from './types';
import { buildAdjacency, descendantsOf, topologicalOrder } from './graph';
import { computeSchedule } from './schedule';
import { simulate, type Modifiers, type SimulationResult } from './simulate';
import { createRng, hashSeed } from './rng';
import { num, toDaily } from './units';
import { activeGenesis } from './graph';

// ---------------------------------------------------------------------------
// Priority rules
// ---------------------------------------------------------------------------

export type PriorityRule =
  | 'asap'
  | 'shortest-first'
  | 'cheapest-first'
  | 'highest-income-first'
  | 'critical-first'
  | 'gentlest-first'
  | 'time-freeing-first'
  | 'random';

export const PRIORITY_RULE_LABELS: Record<PriorityRule, string> = {
  asap: 'As early as possible',
  'shortest-first': 'Quick wins first',
  'cheapest-first': 'Cheapest first',
  'highest-income-first': 'Highest earning first',
  'critical-first': 'Critical path first',
  'gentlest-first': 'Lowest strain first',
  'time-freeing-first': 'Free up time first',
  random: 'Randomised order',
};

/**
 * Comparators return a sort key; lower sorts earlier. Every rule falls back to
 * the node's index in the plan, so ordering is stable and runs are reproducible.
 */
const RULE_KEYS: Record<Exclude<PriorityRule, 'random'>, (t: TaskNode, slack: number) => number> = {
  asap: () => 0,
  'shortest-first': (t) => num(t.durationMonths, 1),
  'cheapest-first': (t) => num(t.immediateCost),
  'highest-income-first': (t) => -(num(t.ongoingIncome) * 12 + num(t.immediateIncome)),
  'critical-first': (_t, slack) => slack,
  'gentlest-first': (t) => -(num(t.emotionalImpactWhileActive) - num(t.hoursPerDayWhileActive)),
  'time-freeing-first': (t) => -num(t.hoursPerDayReclaimed),
};

// ---------------------------------------------------------------------------
// Options and results
// ---------------------------------------------------------------------------

export interface ExploreOptions {
  /** Which rules to try. Defaults to all deterministic rules. */
  rules?: PriorityRule[];
  /** How many extra randomised orderings to sample. */
  randomSamples?: number;
  /** Cap on how many optional-task subsets to evaluate. */
  maxSubsets?: number;
  /** Seed for the randomised orderings and subset sampling. */
  seed?: number;
  /** Stress modifiers applied identically to every candidate, for fair comparison. */
  modifiers?: Modifiers;
  /** Weights used to compute the single headline score. */
  weights?: ScoreWeights;
  /** How many ranked variants to return. */
  limit?: number;
  /**
   * Refuse to start a task the plan cannot afford at that moment. Realistic,
   * and usually the thing that separates a plan from a wish.
   */
  respectCashOnHand?: boolean;
}

/**
 * What you care about, from 0 (irrelevant) to 1 (dominant). These are the
 * tradeoff dials — changing them changes which plan wins, which is the point.
 */
export interface ScoreWeights {
  speed: number;
  wealth: number;
  health: number;
  relational: number;
  spiritual: number;
  safety: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  speed: 1,
  wealth: 1,
  health: 1,
  relational: 0.75,
  spiritual: 0.75,
  safety: 1,
};

export interface Variant {
  id: string;
  rule: PriorityRule;
  ruleLabel: string;
  /**
   * Human-readable name that distinguishes this variant from its siblings.
   * Several priority rules often converge on the same schedule for a given
   * subset, so the rule name alone is not enough to tell two rows apart — what
   * actually differs is usually which optional work was dropped.
   */
  label: string;
  /** Optional tasks left out of this variant. */
  omitted: string[];
  omittedNames: string[];
  /** Task id -> elapsed months before it starts. */
  startMonths: Record<string, number>;
  result: SimulationResult;
  metrics: VariantMetrics;
  /** 0..1, higher is better, computed from the active weights. */
  score: number;
  /** True when no other variant beats this one on every axis simultaneously. */
  onParetoFront: boolean;
}

export interface VariantMetrics {
  /** Month every objective is met, or null. */
  completionMonth: number | null;
  objectivesMet: number;
  objectivesTotal: number;
  finalNetWorth: number;
  troughNetWorth: number;
  minEmotional: number;
  minRelational: number;
  minSpiritual: number;
  minFreeHours: number;
  criticalViolations: number;
  warningViolations: number;
  monthsInsolvent: number;
  peakDebt: number;
}

export interface ExploreResult {
  variants: Variant[];
  paretoFront: Variant[];
  /** Highest weighted score. */
  best: Variant | null;
  /** The single best variant on each individual axis. */
  bestBy: {
    speed: Variant | null;
    wealth: Variant | null;
    health: Variant | null;
    relational: Variant | null;
    spiritual: Variant | null;
    safety: Variant | null;
  };
  /** Total candidates generated, before dedupe and the `limit` cut. */
  evaluated: number;
  /** Set when the search space was larger than the caps and had to be sampled. */
  truncated: boolean;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Resource-constrained serial scheduler
// ---------------------------------------------------------------------------

interface SchedulerContext {
  tasks: TaskNode[];
  byId: Map<string, TaskNode>;
  predecessors: Map<string, string[]>;
  slack: Map<string, number>;
  baselineHours: number;
  baselineIncome: number;
  baselineExpenses: number;
  dailyHours: number;
  horizon: number;
  /** Nodes that are not tasks (genesis, objectives) resolve their finish here. */
  nonTaskFinish: Map<string, number>;
  initialCash: number;
}

/**
 * Greedy serial scheduling: walk forward month by month, and at each step start
 * every eligible task the budget can absorb, in the order the rule dictates.
 *
 * "Budget" means daily hours, and optionally cash on hand. Cash here is tracked
 * with a light ledger (baseline flows plus completed tasks' recurring effects)
 * rather than the full simulation — it is a gate for scheduling decisions, and
 * the real simulator afterwards reports what actually happens.
 */
function scheduleTasks(
  ctx: SchedulerContext,
  rule: PriorityRule,
  omit: Set<string>,
  seed: number,
  respectCash: boolean,
): Map<string, number> {
  const rng = createRng(seed);
  const starts = new Map<string, number>();
  const finishes = new Map<string, number>(ctx.nonTaskFinish);

  const pending = new Set(ctx.tasks.filter((t) => !omit.has(t.id)).map((t) => t.id));
  const running: Array<{ id: string; finish: number; hours: number }> = [];

  let cash = ctx.initialCash;
  let recurringIncome = 0;
  let recurringCost = 0;
  let reclaimedHours = 0;

  // A generous tail lets tasks that cannot fit inside the horizon still receive
  // a start month, so the simulator reports them as unmet rather than silently
  // vanishing.
  const limit = ctx.horizon * 3 + ctx.tasks.length;

  for (let month = 1; month <= limit && pending.size > 0; month++) {
    // Retire anything that finished at the end of last month.
    for (let i = running.length - 1; i >= 0; i--) {
      if (running[i].finish < month) {
        const task = ctx.byId.get(running[i].id)!;
        recurringIncome += num(task.ongoingIncome);
        recurringCost += num(task.ongoingCost);
        reclaimedHours += num(task.hoursPerDayReclaimed);
        cash += num(task.immediateIncome);
        running.splice(i, 1);
      }
    }

    cash += ctx.baselineIncome + recurringIncome - ctx.baselineExpenses - recurringCost;

    let usedHours =
      ctx.baselineHours + running.reduce((sum, r) => sum + r.hours, 0) - reclaimedHours;

    // Eligible = every prerequisite finished, and past its earliest start.
    const eligible = [...pending].filter((id) => {
      const task = ctx.byId.get(id)!;
      if (num(task.earliestStartMonth) > month - 1) return false;
      return (ctx.predecessors.get(id) ?? []).every((p) => {
        if (omit.has(p)) return false;
        const f = finishes.get(p);
        return f !== undefined && f < month;
      });
    });

    const ordered =
      rule === 'random'
        ? rng.shuffle(eligible)
        : [...eligible].sort((a, b) => {
            const keyFn = RULE_KEYS[rule];
            const ka = keyFn(ctx.byId.get(a)!, ctx.slack.get(a) ?? 0);
            const kb = keyFn(ctx.byId.get(b)!, ctx.slack.get(b) ?? 0);
            if (ka !== kb) return ka - kb;
            return a.localeCompare(b);
          });

    for (const id of ordered) {
      const task = ctx.byId.get(id)!;
      const hours = num(task.hoursPerDayWhileActive);
      const cost = num(task.immediateCost);

      if (usedHours + hours > ctx.dailyHours) continue;
      if (respectCash && cost > 0 && cash - cost < 0) continue;

      const start = month - 1;
      const finish = start + Math.max(1, num(task.durationMonths, 1));

      starts.set(id, start);
      finishes.set(id, finish);
      running.push({ id, finish, hours });
      pending.delete(id);
      usedHours += hours;
      cash -= cost;

      // Resolve any non-task node whose prerequisites are now all scheduled.
      resolveMilestones(ctx, finishes, omit);
    }
  }

  // Anything still pending could never be scheduled — park it beyond the horizon.
  for (const id of pending) starts.set(id, ctx.horizon + 1);

  return starts;
}

/** Objectives and Genesis have no duration; they finish when their inputs do. */
function resolveMilestones(
  ctx: SchedulerContext,
  finishes: Map<string, number>,
  omit: Set<string>,
): void {
  for (const [id] of ctx.nonTaskFinish) {
    if (finishes.get(id) !== undefined && finishes.get(id)! < Infinity) continue;
    const preds = ctx.predecessors.get(id) ?? [];
    if (preds.length === 0) {
      finishes.set(id, 0);
      continue;
    }
    if (preds.some((p) => omit.has(p) || finishes.get(p) === undefined)) continue;
    finishes.set(id, Math.max(...preds.map((p) => finishes.get(p)!)));
  }
}

function buildContext(plan: Plan): SchedulerContext {
  const genesis = activeGenesis(plan);
  const schedule = computeSchedule(plan);
  const relevant = plan.nodes.filter((n) => n.kind !== 'note');
  const { predecessors } = buildAdjacency(relevant);

  const tasks = plan.nodes.filter(isTask);
  const byId = new Map(tasks.map((t) => [t.id, t]));

  const slack = new Map<string, number>();
  for (const t of tasks) slack.set(t.id, schedule.nodes.get(t.id)?.totalSlack ?? 0);

  let baselineHours = 0;
  let baselineIncome = 0;
  let baselineExpenses = 0;

  for (const line of genesis?.ledger ?? []) {
    const value = num(line.value);
    if (line.kind === 'time') baselineHours += toDaily(value, line.frequency);
    else if (line.kind === 'income') baselineIncome += value * monthlyFactor(line.frequency);
    else if (line.kind === 'expense') baselineExpenses += value * monthlyFactor(line.frequency);
  }

  // Non-task scheduled nodes start unresolved; Genesis is done at time zero.
  const nonTaskFinish = new Map<string, number>();
  for (const n of relevant) {
    if (n.kind === 'genesis') nonTaskFinish.set(n.id, 0);
    else if (n.kind === 'objective') nonTaskFinish.set(n.id, Infinity);
  }

  return {
    tasks,
    byId,
    predecessors,
    slack,
    baselineHours,
    baselineIncome,
    baselineExpenses,
    dailyHours: num(genesis?.dailyHours, 24) || 24,
    horizon: Math.max(1, Math.round(num(plan.horizonMonths, 12))),
    nonTaskFinish,
    initialCash: num(genesis?.initialCash),
  };
}

const monthlyFactor = (freq: string): number => {
  switch (freq) {
    case 'daily':
      return 30.4375;
    case 'weekly':
      return 4.348;
    case 'biweekly':
      return 2.174;
    case 'yearly':
      return 1 / 12;
    default:
      return 1;
  }
};

// ---------------------------------------------------------------------------
// Subset generation
// ---------------------------------------------------------------------------

/**
 * Every combination of optional tasks worth trying. Dropping a task also drops
 * its dependents — otherwise the resulting "plan" contains work that can never
 * start, which would score as trivially fast and mislead the ranking.
 */
function generateSubsets(plan: Plan, maxSubsets: number, seed: number): { subsets: Set<string>[]; truncated: boolean } {
  const optional = plan.nodes.filter(isTask).filter((t) => t.optional);

  if (optional.length === 0) return { subsets: [new Set<string>()], truncated: false };

  const total = Math.pow(2, optional.length);
  const exhaustive = total <= maxSubsets;
  const seen = new Set<string>();
  const subsets: Set<string>[] = [];
  const rng = createRng(seed);

  const addSubset = (dropIndices: number[]) => {
    const omit = new Set<string>();
    for (const i of dropIndices) {
      omit.add(optional[i].id);
      // Everything downstream goes too.
      for (const d of descendantsOf(plan.nodes, optional[i].id)) omit.add(d);
    }
    // Objectives are goals, not work — never drop them, or the plan trivially "wins".
    for (const n of plan.nodes) {
      if (n.kind === 'objective' || n.kind === 'genesis') omit.delete(n.id);
    }

    const key = [...omit].sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    subsets.push(omit);
  };

  if (exhaustive) {
    for (let mask = 0; mask < total; mask++) {
      const drops: number[] = [];
      for (let i = 0; i < optional.length; i++) if (mask & (1 << i)) drops.push(i);
      addSubset(drops);
    }
  } else {
    // Always include "keep everything" and each single-drop, then sample.
    addSubset([]);
    for (let i = 0; i < optional.length; i++) addSubset([i]);
    while (subsets.length < maxSubsets) {
      const drops = optional.map((_, i) => i).filter(() => rng.chance(0.4));
      addSubset(drops);
      if (subsets.length > maxSubsets * 4) break; // guard against pathological dedupe
    }
  }

  return { subsets, truncated: !exhaustive };
}

/** "Cheapest first, skipping Freelance" — the rule plus what it left out. */
function buildLabel(ruleLabel: string, omittedNames: string[]): string {
  if (omittedNames.length === 0) return `${ruleLabel}, doing everything`;
  if (omittedNames.length <= 2) return `${ruleLabel}, skipping ${omittedNames.join(' and ')}`;
  return `${ruleLabel}, skipping ${omittedNames.length} items`;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function collectMetrics(result: SimulationResult): VariantMetrics {
  const body = result.months.slice(1);
  return {
    completionMonth: result.completionMonth,
    objectivesMet: result.objectives.filter((o) => o.satisfiedMonth !== null).length,
    objectivesTotal: result.objectives.length,
    finalNetWorth: result.finalNetWorth,
    troughNetWorth: result.troughNetWorth,
    minEmotional: result.minEmotional,
    minRelational: result.minRelational,
    minSpiritual: result.minSpiritual,
    minFreeHours: result.minFreeHours,
    criticalViolations: result.violations.filter((v) => v.severity === 'critical').length,
    warningViolations: result.violations.filter((v) => v.severity === 'warning').length,
    monthsInsolvent: body.filter((s) => s.isInsolvent).length,
    peakDebt: body.length ? Math.max(...body.map((s) => s.debt)) : 0,
  };
}

/** Normalises a raw metric into 0..1 across the candidate set, higher = better. */
function normaliser(values: number[], higherIsBetter: boolean) {
  const finite = values.filter(Number.isFinite);
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : 0;
  const span = max - min;

  return (v: number): number => {
    if (!Number.isFinite(v)) return higherIsBetter ? 0 : 0;
    if (span === 0) return 1;
    const t = (v - min) / span;
    return higherIsBetter ? t : 1 - t;
  };
}

/** The six axes, expressed so that higher is always better. */
function axisValues(m: VariantMetrics, horizon: number) {
  return {
    // Unmet objectives are worse than any late completion, hence the penalty.
    speed: m.completionMonth === null ? -(horizon * 2) : -m.completionMonth,
    wealth: m.finalNetWorth,
    health: m.minEmotional,
    relational: m.minRelational,
    spiritual: m.minSpiritual,
    safety: -(m.criticalViolations * 10 + m.warningViolations + m.monthsInsolvent * 5),
  };
}

type Axis = keyof ReturnType<typeof axisValues>;
const AXES: Axis[] = ['speed', 'wealth', 'health', 'relational', 'spiritual', 'safety'];

/** A dominates B when it is at least as good everywhere and strictly better somewhere. */
function dominates(a: Record<Axis, number>, b: Record<Axis, number>): boolean {
  let strictlyBetter = false;
  for (const axis of AXES) {
    if (a[axis] < b[axis]) return false;
    if (a[axis] > b[axis]) strictlyBetter = true;
  }
  return strictlyBetter;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function explore(plan: Plan, options: ExploreOptions = {}): ExploreResult {
  const notes: string[] = [];
  const weights = { ...DEFAULT_WEIGHTS, ...(options.weights ?? {}) };
  const seed = options.seed ?? hashSeed(plan.id || plan.name || 'sovereign');
  const limit = options.limit ?? 24;
  const maxSubsets = options.maxSubsets ?? 64;
  const randomSamples = options.randomSamples ?? 6;
  const respectCash = options.respectCashOnHand ?? true;

  const rules: PriorityRule[] =
    options.rules ??
    (['asap', 'critical-first', 'shortest-first', 'cheapest-first', 'highest-income-first', 'gentlest-first', 'time-freeing-first'] as PriorityRule[]);

  const emptyResult: ExploreResult = {
    variants: [],
    paretoFront: [],
    best: null,
    bestBy: { speed: null, wealth: null, health: null, relational: null, spiritual: null, safety: null },
    evaluated: 0,
    truncated: false,
    notes,
  };

  if (!activeGenesis(plan)) {
    notes.push('No Genesis node, so there is nothing to explore from.');
    return emptyResult;
  }
  if (!topologicalOrder(plan.nodes.filter((n) => n.kind !== 'note'))) {
    notes.push('The dependency graph contains a cycle. Resolve it before exploring.');
    return emptyResult;
  }
  if (plan.nodes.filter(isTask).length === 0) {
    notes.push('No tasks on the canvas, so every plan is identical.');
    return emptyResult;
  }

  const ctx = buildContext(plan);
  const { subsets, truncated } = generateSubsets(plan, maxSubsets, seed);

  if (truncated) {
    const optionalCount = plan.nodes.filter(isTask).filter((t) => t.optional).length;
    notes.push(
      `${optionalCount} optional tasks means ${Math.pow(2, optionalCount).toLocaleString()} possible combinations; ${subsets.length} were sampled.`,
    );
  }

  const baseSchedule = computeSchedule(plan);
  const candidates: Variant[] = [];
  const seenSignatures = new Set<string>();
  let evaluated = 0;

  for (const omit of subsets) {
    const attempts: Array<{ rule: PriorityRule; seed: number }> = rules.map((rule) => ({ rule, seed }));
    for (let i = 0; i < randomSamples; i++) {
      attempts.push({ rule: 'random', seed: seed + i * 7919 + omit.size * 104729 });
    }

    for (const attempt of attempts) {
      const startMonths = scheduleTasks(ctx, attempt.rule, omit, attempt.seed, respectCash);
      evaluated++;

      // Two rules that produce the same schedule produce the same plan; keep one.
      const signature =
        [...omit].sort().join('|') +
        '::' +
        [...startMonths.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([id, m]) => `${id}@${m}`)
          .join(',');

      if (seenSignatures.has(signature)) continue;
      seenSignatures.add(signature);

      const result = simulate(plan, {
        schedule: baseSchedule,
        omit,
        startOverride: startMonths,
        modifiers: options.modifiers,
      });

      const omittedNames = [...omit].map((id) => plan.nodes.find((n) => n.id === id)?.name ?? id);

      candidates.push({
        id: `${attempt.rule}-${candidates.length}`,
        rule: attempt.rule,
        ruleLabel: PRIORITY_RULE_LABELS[attempt.rule],
        label: buildLabel(PRIORITY_RULE_LABELS[attempt.rule], omittedNames),
        omitted: [...omit],
        omittedNames,
        startMonths: Object.fromEntries(startMonths),
        result,
        metrics: collectMetrics(result),
        score: 0,
        onParetoFront: false,
      });
    }
  }

  if (candidates.length === 0) {
    notes.push('No schedulable variants were produced.');
    return { ...emptyResult, evaluated };
  }

  // ---- Score across the candidate set -------------------------------------
  const horizon = ctx.horizon;
  const axisMatrix = candidates.map((c) => axisValues(c.metrics, horizon));

  const normalisers: Record<Axis, (v: number) => number> = {
    speed: normaliser(axisMatrix.map((a) => a.speed), true),
    wealth: normaliser(axisMatrix.map((a) => a.wealth), true),
    health: normaliser(axisMatrix.map((a) => a.health), true),
    relational: normaliser(axisMatrix.map((a) => a.relational), true),
    spiritual: normaliser(axisMatrix.map((a) => a.spiritual), true),
    safety: normaliser(axisMatrix.map((a) => a.safety), true),
  };

  const weightTotal = AXES.reduce((sum, axis) => sum + Math.max(0, weights[axis]), 0) || 1;

  candidates.forEach((candidate, i) => {
    const axes = axisMatrix[i];
    candidate.score =
      AXES.reduce((sum, axis) => sum + normalisers[axis](axes[axis]) * Math.max(0, weights[axis]), 0) /
      weightTotal;
  });

  // ---- Pareto front --------------------------------------------------------
  candidates.forEach((candidate, i) => {
    candidate.onParetoFront = !candidates.some(
      (_, j) => j !== i && dominates(axisMatrix[j], axisMatrix[i]),
    );
  });

  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  const paretoFront = ranked.filter((c) => c.onParetoFront);

  const bestOn = (axis: Axis): Variant | null => {
    let best: Variant | null = null;
    let bestValue = -Infinity;
    candidates.forEach((candidate, i) => {
      if (axisMatrix[i][axis] > bestValue) {
        bestValue = axisMatrix[i][axis];
        best = candidate;
      }
    });
    return best;
  };

  if (ranked.every((r) => r.metrics.completionMonth === null)) {
    notes.push(
      'No ordering reaches every objective inside the horizon. Extend the horizon, lower a target, or add income.',
    );
  }

  return {
    variants: ranked.slice(0, limit),
    paretoFront: paretoFront.slice(0, limit),
    best: ranked[0] ?? null,
    bestBy: {
      speed: bestOn('speed'),
      wealth: bestOn('wealth'),
      health: bestOn('health'),
      relational: bestOn('relational'),
      spiritual: bestOn('spiritual'),
      safety: bestOn('safety'),
    },
    evaluated,
    truncated,
    notes,
  };
}
