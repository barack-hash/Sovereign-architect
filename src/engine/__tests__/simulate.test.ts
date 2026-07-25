import { describe, expect, it } from 'vitest';
import { simulate } from '../simulate';
import { createLedgerLine, g, inertAssumptions, makePlan, o, t } from './helpers';

const income = (value: number, frequency: any = 'monthly') =>
  createLedgerLine({ label: 'Income', kind: 'income', value, frequency });
const expense = (value: number, frequency: any = 'monthly') =>
  createLedgerLine({ label: 'Expense', kind: 'expense', value, frequency });
const time = (label: string, value: number, category: any) =>
  createLedgerLine({ label, kind: 'time', value, frequency: 'daily', category });

describe('baseline cash flow', () => {
  it('accumulates the monthly surplus with no tasks in play', () => {
    const plan = makePlan([g('G', { initialCash: 1000, ledger: [income(3000), expense(2000)] })], {
      horizonMonths: 3,
      assumptions: inertAssumptions(),
    });

    const r = simulate(plan);
    // 1000 start, +1000 surplus each month.
    expect(r.months[1].netWorth).toBeCloseTo(2000, 6);
    expect(r.months[2].netWorth).toBeCloseTo(3000, 6);
    expect(r.months[3].netWorth).toBeCloseTo(4000, 6);
  });

  it('normalises weekly and yearly ledger lines into monthly flow', () => {
    const plan = makePlan(
      [g('G', { initialCash: 0, ledger: [income(1200, 'yearly'), expense(100, 'weekly')] })],
      { horizonMonths: 1, assumptions: inertAssumptions() },
    );

    const r = simulate(plan);
    // 1200/yr = 100/mo. 100/wk = 434.8/mo. Net -334.8, which becomes debt.
    expect(r.months[1].monthlyIncome).toBeCloseTo(100, 3);
    expect(r.months[1].monthlyExpenses).toBeCloseTo(434.8, 1);
    expect(r.months[1].netWorth).toBeCloseTo(-334.8, 1);
  });

  it('turns a cash shortfall into debt rather than negative cash', () => {
    const plan = makePlan([g('G', { initialCash: 0, ledger: [expense(500)] })], {
      horizonMonths: 1,
      assumptions: inertAssumptions(),
    });

    const r = simulate(plan);
    expect(r.months[1].cash).toBe(0);
    expect(r.months[1].debt).toBeCloseTo(500, 6);
    expect(r.months[1].isInsolvent).toBe(true);
    expect(r.insolventMonth).toBe(1);
  });

  it('never compounds investment yield onto debt', () => {
    // The v1 engine applied yield to net worth, so being deep in debt "earned"
    // a negative return that quietly flattered the projection.
    const plan = makePlan([g('G', { initialCash: 0, initialDebt: 10000, ledger: [] })], {
      horizonMonths: 2,
      assumptions: { ...inertAssumptions(), annualYieldPct: 12 },
    });

    const r = simulate(plan);
    expect(r.months[1].investmentReturn).toBe(0);
    expect(r.months[2].investmentReturn).toBe(0);
  });

  it('charges interest on outstanding debt', () => {
    const plan = makePlan([g('G', { initialCash: 0, initialDebt: 1000 })], {
      horizonMonths: 1,
      assumptions: { ...inertAssumptions(), annualDebtInterestPct: 12 },
    });

    const r = simulate(plan);
    expect(r.months[1].debtInterest).toBeGreaterThan(0);
    expect(r.months[1].debt).toBeGreaterThan(1000);
  });
});

