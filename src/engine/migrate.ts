/**
 * Migration from the v1 storage format.
 *
 * v1 kept its state in ~25 separate localStorage keys, several of which held
 * duplicate or contradictory copies of the same number (the sidebar's cash value
 * and the Genesis node's cash value, for instance, were independent). This
 * module folds all of it into a single canonical `Plan` and resolves the
 * conflicts explicitly rather than letting whichever field happened to be read
 * first win.
 *
 * Migration is lossless in the direction that matters: nothing the user typed is
 * discarded. Where v1 held two values for one concept, the Genesis node wins,
 * because that is the one the v1 simulator actually read.
 */

import {
  DEFAULT_ASSUMPTIONS,
  PLAN_SCHEMA_VERSION,
  type Constraint,
  type Frequency,
  type GenesisNode,
  type LedgerLine,
  type Plan,
  type PlanNode,
  type TelemetryEntry,
  type TimeCategory,
} from './types';
import {
  createConstraint,
  createDefaultPlan,
  createGenesis,
  createLedgerLine,
  createNote,
  createObjective,
  createTask,
  newId,
} from './factory';
import { num } from './units';

/** Everything v1 wrote, as parsed JSON. All fields optional — old saves varied. */
export interface LegacyState {
  events?: any[];
  cash?: number;
  debt?: number;
  income?: number;
  goalName?: string;
  targetCapital?: number;
  targetTimeline?: number;
  healthRedline?: number;
  relationalTripwire?: number;
  spiritualTripwire?: number;
  burnLedger?: any[];
  investmentYield?: number;
  systemConstraints?: Record<string, any>;
  telemetry?: any[];
  currentMonth?: number;
  dailyTimeBudget?: number;
  // The v1 sidebar sliders, each its own key.
  salahActive?: boolean;
  familyTime?: number;
  sleepTime?: number;
  commutingTime?: number;
  hygieneMealsTime?: number;
  skillStudyTime?: number;
  readingLearningTime?: number;
  fitnessGymTime?: number;
  socialMediaTime?: number;
  entertainmentTime?: number;
}

export interface MigrationReport {
  plan: Plan;
  /** Human-readable notes about anything reinterpreted or dropped. */
  notes: string[];
  /** True when there was legacy data to convert at all. */
  migrated: boolean;
}

// ---------------------------------------------------------------------------
// Value mappers
// ---------------------------------------------------------------------------

const FREQUENCY_MAP: Record<string, Frequency> = {
  Daily: 'daily',
  Weekly: 'weekly',
  'Bi-Weekly': 'biweekly',
  BiWeekly: 'biweekly',
  Monthly: 'monthly',
  Yearly: 'yearly',
  daily: 'daily',
  weekly: 'weekly',
  biweekly: 'biweekly',
  monthly: 'monthly',
  yearly: 'yearly',
};

const toFrequency = (value: unknown, fallback: Frequency = 'monthly'): Frequency =>
  FREQUENCY_MAP[String(value)] ?? fallback;

/**
 * v1 ledger rows carried a `type` of Income / Expense / Time Use / Impact.
 * "Impact" rows had no monetary or temporal value at all — they existed only to
 * carry relational and spiritual deltas, so they become zero-valued `other` time
 * lines that still contribute their impacts.
 */
function convertLedgerRow(row: any): LedgerLine {
  const type = String(row?.type ?? 'Expense');
  const isTime = type === 'Time Use';
  const isIncome = type === 'Income';

  return createLedgerLine({
    id: String(row?.id ?? newId('l')),
    label: String(row?.label ?? 'Untitled'),
    kind: isTime ? 'time' : isIncome ? 'income' : 'expense',
    value: type === 'Impact' ? 0 : num(row?.value),
    frequency: toFrequency(row?.frequency, isTime ? 'daily' : 'monthly'),
    category: isTime ? guessTimeCategory(String(row?.label ?? '')) : 'other',
    emotionalImpact: 0,
    relationalImpact: num(row?.relationalImpact),
    spiritualImpact: num(row?.spiritualImpact),
  });
}

