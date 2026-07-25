import { describe, expect, it } from 'vitest';
import { explore } from '../explore';
import { runMonteCarlo } from '../montecarlo';
import { createLedgerLine, g, inertAssumptions, makePlan, o, t } from './helpers';

const income = (value: number) =>
  createLedgerLine({ label: 'Income', kind: 'income', value, frequency: 'monthly' });
const time = (label: string, value: number, category: any) =>
  createLedgerLine({ label, kind: 'time', value, frequency: 'daily', category });

/**
 * Two independent pieces of work that both feed one goal, but which together
 * exceed the hours in a day. Something has to go second, and which one is a real
 * tradeoff — this is the situation the explorer exists to resolve.
 */
function contendedPlan() {
  return makePlan(
    [
      g('G', {
        initialCash: 5000,
        dailyHours: 24,
        ledger: [income(4000), time('Sleep', 8, 'sleep'), time('Work', 8, 'work')],
      }),
      t('FAST_CHEAP', ['G'], {
        durationMonths: 2,
        hoursPerDayWhileActive: 5,
        immediateCost: 500,
        ongoingIncome: 200,
      }),
      t('SLOW_LUCRATIVE', ['G'], {
        durationMonths: 6,
        hoursPerDayWhileActive: 5,
        immediateCost: 4000,
        ongoingIncome: 2500,
      }),
      o('OBJ', ['FAST_CHEAP', 'SLOW_LUCRATIVE'], { targetCapital: 40000 }),
    ],
    { horizonMonths: 36, assumptions: inertAssumptions() },
  );
}