describe('task effects', () => {
  const base = (overrides = {}) =>
    makePlan(
      [
        g('G', { initialCash: 10000, ledger: [income(1000), expense(1000)] }),
        t('BUY', ['G'], { durationMonths: 1, immediateCost: 2000, ...overrides }),
      ],
      { horizonMonths: 4, assumptions: inertAssumptions() },
    );

  it('charges an immediate cost in the month the task starts', () => {
    const r = simulate(base());
    expect(r.months[1].oneOffCosts).toBe(2000);
    expect(r.months[1].netWorth).toBeCloseTo(8000, 6);
    expect(r.months[2].oneOffCosts).toBe(0);
  });

  it('credits immediate income in the month the task completes', () => {
    const plan = makePlan(
      [
        g('G', { initialCash: 0 }),
        t('SELL', ['G'], { durationMonths: 3, immediateIncome: 900 }),
      ],
      { horizonMonths: 4, assumptions: inertAssumptions() },
    );

    const r = simulate(plan);
    // Runs months 1-3, pays out at the end of month 3, not month 1.
    expect(r.months[1].oneOffIncome).toBe(0);
    expect(r.months[3].oneOffIncome).toBe(900);
    expect(r.months[3].netWorth).toBeCloseTo(900, 6);
  });

  it('begins recurring income the month after completion', () => {
    const plan = makePlan(
      [g('G', { initialCash: 0 }), t('JOB', ['G'], { durationMonths: 2, ongoingIncome: 500 })],
      { horizonMonths: 5, assumptions: inertAssumptions() },
    );

    const r = simulate(plan);
    expect(r.months[2].monthlyIncome).toBe(0); // completes this month
    expect(r.months[3].monthlyIncome).toBe(500);
    expect(r.months[4].monthlyIncome).toBe(500);
  });

  it('applies a multi-month task across its whole window rather than an instant', () => {
    // v1 had no duration: everything fired in one month regardless of scale.
    const plan = makePlan(
      [
        g('G', { initialCash: 0, ledger: [time('Sleep', 8, 'sleep')] }),
        t('DEGREE', ['G'], { durationMonths: 4, hoursPerDayWhileActive: 3 }),
      ],
      { horizonMonths: 6, assumptions: inertAssumptions() },
    );

    const r = simulate(plan);
    for (const m of [1, 2, 3, 4]) {
      expect(r.months[m].activeTaskIds).toContain('DEGREE');
      expect(r.months[m].committedHours).toBeCloseTo(11, 6);
    }
    expect(r.months[5].activeTaskIds).not.toContain('DEGREE');
    expect(r.months[5].committedHours).toBeCloseTo(8, 6);
  });

  it('frees reclaimed hours only after completion', () => {
    const plan = makePlan(
      [
        g('G', { ledger: [time('Commute', 2, 'maintenance')] }),
        t('MOVE', ['G'], { durationMonths: 2, hoursPerDayReclaimed: 1.5 }),
      ],
      { horizonMonths: 4, assumptions: inertAssumptions() },
    );

    const r = simulate(plan);
    expect(r.months[2].committedHours).toBeCloseTo(2, 6);
    expect(r.months[3].committedHours).toBeCloseTo(0.5, 6);
  });
});

describe('time budget and overload', () => {
  it('reports free hours against the daily budget', () => {
    const plan = makePlan(
      [g('G', { dailyHours: 24, ledger: [time('Sleep', 8, 'sleep'), time('Work', 8, 'work')] })],
      { horizonMonths: 1, assumptions: inertAssumptions() },
    );

    const r = simulate(plan);
    expect(r.months[1].committedHours).toBeCloseTo(16, 6);
    expect(r.months[1].freeHours).toBeCloseTo(8, 6);
    expect(r.months[1].isOverallocated).toBe(false);
  });

  it('damages health when the schedule does not fit in a day', () => {
    const plan = makePlan(
      [
        g('G', {
          dailyHours: 24,
          initialEmotional: 100,
          ledger: [time('Sleep', 8, 'sleep'), time('Work', 14, 'work')],
        }),
        t('SIDE', ['G'], { durationMonths: 3, hoursPerDayWhileActive: 6 }),
      ],
      { horizonMonths: 3, assumptions: inertAssumptions() },
    );

    const r = simulate(plan);
    // 8 + 14 + 6 = 28 hours in a 24-hour day.
    expect(r.months[1].freeHours).toBeCloseTo(-4, 6);
    expect(r.months[1].isOverallocated).toBe(true);
    expect(r.months[1].emotional).toBeLessThan(100);
    expect(r.months[3].emotional).toBeLessThan(r.months[1].emotional);
  });

  it('taxes income once health falls below the burnout threshold', () => {
    const plan = makePlan(
      [g('G', { initialEmotional: 10, ledger: [income(1000)] })],
      {
        horizonMonths: 1,
        assumptions: { ...inertAssumptions(), burnoutThreshold: 30, burnoutIncomePenalty: 0.2 },
      },
    );

    const r = simulate(plan);
    expect(r.months[1].isBurnedOut).toBe(true);
    expect(r.months[1].monthlyIncome).toBeCloseTo(800, 6);
  });
});

