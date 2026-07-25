/**
 * The deterministic simulator.
 *
 * Given a Plan and a Schedule, walks month by month and produces the full state
 * of all five capitals at every step. Same inputs always produce the same
 * outputs — there is no randomness in here at all. Randomness lives in
 * `montecarlo.ts`, which drives this function with generated modifiers.
 *
 * Design notes
 * ------------
 * - Task effects are split into *while active* and *after completion*. A task
 *   that takes six months costs you time and strain for six months, then pays
 *   out. The old model fired everything in a single instant.
 * - Time is a hard budget. Overallocating is not merely flagged, it damages the
 *   emotional index, which taxes income, which slows the plan. That feedback
 *   loop is the whole point of tracking five capitals rather than one.
 * - Cash and debt are tracked separately so investment yield never compounds on
 *   money you do not have.
 */

import type { ObjectiveNode, Plan, TaskNode, TelemetryEntry, Violation } from './types';
import { isGenesis, isObjective, isTask } from './types';
import { activeGenesis } from './graph';
import { computeSchedule, type Schedule } from './schedule';
import { evaluateConstraints, type ConstraintInputs } from './constraints';
import { annualPctToMonthlyRate, clampIndex, num, toDaily, toMonthly, toWeekly } from './units';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Multiplicative and additive shocks applied on top of the plan. Stress tests
 * and Monte Carlo trials both express themselves through this one struct, so
 * there is a single place where "what if things go differently" is modelled.
 */
export interface Modifiers {
  costMultiplier: number;
  incomeMultiplier: number;
  yieldMultiplier: number;
  inflationMultiplier: number;
  /** Extra unplanned expense in month m (1-indexed array position m-1). */
  expenseShocks?: number[];
  /** Fractional income loss in month m, 0..1. */
  incomeShocks?: number[];
  /** Flat emotional hit in month m. */
  emotionalShocks?: number[];
}

export const NEUTRAL_MODIFIERS: Modifiers = {
  costMultiplier: 1,
  incomeMultiplier: 1,
  yieldMultiplier: 1,
  inflationMultiplier: 1,
};

export interface SimulateOptions {
  modifiers?: Modifiers;
  /** Precomputed schedule. Recomputed from the plan when omitted. */
  schedule?: Schedule;
  /** Task ids to leave out entirely — used by the permutation explorer. */
  omit?: Set<string>;
  /** Overrides a task's start month, for testing alternative orderings. */
  startOverride?: Map<string, number>;
  /** When true, telemetry is folded in for months at or before `plan.currentMonth`. */
  includeActuals?: boolean;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export type NodeRunStatus = 'locked' | 'ready' | 'active' | 'completed';

export interface MonthState {
  /** 1-indexed calendar month. Month 0 is the Genesis snapshot. */
  month: number;
  label: string;

  // Financial
  cash: number;
  debt: number;
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  investmentReturn: number;
  debtInterest: number;
  oneOffCosts: number;
  oneOffIncome: number;
  netCashFlow: number;

  // Temporal (all per-day unless stated)
  committedHours: number;
  freeHours: number;
  sleepHours: number;
  laborHours: number;
  studyHoursWeekly: number;
  familyHoursWeekly: number;
  isOverallocated: boolean;

  // Indices
  emotional: number;
  relational: number;
  spiritual: number;

  // Flags
  isBurnedOut: boolean;
  isInsolvent: boolean;

  // Graph state at this instant
  activeTaskIds: string[];
  startingTaskIds: string[];
  completingTaskIds: string[];
  nodeStatus: Record<string, NodeRunStatus>;
  satisfiedObjectiveIds: string[];
  objectiveProgress: Record<string, number>;

  violations: Violation[];

  // Reality overlay — undefined for months beyond `plan.currentMonth`
  actualNetWorth?: number;
  actualEmotional?: number;
}

export interface ObjectiveOutcome {
  id: string;
  name: string;
  /** Month the objective was satisfied, or null if never within the horizon. */
  satisfiedMonth: number | null;
  deadlineMonth: number;
  /** Positive when late; 0 when on time or no deadline. */
  lateBy: number;
  /** Highest progress fraction reached, 0..1. */
  peakProgress: number;
  targetCapital: number;
  blockedReason: string | null;
}

export interface SimulationResult {
  months: MonthState[];
  schedule: Schedule;
  objectives: ObjectiveOutcome[];
  violations: Violation[];

