/**
 * Starter templates: complete, coherent plans a new user can open, run, and
 * then edit into their own life.
 *
 * Every template must stand on its own numbers: a valid graph, a schedule
 * that fits the horizon, and objectives the simulation actually satisfies —
 * a starter plan that opens with red violations teaches that the tool is
 * broken. The template tests enforce all of this.
 */

import {
  createConstraint,
  createGenesis,
  createLedgerLine,
  createNote,
  createObjective,
  createTask,
  createDefaultPlan,
  newId,
} from './factory';
import {
  DEFAULT_ASSUMPTIONS,
  PLAN_SCHEMA_VERSION,
  type Constraint,
  type LedgerLine,
  type Plan,
  type PlanNode,
  type TimeCategory,
} from './types';

export type TemplateId = 'blank' | 'move-out' | 'clear-debt' | 'career-switch' | 'save-for-hajj';

export interface PlanTemplateInfo {
  id: TemplateId;
  name: string;
  tagline: string;
  description: string;
}

export const PLAN_TEMPLATES: PlanTemplateInfo[] = [
  {
    id: 'blank',
    name: 'Blank plan',
    tagline: 'Start from where you are',
    description:
      'A genesis node with an ordinary week already sketched in, one objective, and sensible guardrails. Build the rest yourself.',
  },
  {
    id: 'move-out',
    name: 'Move out',
    tagline: 'From a family home to your own place',
    description:
      'Build a deposit, find the apartment, absorb the rent jump — and still end the year with a real buffer.',
  },
  {
    id: 'clear-debt',
    name: 'Clear the debt',
    tagline: 'From minus to a cushion',
    description:
      'Free up cash, bank a stretch of extra shifts, and let every surplus month hit the balance until it is gone.',
  },
  {
    id: 'career-switch',
    name: 'Career switch',
    tagline: 'Study nights, land the new role',
    description:
      'Six months of evening study, a portfolio, the interview gauntlet — priced in hours per day so you can see what it costs to sustain.',
  },
  {
    id: 'save-for-hajj',
    name: 'Save for Hajj',
    tagline: 'A fund with a deadline',
    description:
      'A dedicated fund, redirected spending, and a season of extra income, aimed at a full package within thirty months.',
  },
];

/** Canvas placement: dependency bands run left to right, siblings stack. */
const at = (band: number, row: number) => ({ x: 40 + band * 310, y: 110 + row * 190 });

const time = (label: string, value: number, category: TimeCategory): LedgerLine =>
  createLedgerLine({ label, kind: 'time', value, frequency: 'daily', category });

function standardWeek(): LedgerLine[] {
  return [
    time('Sleep', 7, 'sleep'),
    time('Work', 8, 'work'),
    time('Meals & hygiene', 2, 'maintenance'),
    time('Commute', 1, 'maintenance'),
    time('Salah', 1, 'faith'),
    time('Family', 2, 'family'),
    time('Screens', 1, 'entropy'),
  ];
}

function standardConstraints(minCash: number): Constraint[] {
  return [
    createConstraint({ type: 'MIN_CASH', threshold: minCash, severity: 'critical' }),
    createConstraint({ type: 'MIN_SLEEP', threshold: 6, severity: 'critical' }),
    createConstraint({ type: 'MIN_FREE_HOURS', threshold: 0, severity: 'critical' }),
    createConstraint({ type: 'MIN_EMOTIONAL', threshold: 25, severity: 'critical' }),
    createConstraint({ type: 'MIN_RELATIONAL', threshold: 30, severity: 'warning' }),
    createConstraint({ type: 'MIN_SPIRITUAL', threshold: 30, severity: 'warning' }),
  ];
}

function assemble(
  name: string,
  horizonMonths: number,
  nodes: PlanNode[],
  constraints: Constraint[],
): Plan {
  return {
    id: newId('plan'),
    name,
    version: PLAN_SCHEMA_VERSION,
    horizonMonths,
    nodes,
    constraints,
    assumptions: { ...DEFAULT_ASSUMPTIONS },
    telemetry: [],
    currentMonth: 0,
  };
}