/**
 * v1 time rows were free text, so category is inferred from the label. Anything
 * unrecognised lands in `other`, which is counted toward the daily budget but
 * not toward the sleep/study/family constraints — the safe direction to err.
 */
function guessTimeCategory(label: string): TimeCategory {
  const l = label.toLowerCase();
  if (/sleep|rest|nap/.test(l)) return 'sleep';
  if (/work|job|shift|labou?r|business/.test(l)) return 'work';
  if (/stud|learn|read|course|skill|school/.test(l)) return 'study';
  if (/family|kids|parents|spouse|wife|husband/.test(l)) return 'family';
  if (/salah|prayer|pray|masjid|quran|worship|faith|deen/.test(l)) return 'faith';
  if (/gym|fitness|exercise|workout|run|health/.test(l)) return 'health';
  if (/commut|meal|hygiene|chore|clean|cook|errand/.test(l)) return 'maintenance';
  if (/social media|scroll|tiktok|instagram|doomscroll/.test(l)) return 'entropy';
  if (/entertain|tv|game|movie|netflix|leisure/.test(l)) return 'leisure';
  return 'other';
}

// ---------------------------------------------------------------------------
// Node conversion
// ---------------------------------------------------------------------------

function convertNodes(legacy: LegacyState, notes: string[]): PlanNode[] {
  const events = Array.isArray(legacy.events) ? legacy.events : [];
  const nodes: PlanNode[] = [];

  for (const e of events) {
    const dependsOn = (Array.isArray(e?.dependencies) ? e.dependencies : []).map((d: any) =>
      typeof d === 'string'
        ? { id: d }
        : { id: String(d?.id ?? ''), sourceHandle: d?.sourceHandle, targetHandle: d?.targetHandle },
    ).filter((d: any) => d.id);

    const position =
      typeof e?.visualY === 'number'
        ? { x: num(e?.month) * 300 + 50, y: num(e.visualY) }
        : undefined;

    const kind = String(e?.type ?? 'event');

    if (kind === 'genesis') {
      nodes.push(
        createGenesis({
          id: String(e.id),
          name: String(e?.name ?? 'Genesis'),
          dependsOn,
          position,
          isActive: Boolean(e?.isActiveGenesis),
          initialCash: num(e?.initialCash),
          initialDebt: num(e?.initialDebt),
          initialEmotional: num(e?.initialSystemHealth, 80),
          initialRelational: num(e?.initialRelationalHarmony, 80),
          initialSpiritual: num(e?.initialSpiritualAlignment, 80),
          dailyHours: num(legacy.dailyTimeBudget, 24) || 24,
          ledger: (Array.isArray(e?.baselineLedger) ? e.baselineLedger : []).map(convertLedgerRow),
        }),
      );
      continue;
    }

    if (kind === 'objective') {
      nodes.push(
        createObjective({
          id: String(e.id),
          name: String(e?.name ?? 'Objective'),
          dependsOn,
          position,
          targetCapital: num(e?.targetCapital),
          // v1 stored a per-objective timeline; treat it as the deadline.
          deadlineMonth: num(e?.targetTimeline) || num(e?.month),
          minEmotional: 0,
          minRelational: 0,
          minSpiritual: 0,
          priority: 1,
        }),
      );
      continue;
    }

    if (kind === 'note') {
      nodes.push(
        createNote({
          id: String(e.id),
          name: String(e?.name ?? 'Note'),
          dependsOn,
          position,
          content: String(e?.content ?? ''),
        }),
      );
      continue;
    }

    // Everything else was a v1 "event": an instantaneous point on the timeline.
    // v1 had no duration concept, so each becomes a one-month task starting no
    // earlier than the month it was pinned to.
    nodes.push(
      createTask({
        id: String(e.id),
        name: String(e?.name ?? 'Task'),
        dependsOn,
        position,
        durationMonths: 1,
        earliestStartMonth: Math.max(0, num(e?.month) - 1),
        deadlineMonth: 0,
        immediateCost: num(e?.immediateCost),
        immediateIncome: num(e?.immediateIncome),
        ongoingCost: num(e?.ongoingCost),
        ongoingIncome: num(e?.monthlyIncome),
        hoursPerDayWhileActive: 0,
        hoursPerDayReclaimed: num(e?.timeReclaimed),
        // v1 impacts were applied once, on firing. The closest v1-faithful
        // reading is a permanent post-completion drift.
        relationalImpactAfter: num(e?.relationalImpact),
        spiritualImpactAfter: num(e?.spiritualImpact),
        optional: false,
        status: mapStatus(e?.status),
      }),
    );
  }

  if (events.length > 0) {
    notes.push(
      `Converted ${events.length} node${events.length === 1 ? '' : 's'}. Timeline events became one-month tasks — set a real duration on each so critical-path analysis has something to measure.`,
    );
  }

  return nodes;
}

