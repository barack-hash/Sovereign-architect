import { describe, expect, it } from 'vitest';
import { migrateLegacyState, type LegacyState } from '../migrate';
import { validateGraph, hasBlockingIssue } from '../graph';
import { simulate } from '../simulate';

/** A realistic v1 save, matching the shapes the old app actually wrote. */
const legacySave = (): LegacyState => ({
  events: [
    {
      id: 'genesis-1',
      type: 'genesis',
      name: 'Genesis Alpha',
      month: 0,
      initialCash: 150000,
      initialDebt: 7500,
      isActiveGenesis: true,
      dependencies: [],
      initialSystemHealth: 80,
      initialRelationalHarmony: 70,
      initialSpiritualAlignment: 60,
      baselineLedger: [
        { id: '1', label: 'Primary Income', type: 'Income', value: 8500, frequency: 'Monthly' },
        { id: '2', label: 'Base Living Expenses', type: 'Expense', value: 3500, frequency: 'Monthly' },
        { id: '3', label: 'Sleep', type: 'Time Use', value: 7, frequency: 'Daily' },
        { id: '4', label: 'Work Hours', type: 'Time Use', value: 8, frequency: 'Daily' },
      ],
    },
    {
      id: 'ev1',
      type: 'event',
      name: 'Buy Car',
      month: 3,
      immediateCost: 12000,
      immediateIncome: 0,
      ongoingCost: 300,
      monthlyIncome: 0,
      timeReclaimed: 1,
      relationalImpact: 2,
      spiritualImpact: 0,
      dependencies: ['genesis-1'],
      status: 'PENDING',
    },
    {
      id: 'obj1',
      type: 'objective',
      name: 'Move Out',
      month: 12,
      targetCapital: 250000,
      targetTimeline: 12,
      dependencies: [{ id: 'ev1', sourceHandle: 'right', targetHandle: 'left' }],
    },
  ],
  cash: 150000,
  debt: 7500,
  income: 8500,
  goalName: 'Move Out',
  targetCapital: 250000,
  targetTimeline: 12,
  healthRedline: 20,
  relationalTripwire: 30,
  spiritualTripwire: 30,
  burnLedger: [
    { id: '1', name: 'Rent/Mortgage', amount: 2200, frequency: 'monthly' },
    { id: '2', name: 'Groceries', amount: 150, frequency: 'weekly' },
  ],
  investmentYield: 7.2,
  systemConstraints: { minCash: 10000, maxBurn: 6000, minSleep: 6, maxLabor: 10, coreContacts: 5 },
  telemetry: [
    { id: 'x', timestamp: 1700000000000, month: 1, category: 'Expense', amount: 42, description: 'Uber' },
  ],
  currentMonth: 1,
  salahActive: true,
  familyTime: 2,
  sleepTime: 7,
  socialMediaTime: 1,
});

