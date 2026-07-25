/**
 * Monte Carlo risk analysis.
 *
 * Runs the deterministic simulator N times against randomly perturbed worlds and
 * reports the distribution. The previous implementation ran a *single* unseeded
 * trial and reported "resilient" or "failed" from it, which is a coin flip
 * dressed as an analysis — and its result changed every time you pressed the
 * button.
 *
 * Everything here is seeded, so a given seed always yields the same answer and
 * two runs are genuinely comparable.
 */

import type { Plan } from './types';
import { computeSchedule } from './schedule';
import { simulate, type Modifiers, type SimulationResult } from './simulate';
import { createRng, hashSeed, type Rng } from './rng';
import { num } from './units';

export interface RiskFactors {
  /** Standard deviation of annual investment return, in percentage points. */
  yieldVolatilityPct: number;
  /** Probability per month of an income disruption. */
  incomeDisruptionChance: number;
  /** Fractional income lost when a disruption hits. */
  incomeDisruptionSeverity: number;
  /** Probability per month of an unplanned expense. */
  emergencyChance: number;
  /** Range of an unplanned expense, in currency. */
  emergencyMin: number;
  emergencyMax: number;
  /** Probability per month of a health shock. */
  healthShockChance: number;
  /** Emotional points lost when a health shock hits. */
  healthShockSeverity: number;
  /** Standard deviation applied to recurring costs, as a fraction. */
  costVolatility: number;
}

export const DEFAULT_RISK_FACTORS: RiskFactors = {
  yieldVolatilityPct: 8,
  incomeDisruptionChance: 0.04,
  incomeDisruptionSeverity: 0.4,
  emergencyChance: 0.12,
  emergencyMin: 400,
  emergencyMax: 2500,
  healthShockChance: 0.05,
  healthShockSeverity: 12,
  costVolatility: 0.06,
};

export interface MonteCarloOptions {
  trials?: number;
  seed?: number;
  factors?: Partial<RiskFactors>;
}