describe('explore', () => {
  it('produces multiple distinct variants for a contended plan', () => {
    const r = explore(contendedPlan(), { randomSamples: 4 });
    expect(r.variants.length).toBeGreaterThan(1);
    expect(r.evaluated).toBeGreaterThan(1);
  });

  it('respects the daily hour budget when scheduling', () => {
    const r = explore(contendedPlan(), { randomSamples: 2 });
    // Both tasks need 5h on top of 16h committed; 24h cannot hold both at once.
    for (const variant of r.variants) {
      for (const month of variant.result.months) {
        expect(month.freeHours).toBeGreaterThanOrEqual(-0.0001);
      }
    }
  });

  it('serialises contended work rather than overlapping it', () => {
    const r = explore(contendedPlan(), { randomSamples: 2 });
    const variant = r.best!;
    const starts = variant.startMonths;
    // Whichever runs first, the second cannot begin until the first is done.
    const fastFirst = starts['FAST_CHEAP'] < starts['SLOW_LUCRATIVE'];
    if (fastFirst) expect(starts['SLOW_LUCRATIVE']).toBeGreaterThanOrEqual(2);
    else expect(starts['FAST_CHEAP']).toBeGreaterThanOrEqual(6);
  });

  it('ranks by the weighted score with the best first', () => {
    const r = explore(contendedPlan(), { randomSamples: 4 });
    for (let i = 1; i < r.variants.length; i++) {
      expect(r.variants[i - 1].score).toBeGreaterThanOrEqual(r.variants[i].score);
    }
    expect(r.best).toBe(r.variants[0]);
  });

  it('changes the winner when the weights change', () => {
    const plan = makePlan(
      [
        g('G', {
          initialCash: 2000,
          ledger: [income(3000), time('Sleep', 8, 'sleep'), time('Work', 8, 'work')],
        }),
        t('GRIND', ['G'], {
          durationMonths: 3,
          hoursPerDayWhileActive: 7,
          ongoingIncome: 4000,
          emotionalImpactWhileActive: -12,
        }),
        t('GENTLE', ['G'], {
          durationMonths: 3,
          hoursPerDayWhileActive: 2,
          ongoingIncome: 300,
          emotionalImpactWhileActive: 0,
        }),
        o('OBJ', ['G'], { targetCapital: 60000 }),
      ],
      { horizonMonths: 36, assumptions: inertAssumptions() },
    );

    const wealthFirst = explore(plan, {
      randomSamples: 4,
      weights: { speed: 0, wealth: 1, health: 0, relational: 0, spiritual: 0, safety: 0 },
    });
    const healthFirst = explore(plan, {
      randomSamples: 4,
      weights: { speed: 0, wealth: 0, health: 1, relational: 0, spiritual: 0, safety: 0 },
    });

    expect(wealthFirst.best!.metrics.finalNetWorth).toBeGreaterThanOrEqual(
      healthFirst.best!.metrics.finalNetWorth,
    );
    expect(healthFirst.best!.metrics.minEmotional).toBeGreaterThanOrEqual(
      wealthFirst.best!.metrics.minEmotional,
    );
  });

  it('puts only non-dominated variants on the Pareto front', () => {
    const r = explore(contendedPlan(), { randomSamples: 6 });
    expect(r.paretoFront.length).toBeGreaterThan(0);
    for (const v of r.paretoFront) expect(v.onParetoFront).toBe(true);
    expect(r.paretoFront.length).toBeLessThanOrEqual(r.variants.length);
  });

  it('reports the single best variant on each axis', () => {
    const r = explore(contendedPlan(), { randomSamples: 4 });
    expect(r.bestBy.wealth).not.toBeNull();
    expect(r.bestBy.health).not.toBeNull();
    // Nothing in the candidate set should beat the axis leader on that axis.
    for (const v of r.variants) {
      expect(v.metrics.finalNetWorth).toBeLessThanOrEqual(r.bestBy.wealth!.metrics.finalNetWorth);
      expect(v.metrics.minEmotional).toBeLessThanOrEqual(r.bestBy.health!.metrics.minEmotional);
    }
  });

  it('explores dropping optional work and reports what was left out', () => {
    const plan = makePlan(
      [
        g('G', { initialCash: 1000, ledger: [income(2000)] }),
        t('CORE', ['G'], { durationMonths: 1 }),
        t('LUXURY', ['G'], { durationMonths: 2, immediateCost: 20000, optional: true }),
        o('OBJ', ['CORE'], { targetCapital: 8000 }),
      ],
      { horizonMonths: 24, assumptions: inertAssumptions() },
    );

    const r = explore(plan, { randomSamples: 2 });
    const withoutLuxury = r.variants.filter((v) => v.omitted.includes('LUXURY'));
    expect(withoutLuxury.length).toBeGreaterThan(0);
    expect(withoutLuxury[0].omittedNames).toContain('LUXURY');
    // Skipping a 20k purchase must leave the plan richer.
    const withLuxury = r.variants.filter((v) => !v.omitted.includes('LUXURY'));
    expect(withoutLuxury[0].metrics.finalNetWorth).toBeGreaterThan(
      withLuxury[0].metrics.finalNetWorth,
    );
  });

  it('never drops an objective, only work', () => {
    const plan = makePlan(
      [
        g('G', { initialCash: 1000, ledger: [income(2000)] }),
        t('OPT', ['G'], { durationMonths: 1, optional: true }),
        o('OBJ', ['OPT'], { targetCapital: 5000 }),
      ],
      { horizonMonths: 24, assumptions: inertAssumptions() },
    );

    for (const v of explore(plan, { randomSamples: 2 }).variants) {
      expect(v.omitted).not.toContain('OBJ');
      expect(v.omitted).not.toContain('G');
    }
  });

  it('will not start work the plan cannot afford when cash-aware', () => {
    const plan = makePlan(
      [
        g('G', { initialCash: 100, ledger: [income(1000)] }),
        t('EXPENSIVE', ['G'], { durationMonths: 1, immediateCost: 5000 }),
        o('OBJ', ['EXPENSIVE'], { targetCapital: 0 }),
      ],
      { horizonMonths: 24, assumptions: inertAssumptions() },
    );

    const r = explore(plan, { randomSamples: 1, respectCashOnHand: true });
    // Needs roughly five months of saving before it can begin.
    expect(r.best!.startMonths['EXPENSIVE']).toBeGreaterThanOrEqual(4);
  });

  it('is reproducible for a given seed', () => {
    const a = explore(contendedPlan(), { seed: 42, randomSamples: 5 });
    const b = explore(contendedPlan(), { seed: 42, randomSamples: 5 });
    expect(a.variants.map((v) => v.score)).toEqual(b.variants.map((v) => v.score));
  });

  it('degrades with a note rather than throwing on a cyclic plan', () => {
    const plan = makePlan([g('G'), t('A', ['G', 'B']), t('B', ['A'])]);
    const r = explore(plan);
    expect(r.variants).toHaveLength(0);
    expect(r.notes.join(' ')).toMatch(/cycle/i);
  });

  it('degrades with a note when there is no work to order', () => {
    const r = explore(makePlan([g('G'), o('OBJ', ['G'])]));
    expect(r.notes.join(' ')).toMatch(/No tasks/i);
  });

  it('says so when no ordering can reach the goal in time', () => {
    const plan = makePlan(
      [
        g('G', { initialCash: 0, ledger: [income(100)] }),
        t('A', ['G'], { durationMonths: 1 }),
        o('OBJ', ['A'], { targetCapital: 10_000_000 }),
      ],
      { horizonMonths: 12, assumptions: inertAssumptions() },
    );

    expect(explore(plan, { randomSamples: 1 }).notes.join(' ')).toMatch(/inside the horizon/i);
  });
});

