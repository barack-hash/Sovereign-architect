/**
 * Canonical domain model for the Deterministic Life Architect.
 *
 * There is exactly ONE source of truth: the `Plan`. Every number shown in the UI
 * is either a field of the Plan or something the engine derived from it. Nothing
 * in the UI keeps its own shadow copy of a value the engine also computes.
 */

// ---------------------------------------------------------------------------
// Capitals
// ---------------------------------------------------------------------------

/** The five capitals the system tracks. Financial is currency; the rest are 0-100 indices. */
export type Capital = 'financial' | 'temporal' | 'emotional' | 'relational' | 'spiritual';

/** Percentage-style capitals share a 0-100 scale and clamp identically. */
export const INDEX_CAPITALS = ['emotional', 'relational', 'spiritual'] as const;
export type IndexCapital = (typeof INDEX_CAPITALS)[number];

// ---------------------------------------------------------------------------
// Recurring ledger (used by Genesis to describe "life as it stands today")
// ---------------------------------------------------------------------------

export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export type LedgerKind = 'income' | 'expense' | 'time';

/**
 * What a block of time is *for*. Only meaningful on `kind: 'time'` lines, but
 * it is what makes the sleep / study / family / labour constraints checkable —
 * without it the engine sees an undifferentiated pile of hours.
 */
export type TimeCategory =
  | 'sleep'
  | 'work'
  | 'study'
  | 'family'
  | 'faith'
  | 'health'
  | 'maintenance'
  | 'leisure'
  | 'entropy'
  | 'other';

export const TIME_CATEGORIES: TimeCategory[] = [
  'sleep',
  'work',
  'study',
  'family',
  'faith',
  'health',
  'maintenance',
  'leisure',
  'entropy',
  'other',
];

export interface LedgerLine {
  id: string;
  label: string;
  kind: LedgerKind;
  /** Currency for income/expense; hours for time. Always expressed at `frequency`. */
  value: number;
  frequency: Frequency;
  /** Only consulted for `kind: 'time'`. */
  category: TimeCategory;
  /** Per-month drift on the emotional index while this line is in effect. */
  emotionalImpact: number;
  relationalImpact: number;
  spiritualImpact: number;
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

export type NodeKind = 'genesis' | 'task' | 'objective' | 'note';

export interface BaseNode {
  id: string;
  kind: NodeKind;
  name: string;
  /** IDs of nodes that must complete before this one may start. */
  dependsOn: Dependency[];
  /** Free-form canvas placement. Purely presentational; never affects the math. */
  position?: { x: number; y: number };
}

/**
 * A dependency edge. `sourceHandle`/`targetHandle` are presentational only —
 * they record which side of the node the user dragged from.
 */
export interface Dependency {
  id: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/**
 * Where you are today. A plan may hold several Genesis nodes (alternate starting
 * assumptions) but exactly one is active at a time.
 */
export interface GenesisNode extends BaseNode {
  kind: 'genesis';
  isActive: boolean;
  initialCash: number;
  initialDebt: number;
  /** Recurring income / expenses / time commitments already in your life. */
  ledger: LedgerLine[];
  initialEmotional: number;
  initialRelational: number;
  initialSpiritual: number;
  /** Hours in a day available to allocate. Realistically 24. */
  dailyHours: number;
}

/**
 * A unit of work: something you actually do, that takes time and has consequences.
 *
 * This is the node CPM operates on, which is why `durationMonths` exists — the
 * previous model only had a fixed `month`, and critical-path analysis over
 * zero-duration nodes is undefined.
 */
export interface TaskNode extends BaseNode {
  kind: 'task';
  /** How many months of elapsed effort this takes. Minimum 1. */
  durationMonths: number;
  /**
   * Earliest month this may begin regardless of prerequisites (e.g. "the lease
   * doesn't end until month 6"). 0 means "as soon as prerequisites allow".
   */
  earliestStartMonth: number;
  /** Hard deadline: the task must FINISH by this month. 0 means no deadline. */
  deadlineMonth: number;

  // --- Financial consequences ---
  /** One-off cash outflow, charged in the month the task starts. */
  immediateCost: number;
  /** One-off cash inflow, credited in the month the task completes. */
  immediateIncome: number;
  /** Recurring cost that begins on completion and persists for the rest of the horizon. */
  ongoingCost: number;
  /** Recurring income that begins on completion and persists for the rest of the horizon. */
  ongoingIncome: number;

  // --- Temporal consequences ---
  /** Hours per day this consumes *while in progress*. This is what creates contention. */
  hoursPerDayWhileActive: number;
  /** Hours per day permanently freed once complete (e.g. moving closer to work). */
  hoursPerDayReclaimed: number;

  // --- Index consequences ---
  /** Per-month drift on each index while the task is in progress (strain). */
  emotionalImpactWhileActive: number;
  relationalImpactWhileActive: number;
  spiritualImpactWhileActive: number;
  /** Per-month drift on each index after completion (payoff). */
  emotionalImpactAfter: number;
  relationalImpactAfter: number;
  spiritualImpactAfter: number;

  /**
   * Optional: mark a task as skippable so the permutation explorer may consider
   * plans that omit it. Tasks that others depend on are only dropped together
   * with their dependents.
   */
  optional: boolean;