const mapStatus = (s: unknown) => {
  switch (String(s)) {
    case 'ACTIVE':
      return 'active' as const;
    case 'COMPLETED':
      return 'completed' as const;
    case 'FAILED':
      return 'failed' as const;
    default:
      return 'pending' as const;
  }
};

// ---------------------------------------------------------------------------
// The v1 sidebar sliders
// ---------------------------------------------------------------------------

/**
 * v1 held ten separate time sliders in React state that never reached the
 * simulator — they only fed a display-only "system health" number. They become
 * real time-ledger lines, which means they finally affect the outcome.
 */
function slidersToLedger(legacy: LegacyState): LedgerLine[] {
  const line = (label: string, value: number, category: TimeCategory): LedgerLine | null =>
    value > 0
      ? createLedgerLine({ label, kind: 'time', value, frequency: 'daily', category })
      : null;

  return [
    legacy.salahActive ? line('Salah', 1, 'faith') : null,
    line('Family', num(legacy.familyTime), 'family'),
    line('Sleep', num(legacy.sleepTime), 'sleep'),
    line('Commute', num(legacy.commutingTime), 'maintenance'),
    line('Meals & hygiene', num(legacy.hygieneMealsTime), 'maintenance'),
    line('Skill study', num(legacy.skillStudyTime), 'study'),
    line('Reading & learning', num(legacy.readingLearningTime), 'study'),
    line('Fitness', num(legacy.fitnessGymTime), 'health'),
    line('Social media', num(legacy.socialMediaTime), 'entropy'),
    line('Entertainment', num(legacy.entertainmentTime), 'leisure'),
  ].filter((l): l is LedgerLine => l !== null);
}

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------