function moveOut(): Plan {
  const genesis = createGenesis({
    name: 'Living with family',
    position: at(0, 0),
    initialCash: 4000,
    ledger: [
      createLedgerLine({ label: 'Salary', kind: 'income', value: 3200, frequency: 'monthly' }),
      createLedgerLine({ label: 'Contribution at home', kind: 'expense', value: 300, frequency: 'monthly' }),
      createLedgerLine({ label: 'Groceries & meals out', kind: 'expense', value: 100, frequency: 'weekly' }),
      createLedgerLine({ label: 'Phone & subscriptions', kind: 'expense', value: 150, frequency: 'monthly' }),
      ...standardWeek(),
    ],
  });

  const deposit = createTask({
    name: 'Build the deposit fund',
    position: at(1, 0),
    dependsOn: [{ id: genesis.id }],
    durationMonths: 4,
    hoursPerDayWhileActive: 0.25,
  });

  const search = createTask({
    name: 'Find the apartment',
    position: at(2, 0),
    dependsOn: [{ id: deposit.id }],
    durationMonths: 1,
    hoursPerDayWhileActive: 1,
    emotionalImpactWhileActive: -0.5,
  });

  const move = createTask({
    name: 'Move in',
    position: at(3, 0),
    dependsOn: [{ id: search.id }],
    durationMonths: 1,
    immediateCost: 3600,
    // Rent and utilities beyond the contribution already in the ledger.
    ongoingCost: 1200,
    hoursPerDayWhileActive: 1,
    emotionalImpactAfter: 1,
    relationalImpactAfter: 0.5,
  });

  const objective = createObjective({
    name: 'Standing on my own',
    position: at(4, 0),
    dependsOn: [{ id: move.id }],
    targetCapital: 12000,
    deadlineMonth: 14,
    priority: 1,
  });

  const note = createNote({
    name: 'Why the deposit comes first',
    position: at(1, 1),
    content:
      'The deposit fund has no cash flows of its own: your monthly surplus does the saving. Watch the Dashboard cash curve — the move costs a lump sum plus a permanent rent step, and the plan still has to clear the minimum-cash line.',
  });

  return assemble('Move out', 24, [genesis, deposit, search, move, objective, note], standardConstraints(1500));
}

function clearDebt(): Plan {
  const genesis = createGenesis({
    name: 'Carrying the balance',
    position: at(0, 0),
    initialCash: 800,
    initialDebt: 9500,
    initialEmotional: 65,
    ledger: [
      createLedgerLine({ label: 'Salary', kind: 'income', value: 3400, frequency: 'monthly' }),
      createLedgerLine({ label: 'Rent', kind: 'expense', value: 1000, frequency: 'monthly' }),
      createLedgerLine({ label: 'Groceries', kind: 'expense', value: 110, frequency: 'weekly' }),
      createLedgerLine({ label: 'Utilities & phone', kind: 'expense', value: 180, frequency: 'monthly' }),
      ...standardWeek(),
    ],
  });

  const trim = createTask({
    name: 'Cancel what you don’t use',
    position: at(1, 0),
    dependsOn: [{ id: genesis.id }],
    durationMonths: 1,
    // Freed recurring cash, modelled as income so the surplus hits the debt.
    ongoingIncome: 120,
  });

  const shifts = createTask({
    name: 'Six months of weekend shifts',
    position: at(1, 1),
    dependsOn: [{ id: genesis.id }],
    durationMonths: 6,
    hoursPerDayWhileActive: 2,
    immediateIncome: 3000,
    emotionalImpactWhileActive: -1,
    relationalImpactWhileActive: -0.5,
    optional: true,
  });

  const objective = createObjective({
    name: 'Debt free with a cushion',
    position: at(2, 0),
    dependsOn: [{ id: trim.id }, { id: shifts.id }],
    targetCapital: 2500,
    deadlineMonth: 18,
    priority: 1,
  });

  const note = createNote({
    name: 'How paydown works here',
    position: at(2, 1),
    content:
      'Assumptions → Debt is set to sweep every monthly surplus into the balance (interest accrues at the rate set there). When the balance is halved, call the lender and ask for a lower rate — then change one assumption and watch what it does.',
  });

  return assemble('Clear the debt', 30, [genesis, trim, shifts, objective, note], [
    createConstraint({ type: 'MIN_CASH', threshold: -12000, severity: 'critical', label: 'Never deeper than −$12k' }),
    createConstraint({ type: 'MIN_SLEEP', threshold: 6, severity: 'critical' }),
    createConstraint({ type: 'MIN_FREE_HOURS', threshold: 0, severity: 'critical' }),
    createConstraint({ type: 'MIN_EMOTIONAL', threshold: 25, severity: 'critical' }),
    createConstraint({ type: 'MIN_RELATIONAL', threshold: 30, severity: 'warning' }),
    createConstraint({ type: 'MIN_SPIRITUAL', threshold: 30, severity: 'warning' }),
  ]);
}

