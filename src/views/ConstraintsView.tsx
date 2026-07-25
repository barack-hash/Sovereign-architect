/**
 * Constraints: the lines you have decided not to cross.
 *
 * v1 offered eight constraint inputs and enforced two of them. Every type here
 * is evaluated every month by the engine, and each row shows whether it actually
 * holds across the current projection.
 */

import React from 'react';
import { CheckCircle2, Plus, Shield, Trash2 } from 'lucide-react';
import type { Analysis } from '../state/useAnalysis';
import {
  CONSTRAINT_LABELS,
  CONSTRAINT_UNITS,
  createConstraint,
  type Constraint,
  type ConstraintType,
  type Plan,
} from '../engine';
import {
  Badge,
  Button,
  EmptyState,
  Explain,
  Field,
  NumberInput,
  Panel,
  SectionHeading,
  Select,
  Toggle,
} from '../ui/primitives';
import { monthToken } from '../ui/format';
import { cn } from '../lib/utils';

interface Props {
  plan: Plan;
  analysis: Analysis;
  onUpdate: (id: string, patch: Partial<Constraint>, historyKey?: string) => void;
  onAdd: (constraint: Constraint) => void;
  onDelete: (id: string) => void;
  onCommit: () => void;
}

const GROUPS: Array<{ title: string; blurb: string; types: ConstraintType[] }> = [
  {
    title: 'Financial',
    blurb: 'Money floors and ceilings, checked against net worth and monthly outflow.',
    types: ['MIN_CASH', 'MAX_BURN'],
  },
  {
    title: 'Time',
    blurb:
      'Checked against the hours your Genesis ledger commits, plus whatever tasks are running that month.',
    types: ['MIN_SLEEP', 'MAX_LABOR', 'MIN_FREE_HOURS', 'MIN_STUDY_HOURS', 'MIN_FAMILY_HOURS'],
  },
  {
    title: 'Human',
    blurb: 'Floors on the three indices. These are what stop a plan winning on money alone.',
    types: ['MIN_EMOTIONAL', 'MIN_RELATIONAL', 'MIN_SPIRITUAL'],
  },
];