  // Headline summary, so the UI never recomputes these inconsistently.
  finalNetWorth: number;
  peakNetWorth: number;
  troughNetWorth: number;
  minEmotional: number;
  minRelational: number;
  minSpiritual: number;
  minFreeHours: number;
  /** First month net worth went negative, or null. */
  insolventMonth: number | null;
  /** True when every objective was satisfied inside the horizon. */
  allObjectivesMet: boolean;
  /** Month the last objective landed, or null if any went unmet. */
  completionMonth: number | null;
  omitted: string[];
}

// ---------------------------------------------------------------------------
// Genesis baseline
// ---------------------------------------------------------------------------

interface Baseline {
  income: number;
  expenses: number;
  dailyHours: number;
  sleepHours: number;
  laborHours: number;
  studyHoursWeekly: number;
  familyHoursWeekly: number;
  emotionalDrift: number;
  relationalDrift: number;
  spiritualDrift: number;
}

function computeBaseline(plan: Plan): Baseline {
  const genesis = activeGenesis(plan);
  const empty: Baseline = {
    income: 0,
    expenses: 0,
    dailyHours: 0,
    sleepHours: 0,
    laborHours: 0,
    studyHoursWeekly: 0,
    familyHoursWeekly: 0,
    emotionalDrift: 0,
    relationalDrift: 0,
    spiritualDrift: 0,
  };
  if (!genesis) return empty;

  const acc = { ...empty };

  for (const line of genesis.ledger ?? []) {
    const value = num(line.value);

    if (line.kind === 'income') {
      acc.income += toMonthly(value, line.frequency);
    } else if (line.kind === 'expense') {
      acc.expenses += toMonthly(value, line.frequency);
    } else if (line.kind === 'time') {
      const daily = toDaily(value, line.frequency);
      acc.dailyHours += daily;
      if (line.category === 'sleep') acc.sleepHours += daily;
      if (line.category === 'work') acc.laborHours += daily;
      if (line.category === 'study') acc.studyHoursWeekly += toWeekly(value, line.frequency);
      if (line.category === 'family') acc.familyHoursWeekly += toWeekly(value, line.frequency);
    }

    acc.emotionalDrift += num(line.emotionalImpact);
    acc.relationalDrift += num(line.relationalImpact);
    acc.spiritualDrift += num(line.spiritualImpact);
  }

  return acc;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function simulate(plan: Plan, options: SimulateOptions = {}): SimulationResult {
  const mods = { ...NEUTRAL_MODIFIERS, ...(options.modifiers ?? {}) };
  const omit = options.omit ?? new Set<string>();
  const schedule = options.schedule ?? computeSchedule(plan);
  const assumptions = plan.assumptions;
  const horizon = Math.max(1, Math.round(num(plan.horizonMonths, 12)));

  const genesis = activeGenesis(plan);
  const baseline = computeBaseline(plan);

  const tasks = plan.nodes.filter(isTask).filter((t) => schedule.nodes.has(t.id) && !omit.has(t.id));
  const objectives = plan.nodes.filter(isObjective).filter((o) => schedule.nodes.has(o.id));

  // Resolve each task's window once, honouring any explorer override.
  const windows = new Map<string, { start: number; finish: number }>();
  for (const t of tasks) {
    const s = schedule.nodes.get(t.id)!;
    const start = options.startOverride?.get(t.id) ?? s.earlyStart;
    windows.set(t.id, { start, finish: start + Math.max(1, num(t.durationMonths, 1)) });
  }

  const monthlyYield =
    annualPctToMonthlyRate(num(assumptions.annualYieldPct)) * mods.yieldMultiplier;
  const monthlyDebtRate = annualPctToMonthlyRate(num(assumptions.annualDebtInterestPct));
  const monthlyInflation = annualPctToMonthlyRate(
    num(assumptions.annualInflationPct) * mods.inflationMultiplier,
  );

  // Running state
  let cash = num(genesis?.initialCash);
  let debt = num(genesis?.initialDebt);
  let emotional = clampIndex(num(genesis?.initialEmotional, 100));
  let relational = clampIndex(num(genesis?.initialRelational, 100));
  let spiritual = clampIndex(num(genesis?.initialSpiritual, 100));
  const dailyHours = num(genesis?.dailyHours, 24) || 24;

  // Reality overlay runs the same ledger but substitutes logged actuals.
  let actualCash = cash;
  let actualDebt = debt;
  let actualEmotional = emotional;

  const satisfiedObjectives = new Map<string, number>();
  const peakProgress = new Map<string, number>();
  const allViolations: Violation[] = [];
  const months: MonthState[] = [];

  const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const labelFor = (m: number) => {
    if (m === 0) return 'GEN';
    const year = Math.floor((m - 1) / 12);
    const name = MONTH_NAMES[(m - 1) % 12];
    return year > 0 ? `${name}+${year}` : name;
  };

  // ---- Month 0: the Genesis snapshot --------------------------------------
  months.push({
    month: 0,
    label: labelFor(0),
    cash,
    debt,
    netWorth: cash - debt,
    monthlyIncome: baseline.income,
    monthlyExpenses: baseline.expenses,
    investmentReturn: 0,
    debtInterest: 0,
    oneOffCosts: 0,
    oneOffIncome: 0,
    netCashFlow: baseline.income - baseline.expenses,
    committedHours: baseline.dailyHours,
    freeHours: dailyHours - baseline.dailyHours,
    sleepHours: baseline.sleepHours,
    laborHours: baseline.laborHours,
    studyHoursWeekly: baseline.studyHoursWeekly,
    familyHoursWeekly: baseline.familyHoursWeekly,
    isOverallocated: baseline.dailyHours > dailyHours,
    emotional,
    relational,
    spiritual,
    isBurnedOut: false,
    isInsolvent: cash - debt < 0,
    activeTaskIds: [],
    startingTaskIds: [],
    completingTaskIds: [],
    nodeStatus: initialNodeStatus(plan, omit),
    satisfiedObjectiveIds: [],
    objectiveProgress: {},
    violations: [],
    actualNetWorth: options.includeActuals ? cash - debt : undefined,
    actualEmotional: options.includeActuals ? emotional : undefined,
  });

  let insolventMonth: number | null = null;

  // ---- Months 1..horizon ---------------------------------------------------
  for (let m = 1; m <= horizon; m++) {
    const shockExpense = num(mods.expenseShocks?.[m - 1]);
    const shockIncomeLoss = num(mods.incomeShocks?.[m - 1]);
    const shockEmotional = num(mods.emotionalShocks?.[m - 1]);

    // Which tasks are doing what this month.
    const starting: TaskNode[] = [];
    const active: TaskNode[] = [];
    const completing: TaskNode[] = [];
    const completed: TaskNode[] = [];

    for (const t of tasks) {
      const w = windows.get(t.id)!;
      if (w.start + 1 === m) starting.push(t);
      if (m > w.start && m <= w.finish) active.push(t);
      if (w.finish === m) completing.push(t);
      if (w.finish < m) completed.push(t);
    }

    // ---- Recurring flows --------------------------------------------------
    const inflationFactor = Math.pow(1 + monthlyInflation, m);

    // Recurring effects begin the month *after* completion, so a task finishing
    // this month contributes only its one-off income below.
    let income = baseline.income;
    for (const t of completed) income += num(t.ongoingIncome);
    income *= mods.incomeMultiplier;
    income *= 1 - Math.min(1, Math.max(0, shockIncomeLoss));

    const isBurnedOut = emotional < num(assumptions.burnoutThreshold);
    if (isBurnedOut) {
      income *= 1 - Math.min(1, Math.max(0, num(assumptions.burnoutIncomePenalty)));
    }

    let expenses = baseline.expenses;
    for (const t of completed) expenses += num(t.ongoingCost);
    expenses *= inflationFactor * mods.costMultiplier;
    expenses += shockExpense;

    // ---- One-off flows ----------------------------------------------------
    const oneOffCosts =
      starting.reduce((sum, t) => sum + num(t.immediateCost), 0) * mods.costMultiplier;
    const oneOffIncome =
      completing.reduce((sum, t) => sum + num(t.immediateIncome), 0) * mods.incomeMultiplier;

    // ---- Balance sheet ----------------------------------------------------
    const investmentReturn =
      Math.max(0, cash) * Math.min(1, Math.max(0, num(assumptions.investedFraction))) * monthlyYield;
    const debtInterest = debt * monthlyDebtRate;

    debt += debtInterest;
    cash += investmentReturn;

    const netCashFlow = income + oneOffIncome - expenses - oneOffCosts;
    cash += netCashFlow;

    if (assumptions.autoPayDebtFromSurplus && debt > 0 && netCashFlow > 0) {
      const spare = Math.max(0, Math.min(netCashFlow, cash - num(assumptions.cashReserve)));
      const payment = Math.min(spare, debt);
      cash -= payment;
      debt -= payment;
    }

    // A cash shortfall does not vanish; it becomes debt at the same rate.
    if (cash < 0) {
      debt += -cash;
      cash = 0;
    }

    const netWorth = cash - debt;
    if (netWorth < 0 && insolventMonth === null) insolventMonth = m;

    // ---- Time budget ------------------------------------------------------
    let committedHours = baseline.dailyHours;
    for (const t of active) committedHours += num(t.hoursPerDayWhileActive);
    for (const t of completed) committedHours -= num(t.hoursPerDayReclaimed);
    committedHours = Math.max(0, committedHours);

    const freeHours = dailyHours - committedHours;
    const isOverallocated = freeHours < 0;

    const laborHours =
      baseline.laborHours + active.reduce((sum, t) => sum + num(t.hoursPerDayWhileActive), 0);

    // ---- Indices ----------------------------------------------------------
    const overloadPenalty = isOverallocated
      ? Math.abs(freeHours) * num(assumptions.overloadEmotionalPenaltyPerHour)
      : 0;

    let emotionalDelta = num(assumptions.baselineEmotionalDrift) + baseline.emotionalDrift;
    let relationalDelta = num(assumptions.baselineRelationalDrift) + baseline.relationalDrift;
    let spiritualDelta = num(assumptions.baselineSpiritualDrift) + baseline.spiritualDrift;

    for (const t of active) {
      emotionalDelta += num(t.emotionalImpactWhileActive);
      relationalDelta += num(t.relationalImpactWhileActive);
      spiritualDelta += num(t.spiritualImpactWhileActive);
    }
    for (const t of completed) {
      emotionalDelta += num(t.emotionalImpactAfter);
      relationalDelta += num(t.relationalImpactAfter);
      spiritualDelta += num(t.spiritualImpactAfter);
    }

    emotional = clampIndex(emotional + emotionalDelta - overloadPenalty - shockEmotional);
    relational = clampIndex(relational + relationalDelta);
    spiritual = clampIndex(spiritual + spiritualDelta);

    // ---- Objectives -------------------------------------------------------
    const completedIds = new Set([...completed, ...completing].map((t) => t.id));
    const satisfiedThisMonth: string[] = [];
    const objectiveProgress: Record<string, number> = {};

    for (const obj of objectives) {
      if (satisfiedObjectives.has(obj.id)) {
        objectiveProgress[obj.id] = 1;
        continue;
      }

      const prereqsMet = (obj.dependsOn ?? []).every((d) => {
        const id = typeof d === 'string' ? d : d.id;
        const node = plan.nodes.find((n) => n.id === id);
        if (!node) return true;
        if (isGenesis(node)) return true;
        if (isTask(node)) return completedIds.has(id) || omit.has(id);
        if (isObjective(node)) return satisfiedObjectives.has(id);
        return true;
      });

      const capitalMet = num(obj.targetCapital) <= 0 || netWorth >= num(obj.targetCapital);
      const indicesMet =
        emotional >= num(obj.minEmotional) &&
        relational >= num(obj.minRelational) &&
        spiritual >= num(obj.minSpiritual);

      // Progress blends structural readiness with capital accumulation so the
      // bar moves for reasons the user can actually see.
      const capitalProgress =
        num(obj.targetCapital) > 0 ? Math.min(1, Math.max(0, netWorth / num(obj.targetCapital))) : 1;
      const progress = prereqsMet ? capitalProgress : capitalProgress * 0.5;
      objectiveProgress[obj.id] = progress;
      peakProgress.set(obj.id, Math.max(peakProgress.get(obj.id) ?? 0, progress));

      if (prereqsMet && capitalMet && indicesMet) {
        satisfiedObjectives.set(obj.id, m);
        satisfiedThisMonth.push(obj.id);
        objectiveProgress[obj.id] = 1;
        peakProgress.set(obj.id, 1);
      }
    }

    // ---- Constraints ------------------------------------------------------
    const snapshot: ConstraintInputs = {
      month: m,
      netWorth,
      monthlyExpenses: expenses + oneOffCosts,
      emotional,
      relational,
      spiritual,
      sleepHours: baseline.sleepHours,
      laborHours,
      freeHours,
      studyHoursWeekly: baseline.studyHoursWeekly,
      familyHoursWeekly: baseline.familyHoursWeekly,
    };
    const violations = evaluateConstraints(plan.constraints, snapshot);
    allViolations.push(...violations);

    // ---- Reality overlay --------------------------------------------------
    let actualNetWorth: number | undefined;
    let actualEmotionalOut: number | undefined;

    if (options.includeActuals && m <= num(plan.currentMonth)) {
      const logged = plan.telemetry.filter((t) => t.month === m);
      const actuals = summariseTelemetry(logged);

      const actualInvestment =
        Math.max(0, actualCash) *
        Math.min(1, Math.max(0, num(assumptions.investedFraction))) *
        monthlyYield;
      const actualDebtInterest = actualDebt * monthlyDebtRate;

      actualDebt += actualDebtInterest;
      actualCash += actualInvestment;
      actualCash += baseline.income + actuals.income - actuals.expenses;

      if (actualCash < 0) {
        actualDebt += -actualCash;
        actualCash = 0;
      }

      // Logged hours move health directly: invested time builds, wasted time costs.
      const timeEffect = actuals.timeInvested * 0.5 - actuals.timeWasted * 0.8;
      actualEmotional = clampIndex(
        actualEmotional + num(assumptions.baselineEmotionalDrift) + timeEffect,
      );

      actualNetWorth = actualCash - actualDebt;
      actualEmotionalOut = actualEmotional;
    }

    months.push({
      month: m,
      label: labelFor(m),
      cash,
      debt,
      netWorth,
      monthlyIncome: income,
      monthlyExpenses: expenses,
      investmentReturn,
      debtInterest,
      oneOffCosts,
      oneOffIncome,
      netCashFlow,
      committedHours,
      freeHours,
      sleepHours: baseline.sleepHours,
      laborHours,
      studyHoursWeekly: baseline.studyHoursWeekly,
      familyHoursWeekly: baseline.familyHoursWeekly,
      isOverallocated,
      emotional,
      relational,
      spiritual,
      isBurnedOut,
      isInsolvent: netWorth < 0,
      activeTaskIds: active.map((t) => t.id),
      startingTaskIds: starting.map((t) => t.id),
      completingTaskIds: completing.map((t) => t.id),
      nodeStatus: buildNodeStatus(plan, windows, satisfiedObjectives, m, omit),
      satisfiedObjectiveIds: [...satisfiedObjectives.keys()],
      objectiveProgress,
      violations,
      actualNetWorth,
      actualEmotional: actualEmotionalOut,
    });
  }

  // ---- Summary -------------------------------------------------------------
  const body = months.slice(1);
  const netWorths = body.map((s) => s.netWorth);

  const objectiveOutcomes: ObjectiveOutcome[] = objectives.map((obj) =>
    buildObjectiveOutcome(obj, plan, satisfiedObjectives, peakProgress, omit, schedule),
  );

  const allMet =
    objectiveOutcomes.length > 0 && objectiveOutcomes.every((o) => o.satisfiedMonth !== null);
  const completionMonth = allMet
    ? Math.max(...objectiveOutcomes.map((o) => o.satisfiedMonth!))
    : null;

  return {
    months,
    schedule,
    objectives: objectiveOutcomes,
    violations: allViolations,
    finalNetWorth: body.length ? body[body.length - 1].netWorth : cash - debt,
    peakNetWorth: netWorths.length ? Math.max(...netWorths) : cash - debt,
    troughNetWorth: netWorths.length ? Math.min(...netWorths) : cash - debt,
    minEmotional: body.length ? Math.min(...body.map((s) => s.emotional)) : emotional,
    minRelational: body.length ? Math.min(...body.map((s) => s.relational)) : relational,
    minSpiritual: body.length ? Math.min(...body.map((s) => s.spiritual)) : spiritual,
    minFreeHours: body.length ? Math.min(...body.map((s) => s.freeHours)) : dailyHours,
    insolventMonth,
    allObjectivesMet: allMet,
    completionMonth,
    omitted: [...omit],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function summariseTelemetry(entries: TelemetryEntry[]) {
  const acc = { expenses: 0, income: 0, timeInvested: 0, timeWasted: 0 };
  for (const e of entries) {
    const amount = num(e.amount);
    if (e.category === 'expense') acc.expenses += amount;
    else if (e.category === 'income') acc.income += amount;
    else if (e.category === 'timeInvested') acc.timeInvested += amount;
    else if (e.category === 'timeWasted') acc.timeWasted += amount;
  }
  return acc;
}

function initialNodeStatus(plan: Plan, omit: Set<string>): Record<string, NodeRunStatus> {
  const status: Record<string, NodeRunStatus> = {};
  for (const n of plan.nodes) {
    if (n.kind === 'note') continue;
    if (isGenesis(n)) status[n.id] = 'completed';
    else if (omit.has(n.id)) status[n.id] = 'locked';
    else status[n.id] = 'locked';
  }
  return status;
}

function buildNodeStatus(
  plan: Plan,
  windows: Map<string, { start: number; finish: number }>,
  satisfied: Map<string, number>,
  month: number,
  omit: Set<string>,
): Record<string, NodeRunStatus> {
  const status: Record<string, NodeRunStatus> = {};

  for (const n of plan.nodes) {
    if (n.kind === 'note') continue;

    if (isGenesis(n)) {
      status[n.id] = 'completed';
      continue;
    }

    if (isObjective(n)) {
      status[n.id] = satisfied.has(n.id) ? 'completed' : 'locked';
      continue;
    }

    if (omit.has(n.id)) {
      status[n.id] = 'locked';
      continue;
    }

    const w = windows.get(n.id);
    if (!w) {
      status[n.id] = 'locked';
    } else if (month > w.finish) {
      status[n.id] = 'completed';
    } else if (month > w.start) {
      status[n.id] = 'active';
    } else if (month === w.start) {
      status[n.id] = 'ready';
    } else {
      status[n.id] = 'locked';
    }
  }

  return status;
}

function buildObjectiveOutcome(
  obj: ObjectiveNode,
  plan: Plan,
  satisfied: Map<string, number>,
  peakProgress: Map<string, number>,
  omit: Set<string>,
  schedule: Schedule,
): ObjectiveOutcome {
  const satisfiedMonth = satisfied.get(obj.id) ?? null;
  const deadline = num(obj.deadlineMonth);
  const lateBy = satisfiedMonth !== null && deadline > 0 ? Math.max(0, satisfiedMonth - deadline) : 0;

  let blockedReason: string | null = null;
  if (satisfiedMonth === null) {
    const missingPrereq = (obj.dependsOn ?? [])
      .map((d) => (typeof d === 'string' ? d : d.id))
      .filter((id) => omit.has(id) || !schedule.nodes.has(id));

    if (missingPrereq.length > 0) {
      const names = missingPrereq
        .map((id) => plan.nodes.find((n) => n.id === id)?.name ?? id)
        .join(', ');
      blockedReason = `Prerequisite not in this plan: ${names}`;
    } else if ((peakProgress.get(obj.id) ?? 0) < 1) {
      const pct = Math.round((peakProgress.get(obj.id) ?? 0) * 100);
      blockedReason = `Reached ${pct}% of target within the horizon`;
    } else {
      blockedReason = 'Capital reached but health, relational or spiritual minimums were not met';
    }
  }

  return {
    id: obj.id,
    name: obj.name,
    satisfiedMonth,
    deadlineMonth: deadline,
    lateBy,
    peakProgress: peakProgress.get(obj.id) ?? 0,
    targetCapital: num(obj.targetCapital),
    blockedReason,
  };
}