describe('objectives', () => {
  it('satisfies an objective the month its capital target is reached', () => {
    const plan = makePlan(
      [
        g('G', { initialCash: 0, ledger: [income(1000)] }),
        o('OBJ', ['G'], { targetCapital: 3000 }),
      ],
      { horizonMonths: 6, assumptions: inertAssumptions() },
    );

    const r = simulate(plan);
    expect(r.objectives[0].satisfiedMonth).toBe(3);
    expect(r.allObjectivesMet).toBe(true);
    expect(r.completionMonth).toBe(3);
  });

  it('withholds an objective until its prerequisite task completes', () => {
    const plan = makePlan(
      [
        g('G', { initialCash: 10000, ledger: [income(1000)] }),
        t('GATE', ['G'], { durationMonths: 4 }),
        o('OBJ', ['GATE'], { targetCapital: 1000 }),
      ],
      { horizonMonths: 8, assumptions: inertAssumptions() },
    );

    const r = simulate(plan);
    // Capital was sufficient from month 1, but the gate takes four months.
    expect(r.objectives[0].satisfiedMonth).toBe(4);
  });

  it('withholds an objective whose health minimum is unmet', () => {
    const plan = makePlan(
      [
        g('G', { initialCash: 50000, initialEmotional: 20, ledger: [income(1000)] }),
        o('OBJ', ['G'], { targetCapital: 1000, minEmotional: 60 }),
      ],
      { horizonMonths: 4, assumptions: inertAssumptions() },
    );

    const r = simulate(plan);
    expect(r.objectives[0].satisfiedMonth).toBeNull();
    expect(r.objectives[0].blockedReason).toMatch(/health|relational|spiritual/i);
  });

  it('records how late an objective landed against its deadline', () => {
    const plan = makePlan(
      [
        g('G', { initialCash: 0, ledger: [income(1000)] }),
        o('OBJ', ['G'], { targetCapital: 5000, deadlineMonth: 3 }),
      ],
      { horizonMonths: 10, assumptions: inertAssumptions() },
    );

    const r = simulate(plan);
    expect(r.objectives[0].satisfiedMonth).toBe(5);
    expect(r.objectives[0].lateBy).toBe(2);
  });

  it('explains why an unreached objective failed', () => {
    const plan = makePlan(
      [g('G', { initialCash: 0, ledger: [income(100)] }), o('OBJ', ['G'], { targetCapital: 1000000 })],
      { horizonMonths: 6, assumptions: inertAssumptions() },
    );

    const r = simulate(plan);
    expect(r.objectives[0].satisfiedMonth).toBeNull();
    expect(r.objectives[0].blockedReason).toMatch(/% of target/);
  });
});