export function ConstraintsView({ plan, analysis, onUpdate, onAdd, onDelete, onCommit }: Props) {
  const { simulation } = analysis;

  const breachByConstraint = React.useMemo(() => {
    const map = new Map<string, { month: number; count: number; message: string }>();
    for (const v of simulation.violations) {
      const existing = map.get(v.constraintId);
      if (existing) existing.count += 1;
      else map.set(v.constraintId, { month: v.month, count: 1, message: v.message });
    }
    return map;
  }, [simulation.violations]);

  const used = new Set(plan.constraints.map((c) => c.type));
  const available = (Object.keys(CONSTRAINT_LABELS) as ConstraintType[]).filter((t) => !used.has(t));

  return (
    <div className="flex-1 overflow-y-auto terminal-scroll p-4 md:p-8 space-y-6 md:space-y-8">
      <div>
        <SectionHeading
          right={
            breachByConstraint.size === 0 ? (
              <Badge tone="good">ALL HOLDING</Badge>
            ) : (
              <Badge tone="bad">{breachByConstraint.size} BREACHED</Badge>
            )
          }
        >
          Constraints
        </SectionHeading>
        <p className="text-[11px] text-on-surface-variant/80 leading-relaxed max-w-3xl -mt-2">
          A constraint does not change the plan; it tells you when the plan has crossed a line you
          said mattered. Breaches feed the safety score in the Scenario Lab, so orderings that keep
          you whole rank higher.
        </p>
      </div>

      {GROUPS.map((group) => {
        const rows = plan.constraints.filter((c) => group.types.includes(c.type));
        return (
          <Panel key={group.title} title={group.title} subtitle={group.blurb}>
            {rows.length === 0 ? (
              <p className="text-[10px] font-mono text-on-surface-variant/60 italic">
                None set in this group.
              </p>
            ) : (
              // Rows are taller once stacked on a phone, so they need a touch more
              // separation to read as distinct cards.
              <div className="space-y-3 md:space-y-2">
                {rows.map((constraint) => (
                  <ConstraintRow
                    key={constraint.id}
                    constraint={constraint}
                    breach={breachByConstraint.get(constraint.id)}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onCommit={onCommit}
                  />
                ))}
              </div>
            )}
          </Panel>
        );
      })}

      <Panel title="Add a constraint">
        {available.length === 0 ? (
          <p className="text-[10px] font-mono text-on-surface-variant/60 italic">
            Every constraint type is already in use.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {available.map((type) => (
              <Button
                key={type}
                onClick={() =>
                  onAdd(createConstraint({ type, threshold: defaultThreshold(type), severity: 'critical' }))
                }
                // Labels run to ~24 characters, so the chips wrap rather than
                // overflow at 390px; the min height keeps them tappable.
                className="inline-flex items-center min-h-[40px] md:min-h-0 py-2.5 md:py-2 text-left"
              >
                <span className="flex items-center gap-1.5">
                  <Plus size={10} className="shrink-0" /> {CONSTRAINT_LABELS[type]}
                </span>
              </Button>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ConstraintRow({
  constraint,
  breach,
  onUpdate,
  onDelete,
  onCommit,
}: {
  constraint: Constraint;
  breach?: { month: number; count: number; message: string };
  onUpdate: Props['onUpdate'];
  onDelete: Props['onDelete'];
  onCommit: () => void;
}) {
  const unit = CONSTRAINT_UNITS[constraint.type];
  const isMoney = unit === '$' || unit === '$/mo';

  return (
    <div
      className={cn(
        // Phone: name/status on its own line, then threshold and severity side by
        // side, then the action buttons. Desktop keeps the original single row.
        'grid grid-cols-2 md:grid-cols-[1fr_8rem_7rem_auto] gap-3 items-end p-3 border transition-colors',
        !constraint.enabled
          ? 'border-outline-variant/15 opacity-50'
          : breach
            ? constraint.severity === 'critical'
              ? 'border-secondary/40 bg-secondary/5'
              : 'border-amber-400/30 bg-amber-400/5'
            : 'border-outline-variant/20',
      )}
    >
      <div className="col-span-2 md:col-span-1 min-w-0">
        <p className="text-[10px] font-headline font-bold uppercase tracking-wider text-on-surface">
          {CONSTRAINT_LABELS[constraint.type]}
        </p>
        {breach ? (
          <p className="text-[9px] font-mono text-secondary mt-1 leading-relaxed">
            First breach {monthToken(breach.month)} · {breach.count} month
            {breach.count === 1 ? '' : 's'} affected
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-[9px] font-mono text-primary mt-1">
            <CheckCircle2 size={9} /> holds all horizon
          </p>
        )}
      </div>

      <Field label={`Threshold (${unit})`}>
        <NumberInput
          value={constraint.threshold}
          min={0}
          prefix={isMoney ? '$' : undefined}
          onChange={(v) => onUpdate(constraint.id, { threshold: v }, `${constraint.id}:threshold`)}
          onCommit={onCommit}
          className="min-h-[40px] md:min-h-0 py-2.5 md:py-2"
        />
      </Field>

      <Field label="Severity">
        <Select
          value={constraint.severity}
          onChange={(v) => onUpdate(constraint.id, { severity: v })}
          options={[
            { value: 'critical', label: 'Critical' },
            { value: 'warning', label: 'Warning' },
          ]}
          className="min-h-[40px] md:min-h-0 py-2.5 md:py-2"
        />
      </Field>

      <div className="col-span-2 md:col-span-1 flex items-center gap-2 pb-0.5">
        <button
          onClick={() => onUpdate(constraint.id, { enabled: !constraint.enabled })}
          className={cn(
            // Sized as a real touch target on phones; collapses back to the
            // original compact chip from md up.
            'inline-flex items-center justify-center min-w-[5rem] min-h-[40px] md:min-w-0 md:min-h-0',
            'px-2.5 py-2 border text-[9px] font-mono font-bold uppercase transition-colors',
            constraint.enabled
              ? 'border-primary/40 text-primary hover:bg-primary/10'
              : 'border-outline-variant/30 text-on-surface-variant hover:text-on-surface',
          )}
          title={constraint.enabled ? 'Disable' : 'Enable'}
        >
          {constraint.enabled ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={() => onDelete(constraint.id)}
          className="inline-flex items-center justify-center shrink-0 min-w-[40px] min-h-[40px] md:min-w-0 md:min-h-0 p-2 text-secondary hover:brightness-125"
          title="Remove"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function defaultThreshold(type: ConstraintType): number {
  switch (type) {
    case 'MIN_CASH':
      return 2000;
    case 'MAX_BURN':
      return 5000;
    case 'MIN_SLEEP':
      return 6;
    case 'MAX_LABOR':
      return 10;
    case 'MIN_FREE_HOURS':
      return 0;
    case 'MIN_STUDY_HOURS':
      return 5;
    case 'MIN_FAMILY_HOURS':
      return 10;
    default:
      return 30;
  }
}
