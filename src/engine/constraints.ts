/**
 * Constraint evaluation.
 *
 * A constraint is a redline you have decided not to cross. The simulator hands
 * this module a snapshot of one month and gets back every line that was
 * breached. Previously only MIN_CASH and MAX_BURN were ever checked, and the
 * remaining constraint types were collected in the UI and silently discarded.
 */

import type { Constraint, ConstraintType, Violation } from './types';

/**
 * The minimum a month must expose for constraints to be checkable. Kept
 * deliberately narrow so `constraints.ts` never has to import the simulator.
 */
export interface ConstraintInputs {
  month: number;
  netWorth: number;
  monthlyExpenses: number;
  emotional: number;
  relational: number;
  spiritual: number;
  /** Daily hours committed to sleep. */
  sleepHours: number;
  /** Daily hours committed to active tasks and work. */
  laborHours: number;
  /** Daily hours left after every commitment. Negative means overallocated. */
  freeHours: number;
  /** Weekly hours committed to study/learning. */
  studyHoursWeekly: number;
  /** Weekly hours committed to family. */
  familyHoursWeekly: number;
}

const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);

const hrs = (n: number) => `${n.toFixed(1)}h`;
const pct = (n: number) => `${n.toFixed(1)}%`;

type Check = {
  /** Value that was measured. */
  actual: (s: ConstraintInputs) => number;
  /** True when the constraint is satisfied. */
  ok: (actual: number, threshold: number) => boolean;
  message: (actual: number, threshold: number) => string;
};

const CHECKS: Record<ConstraintType, Check> = {
  MIN_CASH: {
    actual: (s) => s.netWorth,
    ok: (a, t) => a >= t,
    message: (a, t) => `Net worth fell to ${money(a)}, below your floor of ${money(t)}.`,
  },
  MAX_BURN: {
    actual: (s) => s.monthlyExpenses,
    ok: (a, t) => a <= t,
    message: (a, t) => `Monthly outflow reached ${money(a)}, above your ceiling of ${money(t)}.`,
  },
  MIN_EMOTIONAL: {
    actual: (s) => s.emotional,
    ok: (a, t) => a >= t,
    message: (a, t) => `System health fell to ${pct(a)}, below your redline of ${pct(t)}.`,
  },
  MIN_RELATIONAL: {
    actual: (s) => s.relational,
    ok: (a, t) => a >= t,
    message: (a, t) => `Relational capital fell to ${pct(a)}, below your redline of ${pct(t)}.`,
  },
  MIN_SPIRITUAL: {
    actual: (s) => s.spiritual,
    ok: (a, t) => a >= t,
    message: (a, t) => `Spiritual alignment fell to ${pct(a)}, below your redline of ${pct(t)}.`,
  },
  MIN_SLEEP: {
    actual: (s) => s.sleepHours,
    ok: (a, t) => a >= t,
    message: (a, t) => `Sleep compressed to ${hrs(a)}/day, below your minimum of ${hrs(t)}.`,
  },
  MAX_LABOR: {
    actual: (s) => s.laborHours,
    ok: (a, t) => a <= t,
    message: (a, t) => `Active labour reached ${hrs(a)}/day, above your ceiling of ${hrs(t)}.`,
  },
  MIN_FREE_HOURS: {
    actual: (s) => s.freeHours,
    ok: (a, t) => a >= t,
    message: (a, t) =>
      a < 0
        ? `You are overallocated by ${hrs(Math.abs(a))}/day — this schedule does not fit in a day.`
        : `Only ${hrs(a)}/day left unallocated, below your minimum of ${hrs(t)}.`,
  },
  MIN_STUDY_HOURS: {
    actual: (s) => s.studyHoursWeekly,
    ok: (a, t) => a >= t,
    message: (a, t) => `Study time fell to ${hrs(a)}/week, below your minimum of ${hrs(t)}.`,
  },
  MIN_FAMILY_HOURS: {
    actual: (s) => s.familyHoursWeekly,
    ok: (a, t) => a >= t,
    message: (a, t) => `Family time fell to ${hrs(a)}/week, below your minimum of ${hrs(t)}.`,
  },
};

/** Every constraint breached in this month. */
export function evaluateConstraints(
  constraints: Constraint[],
  snapshot: ConstraintInputs,
): Violation[] {
  const violations: Violation[] = [];

  for (const c of constraints) {
    if (!c.enabled) continue;

    const check = CHECKS[c.type];
    if (!check) continue;

    const actual = check.actual(snapshot);
    if (check.ok(actual, c.threshold)) continue;

    violations.push({
      constraintId: c.id,
      type: c.type,
      severity: c.severity,
      month: snapshot.month,
      message: check.message(actual, c.threshold),
      actual,
      threshold: c.threshold,
    });
  }

  return violations;
}

export const CONSTRAINT_LABELS: Record<ConstraintType, string> = {
  MIN_CASH: 'Emergency fund floor',
  MAX_BURN: 'Maximum monthly burn',
  MIN_EMOTIONAL: 'System health redline',
  MIN_RELATIONAL: 'Relational redline',
  MIN_SPIRITUAL: 'Spiritual redline',
  MIN_SLEEP: 'Minimum sleep',
  MAX_LABOR: 'Maximum active labour',
  MIN_FREE_HOURS: 'Minimum unallocated time',
  MIN_STUDY_HOURS: 'Minimum study time',
  MIN_FAMILY_HOURS: 'Minimum family time',
};

export const CONSTRAINT_UNITS: Record<ConstraintType, '$' | '$/mo' | '%' | 'h/day' | 'h/week'> = {
  MIN_CASH: '$',
  MAX_BURN: '$/mo',
  MIN_EMOTIONAL: '%',
  MIN_RELATIONAL: '%',
  MIN_SPIRITUAL: '%',
  MIN_SLEEP: 'h/day',
  MAX_LABOR: 'h/day',
  MIN_FREE_HOURS: 'h/day',
  MIN_STUDY_HOURS: 'h/week',
  MIN_FAMILY_HOURS: 'h/week',
};

/** Groups violations by month for chart annotation. */
export function violationsByMonth(violations: Violation[]): Map<number, Violation[]> {
  const map = new Map<number, Violation[]>();
  for (const v of violations) {
    const list = map.get(v.month);
    if (list) list.push(v);
    else map.set(v.month, [v]);
  }
  return map;
}

/** The first critical breach, which is usually the one worth acting on. */
export function firstCriticalViolation(violations: Violation[]): Violation | undefined {
  return violations
    .filter((v) => v.severity === 'critical')
    .sort((a, b) => a.month - b.month)[0];
}
