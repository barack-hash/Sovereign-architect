/**
 * Constructors for plan objects.
 *
 * Every node the UI creates comes from here, so a new node always has every
 * field the engine expects. The old code built node objects inline in three
 * different places with slightly different shapes, which is why `undefined`
 * kept reaching the arithmetic.
 */

import {
  DEFAULT_ASSUMPTIONS,
  PLAN_SCHEMA_VERSION,
  type Constraint,
  type GenesisNode,
  type LedgerLine,
  type NoteNode,
  type ObjectiveNode,
  type Plan,
  type TaskNode,
  type TimeCategory,
} from './types';

let idCounter = 0;

/**
 * Collision-resistant without needing crypto: a monotonic counter plus a
 * timestamp. Deliberately not random, so plans diff cleanly.
 */
export function newId(prefix = 'n'): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export function createLedgerLine(overrides: Partial<LedgerLine> = {}): LedgerLine {
  return {
    id: newId('l'),
    label: 'New line',
    kind: 'expense',
    value: 0,
    frequency: 'monthly',
    category: 'other',
    emotionalImpact: 0,
    relationalImpact: 0,
    spiritualImpact: 0,
    ...overrides,
  };
}

export function createGenesis(overrides: Partial<GenesisNode> = {}): GenesisNode {
  return {
    id: newId('g'),
    kind: 'genesis',
    name: 'Where I am now',
    dependsOn: [],
    position: { x: 40, y: 200 },
    isActive: true,
    initialCash: 0,
    initialDebt: 0,
    ledger: [],
    initialEmotional: 80,
    initialRelational: 80,
    initialSpiritual: 80,
    dailyHours: 24,
    ...overrides,
  };
}

export function createTask(overrides: Partial<TaskNode> = {}): TaskNode {
  return {
    id: newId('t'),
    kind: 'task',
    name: 'New task',
    dependsOn: [],
    position: { x: 340, y: 200 },
    durationMonths: 1,
    earliestStartMonth: 0,
    deadlineMonth: 0,
    immediateCost: 0,
    immediateIncome: 0,
    ongoingCost: 0,
    ongoingIncome: 0,
    hoursPerDayWhileActive: 0,
    hoursPerDayReclaimed: 0,
    emotionalImpactWhileActive: 0,
    relationalImpactWhileActive: 0,
    spiritualImpactWhileActive: 0,
    emotionalImpactAfter: 0,
    relationalImpactAfter: 0,
    spiritualImpactAfter: 0,
    optional: false,
    status: 'pending',
    ...overrides,
  };
}

export function createObjective(overrides: Partial<ObjectiveNode> = {}): ObjectiveNode {
  return {
    id: newId('o'),
    kind: 'objective',
    name: 'New objective',
    dependsOn: [],
    position: { x: 640, y: 200 },
    targetCapital: 0,
    deadlineMonth: 0,
    minEmotional: 0,
    minRelational: 0,
    minSpiritual: 0,
    priority: 1,
    ...overrides,
  };
}

export function createNote(overrides: Partial<NoteNode> = {}): NoteNode {
  return {
    id: newId('note'),
    kind: 'note',
    name: 'Note',
    dependsOn: [],
    position: { x: 340, y: 420 },
    content: '',
    ...overrides,
  };
}

export function createConstraint(overrides: Partial<Constraint> = {}): Constraint {
  return {
    id: newId('c'),
    type: 'MIN_CASH',
    threshold: 0,
    severity: 'critical',
    enabled: true,
    ...overrides,
  };
}

/** Time ledger lines for a fairly ordinary week, used to seed a new plan. */
function starterTimeLedger(): LedgerLine[] {
  const time = (label: string, value: number, category: TimeCategory): LedgerLine =>
    createLedgerLine({ label, kind: 'time', value, frequency: 'daily', category });

  return [
    time('Sleep', 7, 'sleep'),
    time('Work', 8, 'work'),
    time('Meals & hygiene', 2, 'maintenance'),
    time('Commute', 1, 'maintenance'),
    time('Salah', 1, 'faith'),
    time('Family', 2, 'family'),
    time('Study', 1, 'study'),
    time('Screens', 1, 'entropy'),
  ];
}

/** A blank but coherent plan. Nothing here is load-bearing; it is a starting point. */
export function createDefaultPlan(): Plan {
  const genesis = createGenesis({
    initialCash: 5000,
    initialDebt: 0,
    ledger: [
      createLedgerLine({ label: 'Salary', kind: 'income', value: 4000, frequency: 'monthly' }),
      createLedgerLine({ label: 'Rent', kind: 'expense', value: 1400, frequency: 'monthly' }),
      createLedgerLine({ label: 'Groceries', kind: 'expense', value: 120, frequency: 'weekly' }),
      createLedgerLine({ label: 'Utilities & phone', kind: 'expense', value: 200, frequency: 'monthly' }),
      ...starterTimeLedger(),
    ],
  });

  const objective = createObjective({
    name: 'First objective',
    targetCapital: 25000,
    deadlineMonth: 24,
    dependsOn: [{ id: genesis.id }],
    position: { x: 640, y: 200 },
  });

  return {
    id: newId('plan'),
    name: 'My plan',
    version: PLAN_SCHEMA_VERSION,
    horizonMonths: 36,
    nodes: [genesis, objective],
    constraints: [
      createConstraint({ type: 'MIN_CASH', threshold: 2000, severity: 'critical' }),
      createConstraint({ type: 'MIN_SLEEP', threshold: 6, severity: 'critical' }),
      createConstraint({ type: 'MIN_FREE_HOURS', threshold: 0, severity: 'critical' }),
      createConstraint({ type: 'MIN_EMOTIONAL', threshold: 25, severity: 'critical' }),
      createConstraint({ type: 'MIN_RELATIONAL', threshold: 30, severity: 'warning' }),
      createConstraint({ type: 'MIN_SPIRITUAL', threshold: 30, severity: 'warning' }),
    ],
    assumptions: { ...DEFAULT_ASSUMPTIONS },
    telemetry: [],
    currentMonth: 0,
  };
}