describe('runMonteCarlo', () => {
  const plan = () =>
    makePlan(
      [
        g('G', { initialCash: 8000, ledger: [income(4000), createLedgerLine({ label: 'Rent', kind: 'expense', value: 2500, frequency: 'monthly' })] }),
        t('A', ['G'], { durationMonths: 3, ongoingIncome: 800 }),
        o('OBJ', ['A'], { targetCapital: 40000 }),
      ],
      { horizonMonths: 24 },
    );

  it('is reproducible for a given seed', () => {
    const a = runMonteCarlo(plan(), { trials: 50, seed: 7 });
    const b = runMonteCarlo(plan(), { trials: 50, seed: 7 });
    expect(a.successRate).toBe(b.successRate);
    expect(a.finalNetWorth).toEqual(b.finalNetWorth);
  });

  it('gives different answers for different seeds', () => {
    const a = runMonteCarlo(plan(), { trials: 50, seed: 1 });
    const b = runMonteCarlo(plan(), { trials: 50, seed: 999 });
    expect(a.finalNetWorth.p50).not.toBe(b.finalNetWorth.p50);
  });

  it('returns ordered percentile bands for every month', () => {
    const r = runMonteCarlo(plan(), { trials: 60, seed: 3 });
    expect(r.netWorthBands).toHaveLength(25); // month 0 plus 24
    for (const band of r.netWorthBands) {
      expect(band.p5).toBeLessThanOrEqual(band.p25);
      expect(band.p25).toBeLessThanOrEqual(band.p50);
      expect(band.p50).toBeLessThanOrEqual(band.p75);
      expect(band.p75).toBeLessThanOrEqual(band.p95);
    }
  });

  it('reports rates as proper fractions', () => {
    const r = runMonteCarlo(plan(), { trials: 40, seed: 5 });
    for (const rate of [r.successRate, r.insolvencyRate, r.criticalBreachRate]) {
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
  });

  it('returns three real trajectories, not just the envelope', () => {
    const r = runMonteCarlo(plan(), { trials: 40, seed: 11 });
    const { pessimistic, median, optimistic } = r.sampleRuns;
    expect(pessimistic.finalNetWorth).toBeLessThanOrEqual(median.finalNetWorth);
    expect(median.finalNetWorth).toBeLessThanOrEqual(optimistic.finalNetWorth);
    expect(median.months).toHaveLength(25);
  });

  it('surfaces which constraints break most often', () => {
    const stressed = makePlan(
      [g('G', { initialCash: 500, ledger: [createLedgerLine({ label: 'Rent', kind: 'expense', value: 3000, frequency: 'monthly' })] })],
      {
        horizonMonths: 12,
        constraints: [
          { id: 'c1', type: 'MIN_CASH', threshold: 1000, severity: 'critical', enabled: true },
        ],
      },
    );

    const r = runMonteCarlo(stressed, { trials: 30, seed: 2 });
    expect(r.topFailureModes[0].label).toBe('MIN_CASH');
    expect(r.topFailureModes[0].rate).toBeGreaterThan(0.5);
  });
});