  /** Execution tracking, used once the plan is live. */
  status: TaskStatus;
}

export type TaskStatus = 'pending' | 'active' | 'completed' | 'failed';

/**
 * A goal. Satisfied when every prerequisite has completed AND the capital
 * conditions hold. `deadlineMonth` is what makes it a *target* rather than a wish.
 */
export interface ObjectiveNode extends BaseNode {
  kind: 'objective';
  /** Net worth required. 0 disables the financial condition. */
  targetCapital: number;
  /** Month by which this should be met. 0 means "no deadline". */
  deadlineMonth: number;
  /** Minimum index levels that must hold at satisfaction. 0 disables each. */
  minEmotional: number;
  minRelational: number;
  minSpiritual: number;
  /** Ranks objectives when the explorer must trade one against another. */
  priority: number;
}

export interface NoteNode extends BaseNode {
  kind: 'note';
  content: string;
}

export type PlanNode = GenesisNode | TaskNode | ObjectiveNode | NoteNode;

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------

export type ConstraintType =
  | 'MIN_CASH' // net worth must not fall below threshold
  | 'MAX_BURN' // monthly expenses must not exceed threshold
  | 'MIN_EMOTIONAL'
  | 'MIN_RELATIONAL'
  | 'MIN_SPIRITUAL'
  | 'MIN_SLEEP' // reserved daily hours that may never be allocated away
  | 'MAX_LABOR' // ceiling on daily hours spent on active tasks
  | 'MIN_FREE_HOURS' // daily hours that must remain unallocated
  | 'MIN_STUDY_HOURS' // weekly hours that must remain committed to study
  | 'MIN_FAMILY_HOURS'; // weekly hours that must remain committed to family

export type Severity = 'warning' | 'critical';

export interface Constraint {
  id: string;
  type: ConstraintType;
  threshold: number;
  severity: Severity;
  enabled: boolean;
  label?: string;
}

export interface Violation {
  constraintId: string;
  type: ConstraintType;
  severity: Severity;
  month: number;
  message: string;
  /** The value that breached, and what it needed to be. */
  actual: number;
  threshold: number;
}

// ---------------------------------------------------------------------------
// Assumptions — the knobs that shape the world, separate from the graph
// ---------------------------------------------------------------------------

export interface Assumptions {
  /** Annual return on invested net worth, percent. */
  annualYieldPct: number;
  /** Annual inflation applied to recurring expenses, percent. */
  annualInflationPct: number;
  /**
   * Fraction of positive net worth actually invested (rest sits in cash).
   * 0..1. Prevents the old bug of compounding yield onto debt.
   */
  investedFraction: number;
  /** Baseline monthly emotional decay before any task or ledger effects. */
  baselineEmotionalDrift: number;
  /** Baseline monthly relational drift. */
  baselineRelationalDrift: number;
  /** Baseline monthly spiritual drift. */
  baselineSpiritualDrift: number;
  /**
   * When emotional index sits below this, income is taxed by `burnoutIncomePenalty`.
   * This is the "burnout" feedback loop.
   */
  burnoutThreshold: number;
  /** Fractional income reduction while burned out. 0.2 = lose 20%. */
  burnoutIncomePenalty: number;
  /**
   * Emotional damage per hour per day of overallocation. Going over your
   * available hours is what actually breaks people, so it is modelled explicitly.
   */
  overloadEmotionalPenaltyPerHour: number;
  /** Annual interest charged on outstanding debt, percent. */
  annualDebtInterestPct: number;
  /** Whether a positive monthly surplus is applied against debt automatically. */
  autoPayDebtFromSurplus: boolean;
  /** Cash held back before any surplus goes to debt paydown. */
  cashReserve: number;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  annualYieldPct: 7,
  annualInflationPct: 3,
  investedFraction: 0.7,
  baselineEmotionalDrift: -0.5,
  baselineRelationalDrift: -0.5,
  baselineSpiritualDrift: -0.5,
  burnoutThreshold: 30,
  burnoutIncomePenalty: 0.2,
  overloadEmotionalPenaltyPerHour: 3,
  annualDebtInterestPct: 18,
  autoPayDebtFromSurplus: true,
  cashReserve: 0,
};

// ---------------------------------------------------------------------------
// Telemetry — what actually happened, for plan-vs-reality comparison
// ---------------------------------------------------------------------------

export type TelemetryCategory = 'expense' | 'income' | 'timeInvested' | 'timeWasted';

export interface TelemetryEntry {
  id: string;
  timestamp: number;
  month: number;
  category: TelemetryCategory;
  amount: number;
  description: string;
}

// ---------------------------------------------------------------------------
// The Plan
// ---------------------------------------------------------------------------

export interface Plan {
  id: string;
  name: string;
  /** Schema version, for migrations. */
  version: number;
  /** How many months forward to simulate. */
  horizonMonths: number;
  nodes: PlanNode[];
  constraints: Constraint[];
  assumptions: Assumptions;
  telemetry: TelemetryEntry[];
  /** The month "today" maps to, used to split plan from reality. */
  currentMonth: number;
}

export const PLAN_SCHEMA_VERSION = 2;

// ---------------------------------------------------------------------------
// Narrow helpers — kind guards used everywhere downstream
// ---------------------------------------------------------------------------

export const isGenesis = (n: PlanNode): n is GenesisNode => n.kind === 'genesis';
export const isTask = (n: PlanNode): n is TaskNode => n.kind === 'task';
export const isObjective = (n: PlanNode): n is ObjectiveNode => n.kind === 'objective';
export const isNote = (n: PlanNode): n is NoteNode => n.kind === 'note';

/** Nodes that participate in scheduling. Notes are annotations and never do. */
export const isScheduled = (n: PlanNode): n is TaskNode | ObjectiveNode | GenesisNode =>
  n.kind === 'task' || n.kind === 'objective' || n.kind === 'genesis';