export interface Percentiles {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface MonteCarloResult {
  trials: number;
  /** Percentile bands of net worth for every month, index 0 = month 0. */
  netWorthBands: Percentiles[];
  /** Percentile bands of the emotional index for every month. */
  emotionalBands: Percentiles[];
  /** Fraction of trials in which every objective was met inside the horizon. */
  successRate: number;
  /** Fraction of trials that went net-worth negative at any point. */
  insolvencyRate: number;
  /** Fraction of trials that breached at least one critical constraint. */
  criticalBreachRate: number;
  /** Distribution of the month all objectives completed, across successful trials. */
  completionMonth: Percentiles | null;
  finalNetWorth: Percentiles;
  minEmotional: Percentiles;
  /** The constraint types that broke most often, worst first. */
  topFailureModes: Array<{ label: string; trials: number; rate: number }>;
  /** Representative runs, so the UI can draw real trajectories rather than only bands. */
  sampleRuns: { pessimistic: SimulationResult; median: SimulationResult; optimistic: SimulationResult };
  seed: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function percentiles(values: number[]): Percentiles {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  return {
    p5: percentile(sorted, 0.05),
    p25: percentile(sorted, 0.25),
    p50: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p95: percentile(sorted, 0.95),
  };
}

/** Builds one perturbed world. */
function drawModifiers(rng: Rng, horizon: number, factors: RiskFactors, plan: Plan): Modifiers {
  const baseYield = num(plan.assumptions.annualYieldPct);
  const drawnYield = rng.normal(baseYield, factors.yieldVolatilityPct);

  // Express the drawn yield as a multiplier so `simulate` stays unaware of risk.
  const yieldMultiplier = baseYield === 0 ? 1 : drawnYield / baseYield;

  const expenseShocks: number[] = [];
  const incomeShocks: number[] = [];
  const emotionalShocks: number[] = [];

  for (let m = 0; m < horizon; m++) {
    expenseShocks.push(
      rng.chance(factors.emergencyChance) ? rng.range(factors.emergencyMin, factors.emergencyMax) : 0,
    );
    incomeShocks.push(
      rng.chance(factors.incomeDisruptionChance) ? factors.incomeDisruptionSeverity : 0,
    );
    emotionalShocks.push(rng.chance(factors.healthShockChance) ? factors.healthShockSeverity : 0);
  }

  return {
    costMultiplier: Math.max(0, rng.normal(1, factors.costVolatility)),
    incomeMultiplier: 1,
    yieldMultiplier: Number.isFinite(yieldMultiplier) ? yieldMultiplier : 1,
    inflationMultiplier: Math.max(0, rng.normal(1, 0.25)),
    expenseShocks,
    incomeShocks,
    emotionalShocks,
  };
}

export function runMonteCarlo(plan: Plan, options: MonteCarloOptions = {}): MonteCarloResult {
  const trials = Math.max(1, options.trials ?? 500);
  const seed = options.seed ?? hashSeed(plan.id || plan.name || 'sovereign');
  const factors = { ...DEFAULT_RISK_FACTORS, ...(options.factors ?? {}) };
  const horizon = Math.max(1, Math.round(num(plan.horizonMonths, 12)));

  // The schedule is structural and does not vary between trials, so compute once.
  const schedule = computeSchedule(plan);

  const rng = createRng(seed);
  const runs: SimulationResult[] = [];

  for (let i = 0; i < trials; i++) {
    const modifiers = drawModifiers(rng, horizon, factors, plan);
    runs.push(simulate(plan, { schedule, modifiers }));
  }

  // ---- Per-month bands -----------------------------------------------------
  const monthCount = horizon + 1;
  const netWorthBands: Percentiles[] = [];
  const emotionalBands: Percentiles[] = [];

  for (let m = 0; m < monthCount; m++) {
    netWorthBands.push(percentiles(runs.map((r) => r.months[m]?.netWorth ?? 0)));
    emotionalBands.push(percentiles(runs.map((r) => r.months[m]?.emotional ?? 0)));
  }

  // ---- Rates ---------------------------------------------------------------
  const successful = runs.filter((r) => r.allObjectivesMet);
  const successRate = runs.length ? successful.length / runs.length : 0;
  const insolvencyRate = runs.length
    ? runs.filter((r) => r.insolventMonth !== null).length / runs.length
    : 0;
  const criticalBreachRate = runs.length
    ? runs.filter((r) => r.violations.some((v) => v.severity === 'critical')).length / runs.length
    : 0;

  // ---- Failure modes -------------------------------------------------------
  const failureCounts = new Map<string, number>();
  for (const run of runs) {
    const seenTypes = new Set(run.violations.filter((v) => v.severity === 'critical').map((v) => v.type));
    for (const type of seenTypes) failureCounts.set(type, (failureCounts.get(type) ?? 0) + 1);
  }
  const topFailureModes = [...failureCounts.entries()]
    .map(([label, count]) => ({ label, trials: count, rate: count / runs.length }))
    .sort((a, b) => b.trials - a.trials);

  // ---- Representative runs -------------------------------------------------
  // Ranked by final net worth so the three curves are real trajectories rather
  // than the percentile envelope, which no single future actually follows.
  const byWealth = [...runs].sort((a, b) => a.finalNetWorth - b.finalNetWorth);
  const pick = (p: number) => byWealth[Math.min(byWealth.length - 1, Math.floor((byWealth.length - 1) * p))];

  return {
    trials,
    netWorthBands,
    emotionalBands,
    successRate,
    insolvencyRate,
    criticalBreachRate,
    completionMonth: successful.length
      ? percentiles(successful.map((r) => r.completionMonth ?? horizon))
      : null,
    finalNetWorth: percentiles(runs.map((r) => r.finalNetWorth)),
    minEmotional: percentiles(runs.map((r) => r.minEmotional)),
    topFailureModes,
    sampleRuns: {
      pessimistic: pick(0.1),
      median: pick(0.5),
      optimistic: pick(0.9),
    },
    seed,
  };
}
