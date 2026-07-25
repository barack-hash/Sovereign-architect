/**
 * Derived analysis, memoised.
 *
 * Everything cheap and always-needed (validation, schedule, simulation) recomputes
 * whenever the plan changes. Everything expensive (permutation search, Monte
 * Carlo) runs only when asked, because a 500-trial risk analysis has no business
 * firing on every keystroke.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  computeSchedule,
  criticalPathTo,
  explore,
  firstCriticalViolation,
  hasBlockingIssue,
  runMonteCarlo,
  simulate,
  validateGraph,
  violationsByMonth,
  type ExploreOptions,
  type ExploreResult,
  type MonteCarloResult,
  type Plan,
  type ScoreWeights,
} from '../engine';

export function useAnalysis(plan: Plan) {
  const issues = useMemo(() => validateGraph(plan), [plan]);
  const blocked = useMemo(() => hasBlockingIssue(issues), [issues]);

  const schedule = useMemo(() => computeSchedule(plan), [plan]);

  /**
   * The main projection. Reality overlay is always folded in; months beyond
   * `plan.currentMonth` simply carry no actuals.
   */
  const simulation = useMemo(
    () => simulate(plan, { schedule, includeActuals: true }),
    [plan, schedule],
  );

  const violationsPerMonth = useMemo(
    () => violationsByMonth(simulation.violations),
    [simulation.violations],
  );

  const firstBreach = useMemo(
    () => firstCriticalViolation(simulation.violations),
    [simulation.violations],
  );

  /** Per-objective critical chains: what is actually gating each goal. */
  const objectivePaths = useMemo(
    () =>
      simulation.objectives.map((objective) => ({
        objective,
        ...criticalPathTo(plan, objective.id),
      })),
    [plan, simulation.objectives],
  );

  // ---- Expensive analyses, run on demand ----------------------------------
  const [exploration, setExploration] = useState<ExploreResult | null>(null);
  const [isExploring, setIsExploring] = useState(false);

  const [risk, setRisk] = useState<MonteCarloResult | null>(null);
  const [isRunningRisk, setIsRunningRisk] = useState(false);

  const runExplore = useCallback(
    (weights?: ScoreWeights, options?: ExploreOptions) => {
      setIsExploring(true);
      // Yield a frame so the button can show its pending state before the main
      // thread blocks on the search.
      return new Promise<ExploreResult>((resolve) => {
        setTimeout(() => {
          const result = explore(plan, { ...options, weights });
          setExploration(result);
          setIsExploring(false);
          resolve(result);
        }, 0);
      });
    },
    [plan],
  );

  const runRisk = useCallback(
    (trials = 400) => {
      setIsRunningRisk(true);
      return new Promise<MonteCarloResult>((resolve) => {
        setTimeout(() => {
          const result = runMonteCarlo(plan, { trials });
          setRisk(result);
          setIsRunningRisk(false);
          resolve(result);
        }, 0);
      });
    },
    [plan],
  );

  /** Invalidate stale expensive results when the plan structure changes. */
  const clearDerived = useCallback(() => {
    setExploration(null);
    setRisk(null);
  }, []);

  return {
    issues,
    blocked,
    schedule,
    simulation,
    violationsPerMonth,
    firstBreach,
    objectivePaths,
    exploration,
    isExploring,
    runExplore,
    risk,
    isRunningRisk,
    runRisk,
    clearDerived,
  };
}

export type Analysis = ReturnType<typeof useAnalysis>;