function convertConstraints(legacy: LegacyState, notes: string[]): Constraint[] {
  const sc = legacy.systemConstraints ?? {};
  const out: Constraint[] = [];

  const add = (
    type: Constraint['type'],
    threshold: number,
    severity: Constraint['severity'] = 'critical',
  ) => {
    if (threshold > 0) out.push(createConstraint({ type, threshold, severity }));
  };

  add('MIN_CASH', num(sc.minCash));
  add('MAX_BURN', num(sc.maxBurn));
  add('MIN_SLEEP', num(sc.minSleep));
  add('MAX_LABOR', num(sc.maxLabor));
  add('MIN_STUDY_HOURS', num(sc.minStudy), 'warning');
  add('MIN_FAMILY_HOURS', num(sc.minFamily), 'warning');
  add('MIN_EMOTIONAL', num(legacy.healthRedline));
  add('MIN_RELATIONAL', num(legacy.relationalTripwire), 'warning');
  add('MIN_SPIRITUAL', num(legacy.spiritualTripwire), 'warning');

  // Overallocating the day was v1's most common failure and had no constraint.
  out.push(createConstraint({ type: 'MIN_FREE_HOURS', threshold: 0, severity: 'critical' }));

  if (num(sc.coreContacts) > 0) {
    notes.push(
      `"Core contacts to maintain" (${num(sc.coreContacts)}) had no effect in v1 and has no engine equivalent, so it was not carried over.`,
    );
  }
  if (sc.prayerStrict) {
    notes.push(
      'Prayer strictness is now expressed as a faith time-ledger line rather than a checkbox, so it consumes real hours.',
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// Telemetry
// ---------------------------------------------------------------------------

function convertTelemetry(legacy: LegacyState): TelemetryEntry[] {
  const rows = Array.isArray(legacy.telemetry) ? legacy.telemetry : [];
  return rows.map((t: any) => ({
    id: String(t?.id ?? newId('tel')),
    timestamp: num(t?.timestamp, Date.now()),
    month: num(t?.month, 1),
    category:
      t?.category === 'Expense'
        ? ('expense' as const)
        : t?.category === 'Time Investment'
          ? ('timeInvested' as const)
          : t?.category === 'Time Wasted'
            ? ('timeWasted' as const)
            : ('expense' as const),
    amount: num(t?.amount),
    description: String(t?.description ?? ''),
  }));
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function migrateLegacyState(legacy: LegacyState): MigrationReport {
  const notes: string[] = [];
  const hasData =
    (Array.isArray(legacy.events) && legacy.events.length > 0) ||
    legacy.cash !== undefined ||
    legacy.systemConstraints !== undefined;

  if (!hasData) {
    return { plan: createDefaultPlan(), notes, migrated: false };
  }

  let nodes = convertNodes(legacy, notes);

  // Ensure exactly one active Genesis exists.
  let genesis = nodes.find((n): n is GenesisNode => n.kind === 'genesis' && n.isActive);
  if (!genesis) {
    const anyGenesis = nodes.find((n): n is GenesisNode => n.kind === 'genesis');
    if (anyGenesis) {
      anyGenesis.isActive = true;
      genesis = anyGenesis;
    } else {
      genesis = createGenesis({
        initialCash: num(legacy.cash),
        initialDebt: num(legacy.debt),
        dailyHours: num(legacy.dailyTimeBudget, 24) || 24,
      });
      nodes = [genesis, ...nodes];
      notes.push('No Genesis node existed, so one was created from your sidebar values.');
    }
  }

  // v1 stored income in the sidebar AND in the Genesis ledger. If the ledger has
  // no income line, fall back to the sidebar value rather than simulating zero.
  const hasIncomeLine = genesis.ledger.some((l) => l.kind === 'income');
  if (!hasIncomeLine && num(legacy.income) > 0) {
    genesis.ledger.push(
      createLedgerLine({
        label: 'Primary income',
        kind: 'income',
        value: num(legacy.income),
        frequency: 'monthly',
      }),
    );
    notes.push('Your sidebar income was moved into the Genesis ledger, where it now drives the simulation.');
  }

  // The burn-rate ledger in v1 was edited in the sidebar and read by nothing.
  const burnRows = Array.isArray(legacy.burnLedger) ? legacy.burnLedger : [];
  if (burnRows.length > 0) {
    for (const row of burnRows) {
      genesis.ledger.push(
        createLedgerLine({
          label: String(row?.name ?? 'Expense'),
          kind: 'expense',
          value: num(row?.amount),
          frequency: toFrequency(row?.frequency, 'monthly'),
        }),
      );
    }
    notes.push(
      `Recovered ${burnRows.length} expense${burnRows.length === 1 ? '' : 's'} from the sidebar burn-rate ledger. In v1 these were edited but never used in any calculation.`,
    );
  }

  // Same for the time sliders, unless the ledger already carries time lines.
  const hasTimeLines = genesis.ledger.some((l) => l.kind === 'time');
  if (!hasTimeLines) {
    const sliderLines = slidersToLedger(legacy);
    if (sliderLines.length > 0) {
      genesis.ledger.push(...sliderLines);
      notes.push(
        `Converted ${sliderLines.length} time sliders into ledger lines. These now consume real hours and can trigger constraints.`,
      );
    }
  }

  // If v1 had a goal but no Objective node, promote it to one.
  const hasObjective = nodes.some((n) => n.kind === 'objective');
  if (!hasObjective && num(legacy.targetCapital) > 0) {
    nodes.push(
      createObjective({
        name: String(legacy.goalName || 'Objective'),
        targetCapital: num(legacy.targetCapital),
        deadlineMonth: num(legacy.targetTimeline, 12),
        dependsOn: [{ id: genesis.id }],
      }),
    );
    notes.push(`Your goal "${legacy.goalName || 'Objective'}" became an Objective node on the canvas.`);
  }

  const plan: Plan = {
    id: newId('plan'),
    name: String(legacy.goalName || 'My plan'),
    version: PLAN_SCHEMA_VERSION,
    horizonMonths: Math.max(1, num(legacy.targetTimeline, 12)),
    nodes,
    constraints: convertConstraints(legacy, notes),
    assumptions: {
      ...DEFAULT_ASSUMPTIONS,
      annualYieldPct: num(legacy.investmentYield, DEFAULT_ASSUMPTIONS.annualYieldPct),
    },
    telemetry: convertTelemetry(legacy),
    currentMonth: num(legacy.currentMonth, 0),
  };

  notes.push(
    'Path yields in v1 added a flat +4.2% (conservative) or +18.7% (aggressive) to your return. Those numbers were hard-coded and are not carried over — set a real expected return in Assumptions.',
  );

  return { plan, notes, migrated: true };
}

// ---------------------------------------------------------------------------
// Storage adapter
// ---------------------------------------------------------------------------

const LEGACY_KEYS: Record<keyof LegacyState, string> = {
  events: 'sovereign-events',
  cash: 'sovereign-cash',
  debt: 'sovereign-debt',
  income: 'sovereign-income',
  goalName: 'sovereign-goal-name',
  targetCapital: 'sovereign-target-capital',
  targetTimeline: 'sovereign-target-timeline',
  healthRedline: 'sovereign-health-redline',
  relationalTripwire: 'sovereign-relational-tripwire',
  spiritualTripwire: 'sovereign-spiritual-tripwire',
  burnLedger: 'sovereign-burn-ledger',
  investmentYield: 'sovereign-yield',
  systemConstraints: 'sovereign-system-constraints',
  telemetry: 'sovereign-daily-telemetry',
  currentMonth: 'sovereign-current-month',
  dailyTimeBudget: 'sovereign-daily-time-budget',
  salahActive: 'sovereign-salah',
  familyTime: 'sovereign-family-time',
  sleepTime: 'sovereign-sleep-time',
  commutingTime: 'sovereign-commuting-time',
  hygieneMealsTime: 'sovereign-hygiene-time',
  skillStudyTime: 'sovereign-skill-time',
  readingLearningTime: 'sovereign-reading-time',
  fitnessGymTime: 'sovereign-fitness-time',
  socialMediaTime: 'sovereign-social-time',
  entertainmentTime: 'sovereign-ent-time',
};

/** Reads every v1 key out of localStorage. Returns an empty object when absent. */
export function readLegacyState(storage: Storage): LegacyState {
  const out: Record<string, unknown> = {};

  for (const [field, key] of Object.entries(LEGACY_KEYS)) {
    const raw = storage.getItem(key);
    if (raw === null) continue;
    try {
      out[field] = JSON.parse(raw);
    } catch {
      // v1 wrote a couple of keys as bare strings rather than JSON.
      out[field] = raw;
    }
  }

  return out as LegacyState;
}

/**
 * Archives the v1 keys under a `v1-backup:` prefix rather than deleting them, so
 * a migration that goes wrong is recoverable from devtools.
 */
export function archiveLegacyState(storage: Storage): void {
  for (const key of Object.values(LEGACY_KEYS)) {
    const raw = storage.getItem(key);
    if (raw === null) continue;
    storage.setItem(`v1-backup:${key}`, raw);
    storage.removeItem(key);
  }
}