function careerSwitch(): Plan {
  const genesis = createGenesis({
    name: 'The current job',
    position: at(0, 0),
    initialCash: 6000,
    ledger: [
      createLedgerLine({ label: 'Salary', kind: 'income', value: 3800, frequency: 'monthly' }),
      createLedgerLine({ label: 'Rent', kind: 'expense', value: 1300, frequency: 'monthly' }),
      createLedgerLine({ label: 'Groceries', kind: 'expense', value: 120, frequency: 'weekly' }),
      createLedgerLine({ label: 'Utilities & phone', kind: 'expense', value: 200, frequency: 'monthly' }),
      ...standardWeek(),
    ],
  });

  const choose = createTask({
    name: 'Choose the target role',
    position: at(1, 0),
    dependsOn: [{ id: genesis.id }],
    durationMonths: 1,
    hoursPerDayWhileActive: 0.5,
  });

  const study = createTask({
    name: 'Study the core skills',
    position: at(2, 0),
    dependsOn: [{ id: choose.id }],
    durationMonths: 6,
    hoursPerDayWhileActive: 2,
    immediateCost: 600,
    emotionalImpactWhileActive: -0.5,
  });

  const portfolio = createTask({
    name: 'Build the portfolio',
    position: at(3, 0),
    dependsOn: [{ id: study.id }],
    durationMonths: 3,
    hoursPerDayWhileActive: 1.5,
  });

  const interviews = createTask({
    name: 'Interview loop',
    position: at(4, 0),
    dependsOn: [{ id: portfolio.id }],
    durationMonths: 2,
    hoursPerDayWhileActive: 1,
    emotionalImpactWhileActive: -1,
  });

  const newRole = createTask({
    name: 'Start the new role',
    position: at(5, 0),
    dependsOn: [{ id: interviews.id }],
    durationMonths: 1,
    ongoingIncome: 900,
    emotionalImpactAfter: 1,
  });

  const objective = createObjective({
    name: 'Established in the new field',
    position: at(6, 0),
    dependsOn: [{ id: newRole.id }],
    targetCapital: 30000,
    deadlineMonth: 30,
    priority: 1,
  });

  const note = createNote({
    name: 'The two numbers that matter',
    position: at(2, 1),
    content:
      'Every task carries a duration and hours-per-day-while-active. Those two numbers are what the scheduler and the day-budget run on — tune them honestly and the Scenario Lab can tell you whether studying harder or longer actually finishes sooner.',
  });

  return assemble(
    'Career switch',
    36,
    [genesis, choose, study, portfolio, interviews, newRole, objective, note],
    standardConstraints(2000),
  );
}

function saveForHajj(): Plan {
  const genesis = createGenesis({
    name: 'Today',
    position: at(0, 0),
    initialCash: 3000,
    initialSpiritual: 70,
    ledger: [
      createLedgerLine({ label: 'Salary', kind: 'income', value: 3600, frequency: 'monthly' }),
      createLedgerLine({ label: 'Rent', kind: 'expense', value: 1100, frequency: 'monthly' }),
      createLedgerLine({ label: 'Groceries', kind: 'expense', value: 110, frequency: 'weekly' }),
      createLedgerLine({ label: 'Utilities & phone', kind: 'expense', value: 180, frequency: 'monthly' }),
      ...standardWeek(),
    ],
  });

  const fund = createTask({
    name: 'Open a dedicated Hajj fund',
    position: at(1, 0),
    dependsOn: [{ id: genesis.id }],
    durationMonths: 1,
    hoursPerDayWhileActive: 0.25,
    spiritualImpactAfter: 0.5,
  });

  const redirect = createTask({
    name: 'Redirect leisure spending',
    position: at(2, 0),
    dependsOn: [{ id: fund.id }],
    durationMonths: 1,
    ongoingIncome: 200,
  });

  const tutoring = createTask({
    name: 'A season of tutoring',
    position: at(2, 1),
    dependsOn: [{ id: fund.id }],
    durationMonths: 6,
    hoursPerDayWhileActive: 1.5,
    immediateIncome: 3600,
    optional: true,
  });

  const objective = createObjective({
    name: 'Hajj fund complete',
    position: at(3, 0),
    dependsOn: [{ id: redirect.id }, { id: tutoring.id }],
    targetCapital: 15000,
    deadlineMonth: 30,
    minSpiritual: 40,
    priority: 1,
  });

  const note = createNote({
    name: 'Costing the package',
    position: at(3, 1),
    content:
      'The target here is a mid-range package including flights; check current prices for your country and adjust the objective. The fund objective requires the spiritual index to hold as well — a plan that saves the money by hollowing out the practice defeats itself.',
  });

  return assemble(
    'Save for Hajj',
    36,
    [genesis, fund, redirect, tutoring, objective, note],
    standardConstraints(1000),
  );
}

export function buildTemplatePlan(id: TemplateId): Plan {
  switch (id) {
    case 'move-out':
      return moveOut();
    case 'clear-debt':
      return clearDebt();
    case 'career-switch':
      return careerSwitch();
    case 'save-for-hajj':
      return saveForHajj();
    case 'blank':
      return createDefaultPlan();
  }
}