describe('migrateLegacyState', () => {
  it('falls back to a fresh default plan when there is nothing to migrate', () => {
    const { plan, migrated } = migrateLegacyState({});
    expect(migrated).toBe(false);
    expect(plan.nodes.some((n) => n.kind === 'genesis')).toBe(true);
  });

  it('produces a structurally valid plan', () => {
    const { plan } = migrateLegacyState(legacySave());
    expect(hasBlockingIssue(validateGraph(plan))).toBe(false);
  });

  it('carries over the Genesis balances and indices', () => {
    const { plan } = migrateLegacyState(legacySave());
    const genesis = plan.nodes.find((n) => n.kind === 'genesis') as any;
    expect(genesis.initialCash).toBe(150000);
    expect(genesis.initialDebt).toBe(7500);
    expect(genesis.initialEmotional).toBe(80);
    expect(genesis.initialRelational).toBe(70);
    expect(genesis.isActive).toBe(true);
  });

  it('converts v1 ledger rows including their capitalised frequencies', () => {
    const { plan } = migrateLegacyState(legacySave());
    const genesis = plan.nodes.find((n) => n.kind === 'genesis') as any;
    const salary = genesis.ledger.find((l: any) => l.label === 'Primary Income');
    expect(salary.kind).toBe('income');
    expect(salary.frequency).toBe('monthly');
    expect(salary.value).toBe(8500);
  });

  it('infers time categories from v1 free-text labels', () => {
    const { plan } = migrateLegacyState(legacySave());
    const genesis = plan.nodes.find((n) => n.kind === 'genesis') as any;
    expect(genesis.ledger.find((l: any) => l.label === 'Sleep').category).toBe('sleep');
    expect(genesis.ledger.find((l: any) => l.label === 'Work Hours').category).toBe('work');
  });

  it('rescues the burn-rate ledger that v1 edited but never used', () => {
    const { plan, notes } = migrateLegacyState(legacySave());
    const genesis = plan.nodes.find((n) => n.kind === 'genesis') as any;
    const rent = genesis.ledger.find((l: any) => l.label === 'Rent/Mortgage');
    const groceries = genesis.ledger.find((l: any) => l.label === 'Groceries');

    expect(rent.value).toBe(2200);
    expect(groceries.frequency).toBe('weekly');
    expect(notes.join(' ')).toMatch(/never used in any calculation/);
  });

  it('turns v1 events into one-month tasks pinned to their old month', () => {
    const { plan } = migrateLegacyState(legacySave());
    const task = plan.nodes.find((n) => n.id === 'ev1') as any;
    expect(task.kind).toBe('task');
    expect(task.durationMonths).toBe(1);
    // v1 month 3 means "cannot start before three months have elapsed".
    expect(task.earliestStartMonth).toBe(2);
    expect(task.immediateCost).toBe(12000);
    expect(task.ongoingCost).toBe(300);
    expect(task.hoursPerDayReclaimed).toBe(1);
  });

  it('preserves dependency edges including their handles', () => {
    const { plan } = migrateLegacyState(legacySave());
    const objective = plan.nodes.find((n) => n.id === 'obj1') as any;
    expect(objective.dependsOn).toEqual([
      { id: 'ev1', sourceHandle: 'right', targetHandle: 'left' },
    ]);
  });

  it('maps the objective target and deadline', () => {
    const { plan } = migrateLegacyState(legacySave());
    const objective = plan.nodes.find((n) => n.id === 'obj1') as any;
    expect(objective.targetCapital).toBe(250000);
    expect(objective.deadlineMonth).toBe(12);
  });

  it('converts every system constraint, including ones v1 never enforced', () => {
    const { plan } = migrateLegacyState(legacySave());
    const types = plan.constraints.map((c) => c.type);
    expect(types).toContain('MIN_CASH');
    expect(types).toContain('MAX_BURN');
    expect(types).toContain('MIN_SLEEP'); // collected but ignored in v1
    expect(types).toContain('MAX_LABOR'); // collected but ignored in v1
    expect(types).toContain('MIN_EMOTIONAL');
    expect(types).toContain('MIN_FREE_HOURS'); // did not exist in v1 at all
  });

  it('notes what could not be carried over instead of dropping it silently', () => {
    const { notes } = migrateLegacyState(legacySave());
    expect(notes.join(' ')).toMatch(/core contacts/i);
    expect(notes.join(' ')).toMatch(/hard-coded/i);
  });

  it('converts telemetry categories', () => {
    const { plan } = migrateLegacyState(legacySave());
    expect(plan.telemetry[0]).toMatchObject({ month: 1, category: 'expense', amount: 42 });
  });

  it('carries the investment yield into assumptions', () => {
    const { plan } = migrateLegacyState(legacySave());
    expect(plan.assumptions.annualYieldPct).toBe(7.2);
  });

  it('promotes a v1 goal with no Objective node onto the canvas', () => {
    const legacy = legacySave();
    legacy.events = legacy.events!.filter((e) => e.type !== 'objective');
    const { plan } = migrateLegacyState(legacy);
    const objective = plan.nodes.find((n) => n.kind === 'objective') as any;
    expect(objective.name).toBe('Move Out');
    expect(objective.targetCapital).toBe(250000);
  });

  it('creates a Genesis from sidebar values when the save had none', () => {
    const { plan, notes } = migrateLegacyState({ cash: 1234, debt: 56, income: 999, events: [] });
    const genesis = plan.nodes.find((n) => n.kind === 'genesis') as any;
    expect(genesis.initialCash).toBe(1234);
    expect(genesis.ledger.some((l: any) => l.kind === 'income' && l.value === 999)).toBe(true);
    expect(notes.join(' ')).toMatch(/No Genesis node existed/);
  });

  it('converts the ten v1 sidebar sliders into real time commitments', () => {
    const legacy = legacySave();
    // Strip the ledger so the slider fallback is what fills in the time budget.
    (legacy.events![0] as any).baselineLedger = [];
    const { plan } = migrateLegacyState(legacy);
    const genesis = plan.nodes.find((n) => n.kind === 'genesis') as any;
    const timeLines = genesis.ledger.filter((l: any) => l.kind === 'time');

    expect(timeLines.map((l: any) => l.category)).toContain('faith');
    expect(timeLines.map((l: any) => l.category)).toContain('family');
    expect(timeLines.map((l: any) => l.category)).toContain('entropy');
  });

  it('yields a plan that actually simulates', () => {
    const { plan } = migrateLegacyState(legacySave());
    const r = simulate(plan);
    expect(r.months.length).toBe(plan.horizonMonths + 1);
    for (const m of r.months) expect(Number.isFinite(m.netWorth)).toBe(true);
  });

  it('tolerates a corrupt save without throwing', () => {
    const { plan } = migrateLegacyState({
      events: [
        { id: 'a', type: 'event', dependencies: [{ nope: true }] },
        { id: 'b' },
        null as any,
      ].filter(Boolean) as any[],
      cash: 'not a number' as any,
    });
    expect(hasBlockingIssue(validateGraph(plan))).toBe(false);
  });
});
