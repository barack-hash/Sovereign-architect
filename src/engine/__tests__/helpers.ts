/**
 * Test fixtures. Kept deliberately small and explicit — every number in a test
 * plan should be one you can do in your head, so a failing assertion points at
 * the engine rather than at the fixture.
 */

import {
  createConstraint,
  createGenesis,
  createLedgerLine,
  createObjective,
  createTask,
} from '../factory';
import { DEFAULT_ASSUMPTIONS, PLAN_SCHEMA_VERSION, type Plan, type PlanNode } from '../types';

export function makePlan(nodes: PlanNode[], overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'test-plan',
    name: 'Test',
    version: PLAN_SCHEMA_VERSION,
    horizonMonths: 24,
    nodes,
    constraints: [],
    assumptions: { ...DEFAULT_ASSUMPTIONS },
    telemetry: [],
    currentMonth: 0,
    ...overrides,
  };
}

/** Genesis with no drift and no yield, so arithmetic in tests stays exact. */
export function inertAssumptions() {
  return {
    ...DEFAULT_ASSUMPTIONS,
    annualYieldPct: 0,
    annualInflationPct: 0,
    annualDebtInterestPct: 0,
    baselineEmotionalDrift: 0,
    baselineRelationalDrift: 0,
    baselineSpiritualDrift: 0,
    autoPayDebtFromSurplus: false,
  };
}

export const g = (id: string, overrides = {}) =>
  createGenesis({ id, name: id, isActive: true, initialEmotional: 100, initialRelational: 100, initialSpiritual: 100, ...overrides });

export const t = (id: string, deps: string[] = [], overrides = {}) =>
  createTask({ id, name: id, dependsOn: deps.map((d) => ({ id: d })), ...overrides });

export const o = (id: string, deps: string[] = [], overrides = {}) =>
  createObjective({ id, name: id, dependsOn: deps.map((d) => ({ id: d })), ...overrides });

export { createConstraint, createLedgerLine };