describe('constraints', () => {
  it('raises a violation the month a floor is breached', () => {
    const plan = makePlan(
      [g('G', { initialCash: 1000, ledger: [expense(400)] })],
      {
        horizonMonths: 4,
        assumptions: inertAssumptions(),
        constraints: [
          { id: 'c1', type: 'MIN_CASH', threshold: 500, severity: 'critical', enabled: true },
        ],
      },
    );

    const r = simulate(plan);
    // 1000 → 600 → 200: the floor breaks in month 2.
    expect(r.months[1].violations).toHaveLength(0);
    expect(r.months[2].violations[0].type).toBe('MIN_CASH');
    expect(r.months[2].violations[0].message).toMatch(/below your floor/);
  });

  it('checks the sleep constraint that v1 collected and ignored', () => {
    const plan = makePlan(
      [g('G', { ledger: [time('Sleep', 4, 'sleep')] })],
      {
        horizonMonths: 1,
        assumptions: inertAssumptions(),
        constraints: [
          { id: 'c1', type: 'MIN_SLEEP', threshold: 6, severity: 'critical', enabled: true },
        ],
      },
    );

    expect(simulate(plan).months[1].violations[0].type).toBe('MIN_SLEEP');
  });

  it('ignores disabled constraints', () => {
    const plan = makePlan([g('G', { initialCash: 0 })], {
      horizonMonths: 1,
      assumptions: inertAssumptions(),
      constraints: [
        { id: 'c1', type: 'MIN_CASH', threshold: 999999, severity: 'critical', enabled: false },
      ],
    });

    expect(simulate(plan).violations).toHaveLength(0);
  });
});

describe('determinism and robustness', () => {
  it('produces byte-identical results across runs', () => {
    const plan = makePlan(
      [
        g('G', { initialCash: 5000, ledger: [income(3000), expense(2200), time('Sleep', 7, 'sleep')] }),
        t('A', ['G'], { durationMonths: 2, immediateCost: 1200, ongoingIncome: 400 }),
        t('B', ['A'], { durationMonths: 3, hoursPerDayWhileActive: 2 }),
        o('OBJ', ['B'], { targetCapital: 12000 }),
      ],
      { horizonMonths: 24 },
    );

    expect(JSON.stringify(simulate(plan))).toEqual(JSON.stringify(simulate(plan)));
  });

  it('survives NaN and undefined values without poisoning the run', () => {
    const plan = makePlan(
      [
        g('G', { initialCash: NaN as any, ledger: [income(undefined as any)] }),
        t('A', ['G'], { durationMonths: NaN as any, immediateCost: 'oops' as any }),
      ],
      { horizonMonths: 3 },
    );

    const r = simulate(plan);
    for (const month of r.months) {
      expect(Number.isFinite(month.netWorth)).toBe(true);
      expect(Number.isFinite(month.emotional)).toBe(true);
    }
  });

  it('keeps every index inside 0-100', () => {
    const plan = makePlan(
      [
        g('G', { initialEmotional: 100, initialRelational: 100, initialSpiritual: 100 }),
        t('GOOD', ['G'], { durationMonths: 5, emotionalImpactAfter: 999, spiritualImpactAfter: 999 }),
        t('BAD', ['G'], { durationMonths: 5, relationalImpactWhileActive: -999 }),
      ],
      { horizonMonths: 12 },
    );

    for (const month of simulate(plan).months) {
      for (const v of [month.emotional, month.relational, month.spiritual]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it('omits tasks the explorer asked it to drop', () => {
    const plan = makePlan(
      [
        g('G', { initialCash: 1000 }),
        t('SKIP', ['G'], { durationMonths: 1, immediateCost: 500 }),
      ],
      { horizonMonths: 2, assumptions: inertAssumptions() },
    );

    const r = simulate(plan, { omit: new Set(['SKIP']) });
    expect(r.months[1].oneOffCosts).toBe(0);
    expect(r.omitted).toEqual(['SKIP']);
  });

  it('honours an explicit start override', () => {
    const plan = makePlan(
      [g('G', { initialCash: 1000 }), t('A', ['G'], { durationMonths: 1, immediateCost: 100 })],
      { horizonMonths: 5, assumptions: inertAssumptions() },
    );

    const r = simulate(plan, { startOverride: new Map([['A', 3]]) });
    expect(r.months[1].oneOffCosts).toBe(0);
    expect(r.months[4].oneOffCosts).toBe(100);
  });
});
