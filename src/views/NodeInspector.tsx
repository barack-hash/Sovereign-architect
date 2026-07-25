/**
 * The node inspector: every field the engine reads, editable, in one place.
 *
 * v1's inspector exposed a subset of what the simulator consumed and several
 * fields the simulator ignored, so it was possible to tune a node at length and
 * change nothing. Anything editable here demonstrably moves the projection.
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Analysis } from '../state/useAnalysis';
import {
  TIME_CATEGORIES,
  descendantsOf,
  isGenesis,
  isNote,
  isObjective,
  isTask,
  type Frequency,
  type LedgerLine,
  type Plan,
  type PlanNode,
  type TimeCategory,
} from '../engine';
import {
  Badge,
  Button,
  Explain,
  Field,
  NumberInput,
  Panel,
  Select,
  SliderInput,
  TextInput,
  Toggle,
} from '../ui/primitives';
import { duration, hours, money, monthToken } from '../ui/format';
import { createLedgerLine } from '../engine';

interface Props {
  plan: Plan;
  node: PlanNode;
  analysis: Analysis;
  onUpdate: (id: string, patch: Partial<PlanNode>, historyKey?: string) => void;
  onDelete: (id: string) => void;
  onDisconnect: (source: string, target: string) => void;
  onCommit: () => void;
}

const FREQUENCIES: Array<{ value: Frequency; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

/**
 * Touch sizing for every control in the body, applied once at the wrapper.
 *
 * The ledger rows shrink their inputs and selects with `!py-1`, which lands
 * well under the 40px a thumb needs. There are ~30 controls here, so stretching
 * them from the container is far less invasive than threading a className
 * through each one. Range inputs are covered by the same `min-h`: it beats the
 * height `.slider-touch` (index.css) sets, so the hit area grows while the
 * hairline track that class draws stays exactly as designed.
 *
 * Deliberately no `[&_input[type=range]]:h-*` rule — a height here outranks
 * `.slider-touch` on specificity and would fight the app-wide slider sizing at
 * every breakpoint. `md:min-h-0` hands desktop straight back to the primitives.
 */
const TOUCH_CONTROLS =
  '[&_input]:min-h-10 [&_select]:min-h-10 md:[&_input]:min-h-0 md:[&_select]:min-h-0';

/** Small icon buttons are ~14px of glyph; give them a real target on phones. */
const ICON_BUTTON = 'flex items-center justify-center min-h-10 min-w-10 md:min-h-0 md:min-w-0';

export function NodeInspector({ plan, node, analysis, onUpdate, onDelete, onDisconnect, onCommit }: Props) {
  const scheduled = analysis.schedule.nodes.get(node.id);
  const key = (field: string) => `${node.id}:${field}`;

  // Deleting a node orphans everything downstream of it, so the confirmation
  // needs to say how much is actually at stake.
  const dependentCount = React.useMemo(
    () => descendantsOf(plan.nodes, node.id).size,
    [plan.nodes, node.id],
  );

  const set = <K extends string>(field: K, value: unknown) =>
    onUpdate(node.id, { [field]: value } as Partial<PlanNode>, key(field));

  return (
    // The footer is a sibling of the scroll area, not a sticky child of it.
    // Sticking it inside meant it floated over the fields it was meant to sit
    // below, and its translucent background let the text show through.
    <>
      <div className="flex-1 overflow-y-auto terminal-scroll min-h-0">
        <div className={`p-4 md:p-5 space-y-4 md:space-y-5 ${TOUCH_CONTROLS}`}>
        <Field label="Name">
          <TextInput value={node.name} onChange={(v) => set('name', v)} onCommit={onCommit} />
        </Field>

        {scheduled && !isNote(node) && (
          <div className="grid grid-cols-3 gap-2">
            <ReadOnly label="Starts" value={monthToken(scheduled.earlyStart + 1)} />
            <ReadOnly label="Finishes" value={monthToken(scheduled.earlyFinish)} />
            <ReadOnly
              label="Slack"
              value={scheduled.totalSlack < 0 ? `${scheduled.totalSlack} mo` : `${scheduled.totalSlack} mo`}
              tone={scheduled.totalSlack < 0 ? 'bad' : scheduled.totalSlack === 0 ? 'warn' : 'good'}
            />
          </div>
        )}

        {isGenesis(node) && <GenesisFields node={node} set={set} onUpdate={onUpdate} onCommit={onCommit} nodeKey={key} />}
        {isTask(node) && <TaskFields node={node} set={set} onCommit={onCommit} />}
        {isObjective(node) && <ObjectiveFields node={node} set={set} onCommit={onCommit} analysis={analysis} />}
        {isNote(node) && (
          <Field label="Content">
            <textarea
              value={node.content}
              rows={8}
              onChange={(e) => set('content', e.target.value)}
              onBlur={onCommit}
              // text-base on mobile for the same reason as the input primitive:
              // under 16px iOS Safari zooms the viewport on focus.
              className="w-full bg-surface-lowest border border-outline-variant/30 px-3 py-2.5 md:py-2 text-base md:text-xs text-on-surface focus:border-primary focus:outline-none resize-none"
            />
          </Field>
        )}

        {/* ---- Dependencies ---- */}
        {!isGenesis(node) && (
          <div className="pt-4 border-t border-outline-variant/15">
            <p className="text-[9px] font-headline uppercase tracking-[0.2em] text-on-surface-variant mb-3">
              Prerequisites
            </p>
            {node.dependsOn.length === 0 ? (
              <p className="text-[10px] font-mono text-on-surface-variant/60 italic leading-relaxed">
                Nothing gates this. It can start as soon as its earliest-start month allows — and it
                will not appear on any critical path until something connects to it.
              </p>
            ) : (
              <div className="space-y-1.5">
                {node.dependsOn.map((dep) => {
                  const source = plan.nodes.find((n) => n.id === dep.id);
                  const sourceSchedule = analysis.schedule.nodes.get(dep.id);
                  return (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-2.5 md:py-2 bg-surface-container border border-outline-variant/20"
                    >
                      <span className="min-w-0">
                        <span className="block text-[10px] font-mono uppercase text-on-surface truncate">
                          {source?.name ?? 'Missing node'}
                        </span>
                        {sourceSchedule && (
                          <span className="block text-[8px] font-mono text-on-surface-variant/60 mt-0.5">
                            finishes {monthToken(sourceSchedule.earlyFinish)}
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => onDisconnect(dep.id, node.id)}
                        className={`text-secondary hover:brightness-125 shrink-0 -my-1 md:my-0 ${ICON_BUTTON}`}
                        title="Remove this prerequisite"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* shrink-0 next to a min-h-0 scroller keeps this reachable at any height,
          including a 390px phone with the keyboard open. */}
      <div className="shrink-0 p-4 md:p-5 border-t border-outline-variant/20 bg-surface-container">
        <DeleteNodeButton node={node} dependentCount={dependentCount} onDelete={onDelete} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

/**
 * Two-step delete. The first press arms it and states the consequence; the
 * second commits. Disarms on a timer so it cannot stay armed and be hit by a
 * later, unrelated click.
 */
function DeleteNodeButton({
  node,
  dependentCount,
  onDelete,
}: {
  node: PlanNode;
  dependentCount: number;
  onDelete: (id: string) => void;
}) {
  const [armed, setArmed] = React.useState(false);

  React.useEffect(() => {
    setArmed(false);
  }, [node.id]);

  React.useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(timer);
  }, [armed]);

  if (!armed) {
    return (
      <Button variant="danger" onClick={() => setArmed(true)} className="w-full py-3 md:py-2">
        Delete this node
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {/* break-words: the name is free text, and it is the only thing in this
          footer that can push a long unbroken string past a 390px screen. */}
      <p className="text-[10px] font-mono text-secondary leading-relaxed break-words">
        Delete "{node.name}"?
        {dependentCount > 0 &&
          ` ${dependentCount} node${dependentCount === 1 ? '' : 's'} downstream will lose this prerequisite.`}{' '}
        Undo will bring it back.
      </p>
      <div className="flex gap-2">
        <Button variant="accent" onClick={() => onDelete(node.id)} className="flex-1 py-3 md:py-2">
          Yes, delete
        </Button>
        <Button onClick={() => setArmed(false)} className="flex-1 py-3 md:py-2">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ReadOnly({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  return (
    <div className="bg-surface-lowest border border-outline-variant/15 px-2 py-1.5">
      <p className="text-[8px] font-headline uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p
        className={
          'text-[11px] font-mono font-bold tabular-nums ' +
          (tone === 'bad'
            ? 'text-secondary'
            : tone === 'warn'
              ? 'text-amber-400'
              : tone === 'good'
                ? 'text-primary'
                : 'text-on-surface')
        }
      >
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

function TaskFields({
  node,
  set,
  onCommit,
}: {
  node: Extract<PlanNode, { kind: 'task' }>;
  set: (field: string, value: unknown) => void;
  onCommit: () => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration" hint="months">
          <NumberInput
            value={node.durationMonths}
            min={1}
            onChange={(v) => set('durationMonths', Math.max(1, Math.round(v)))}
            onCommit={onCommit}
            suffix="mo"
          />
        </Field>
        <Field label="Not before" hint="month">
          <NumberInput
            value={node.earliestStartMonth}
            min={0}
            onChange={(v) => set('earliestStartMonth', Math.max(0, Math.round(v)))}
            onCommit={onCommit}
          />
        </Field>
      </div>
      <Explain>
        Duration is what makes critical-path analysis meaningful — it is the length of the bar the
        scheduler slides around. "Not before" pins a task that cannot start early no matter what
        (a lease ending, a course intake).
      </Explain>

      <Field label="Deadline" hint="0 for none">
        <NumberInput
          value={node.deadlineMonth}
          min={0}
          onChange={(v) => set('deadlineMonth', Math.max(0, Math.round(v)))}
          onCommit={onCommit}
        />
      </Field>

      <Panel title="Money" className="!bg-surface-lowest">
        <div className="space-y-3">
          {/* Two panel-nested columns leave ~85px of typing room once the $ and
              /mo affixes are inset, so these pairs stack on a phone. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Upfront cost">
              <NumberInput value={node.immediateCost} min={0} prefix="$" onChange={(v) => set('immediateCost', v)} onCommit={onCommit} />
            </Field>
            <Field label="Payout on finish">
              <NumberInput value={node.immediateIncome} min={0} prefix="$" onChange={(v) => set('immediateIncome', v)} onCommit={onCommit} />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Ongoing cost">
              <NumberInput value={node.ongoingCost} min={0} prefix="$" suffix="/mo" onChange={(v) => set('ongoingCost', v)} onCommit={onCommit} />
            </Field>
            <Field label="Ongoing income">
              <NumberInput value={node.ongoingIncome} min={0} prefix="$" suffix="/mo" onChange={(v) => set('ongoingIncome', v)} onCommit={onCommit} />
            </Field>
          </div>
          <Explain>
            Upfront cost is charged the month the task starts. Payout lands the month it finishes.
            Recurring amounts begin the month after and continue to the horizon.
          </Explain>
        </div>
      </Panel>

      <Panel title="Time" className="!bg-surface-lowest">
        <div className="space-y-3">
          <Field label="Hours per day while doing it">
            <NumberInput
              value={node.hoursPerDayWhileActive}
              min={0}
              max={24}
              step={0.5}
              suffix="h"
              onChange={(v) => set('hoursPerDayWhileActive', v)}
              onCommit={onCommit}
            />
          </Field>
          <Field label="Hours per day freed once done">
            <NumberInput
              value={node.hoursPerDayReclaimed}
              min={0}
              max={24}
              step={0.5}
              suffix="h"
              onChange={(v) => set('hoursPerDayReclaimed', v)}
              onCommit={onCommit}
            />
          </Field>
          <Explain>
            Hours while active are what force work to queue rather than all happening at once. This
            is the single most important field for making the scenario search meaningful.
          </Explain>
        </div>
      </Panel>

      <Panel title="Human cost" subtitle="per month" className="!bg-surface-lowest">
        <div className="space-y-4">
          <p className="text-[9px] font-headline uppercase tracking-[0.15em] text-on-surface-variant">
            While in progress
          </p>
          <SliderInput
            label="Health"
            min={-10}
            max={10}
            step={0.5}
            value={node.emotionalImpactWhileActive}
            display={signedPoints(node.emotionalImpactWhileActive)}
            tone={node.emotionalImpactWhileActive < 0 ? 'bad' : 'good'}
            onChange={(v) => set('emotionalImpactWhileActive', v)}
            onCommit={onCommit}
          />
          <SliderInput
            label="Relationships"
            min={-10}
            max={10}
            step={0.5}
            value={node.relationalImpactWhileActive}
            display={signedPoints(node.relationalImpactWhileActive)}
            tone={node.relationalImpactWhileActive < 0 ? 'bad' : 'good'}
            onChange={(v) => set('relationalImpactWhileActive', v)}
            onCommit={onCommit}
          />
          <SliderInput
            label="Spiritual"
            min={-10}
            max={10}
            step={0.5}
            value={node.spiritualImpactWhileActive}
            display={signedPoints(node.spiritualImpactWhileActive)}
            tone={node.spiritualImpactWhileActive < 0 ? 'bad' : 'good'}
            onChange={(v) => set('spiritualImpactWhileActive', v)}
            onCommit={onCommit}
          />

          <p className="text-[9px] font-headline uppercase tracking-[0.15em] text-on-surface-variant pt-2 border-t border-outline-variant/15">
            After completion
          </p>
          <SliderInput
            label="Health"
            min={-10}
            max={10}
            step={0.5}
            value={node.emotionalImpactAfter}
            display={signedPoints(node.emotionalImpactAfter)}
            tone={node.emotionalImpactAfter < 0 ? 'bad' : 'good'}
            onChange={(v) => set('emotionalImpactAfter', v)}
            onCommit={onCommit}
          />
          <SliderInput
            label="Relationships"
            min={-10}
            max={10}
            step={0.5}
            value={node.relationalImpactAfter}
            display={signedPoints(node.relationalImpactAfter)}
            tone={node.relationalImpactAfter < 0 ? 'bad' : 'good'}
            onChange={(v) => set('relationalImpactAfter', v)}
            onCommit={onCommit}
          />
          <SliderInput
            label="Spiritual"
            min={-10}
            max={10}
            step={0.5}
            value={node.spiritualImpactAfter}
            display={signedPoints(node.spiritualImpactAfter)}
            tone={node.spiritualImpactAfter < 0 ? 'bad' : 'good'}
            onChange={(v) => set('spiritualImpactAfter', v)}
            onCommit={onCommit}
          />
          <Explain>
            Splitting strain from payoff is what lets a hard thing be worth doing: three months at
            −6 health followed by permanent +2 is a very different plan from a flat −1 forever.
          </Explain>
        </div>
      </Panel>

      <Toggle
        checked={node.optional}
        onChange={(v) => set('optional', v)}
        label="Optional"
        hint="Lets the scenario search try plans that skip this"
      />

      <Field label="Execution status">
        <Select
          value={node.status}
          onChange={(v) => set('status', v)}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'active', label: 'In progress' },
            { value: 'completed', label: 'Completed' },
            { value: 'failed', label: 'Abandoned' },
          ]}
        />
      </Field>
    </>
  );
}

const signedPoints = (n: number) => `${n > 0 ? '+' : ''}${n}`;

// ---------------------------------------------------------------------------
// Objective
// ---------------------------------------------------------------------------

function ObjectiveFields({
  node,
  set,
  onCommit,
  analysis,
}: {
  node: Extract<PlanNode, { kind: 'objective' }>;
  set: (field: string, value: unknown) => void;
  onCommit: () => void;
  analysis: Analysis;
}) {
  const outcome = analysis.simulation.objectives.find((o) => o.id === node.id);

  return (
    <>
      {outcome && (
        <div className="p-3 bg-surface-lowest border border-outline-variant/20">
          {outcome.satisfiedMonth !== null ? (
            <p className="text-[10px] font-mono text-primary">
              Reached in month {outcome.satisfiedMonth}
              {outcome.lateBy > 0 && (
                <span className="text-amber-400"> · {outcome.lateBy} months past the deadline</span>
              )}
            </p>
          ) : (
            <p className="text-[10px] font-mono text-secondary leading-relaxed">{outcome.blockedReason}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Target capital" hint="0 to ignore">
          <NumberInput value={node.targetCapital} min={0} prefix="$" onChange={(v) => set('targetCapital', v)} onCommit={onCommit} />
        </Field>
        <Field label="Deadline" hint="month">
          <NumberInput value={node.deadlineMonth} min={0} onChange={(v) => set('deadlineMonth', Math.round(v))} onCommit={onCommit} />
        </Field>
      </div>

      <Panel title="Minimum condition" subtitle="all must hold when it lands" className="!bg-surface-lowest">
        <div className="space-y-4">
          <SliderInput
            label="Health at least"
            min={0}
            max={100}
            value={node.minEmotional}
            display={`${node.minEmotional}%`}
            onChange={(v) => set('minEmotional', v)}
            onCommit={onCommit}
          />
          <SliderInput
            label="Relationships at least"
            min={0}
            max={100}
            value={node.minRelational}
            display={`${node.minRelational}%`}
            onChange={(v) => set('minRelational', v)}
            onCommit={onCommit}
          />
          <SliderInput
            label="Spiritual at least"
            min={0}
            max={100}
            value={node.minSpiritual}
            display={`${node.minSpiritual}%`}
            onChange={(v) => set('minSpiritual', v)}
            onCommit={onCommit}
          />
          <Explain>
            Set these above zero and the goal is only counted as reached if you arrive intact. That
            is what stops the scenario search recommending a plan that wins on money by burning you
            out.
          </Explain>
        </div>
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------------------
// Genesis
// ---------------------------------------------------------------------------

function GenesisFields({
  node,
  set,
  onUpdate,
  onCommit,
  nodeKey,
}: {
  node: Extract<PlanNode, { kind: 'genesis' }>;
  set: (field: string, value: unknown) => void;
  onUpdate: Props['onUpdate'];
  onCommit: () => void;
  nodeKey: (field: string) => string;
}) {
  const updateLedger = (next: LedgerLine[], historyKey?: string) =>
    onUpdate(node.id, { ledger: next } as Partial<PlanNode>, historyKey);

  const patchLine = (lineId: string, patch: Partial<LedgerLine>, field: string) =>
    updateLedger(
      node.ledger.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
      `${lineId}:${field}`,
    );

  const monthlyIncome = node.ledger
    .filter((l) => l.kind === 'income')
    .reduce((s, l) => s + toMonthly(l.value, l.frequency), 0);
  const monthlyExpense = node.ledger
    .filter((l) => l.kind === 'expense')
    .reduce((s, l) => s + toMonthly(l.value, l.frequency), 0);
  const dailyCommitted = node.ledger
    .filter((l) => l.kind === 'time')
    .reduce((s, l) => s + toDaily(l.value, l.frequency), 0);

  return (
    <>
      <Toggle
        checked={node.isActive}
        onChange={(v) => set('isActive', v)}
        label="Active starting point"
        hint="The simulation runs from whichever Genesis is active"
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Cash on hand">
          <NumberInput value={node.initialCash} prefix="$" onChange={(v) => set('initialCash', v)} onCommit={onCommit} />
        </Field>
        <Field label="Debt">
          <NumberInput value={node.initialDebt} min={0} prefix="$" onChange={(v) => set('initialDebt', v)} onCommit={onCommit} />
        </Field>
      </div>

      <Panel title="Starting levels" className="!bg-surface-lowest">
        <div className="space-y-4">
          <SliderInput
            label="Health"
            min={0}
            max={100}
            value={node.initialEmotional}
            display={`${node.initialEmotional}%`}
            onChange={(v) => set('initialEmotional', v)}
            onCommit={onCommit}
          />
          <SliderInput
            label="Relationships"
            min={0}
            max={100}
            value={node.initialRelational}
            display={`${node.initialRelational}%`}
            onChange={(v) => set('initialRelational', v)}
            onCommit={onCommit}
          />
          <SliderInput
            label="Spiritual"
            min={0}
            max={100}
            value={node.initialSpiritual}
            display={`${node.initialSpiritual}%`}
            onChange={(v) => set('initialSpiritual', v)}
            onCommit={onCommit}
          />
          <Field label="Hours in your day" hint="usually 24">
            <NumberInput
              value={node.dailyHours}
              min={1}
              max={24}
              suffix="h"
              onChange={(v) => set('dailyHours', v)}
              onCommit={onCommit}
            />
          </Field>
        </div>
      </Panel>

      {/* ---- The baseline ledger ---- */}
      <Panel
        title="Life as it stands"
        subtitle={`${money(monthlyIncome - monthlyExpense)}/mo · ${hours(dailyCommitted)}/day committed`}
        className="!bg-surface-lowest"
        actions={
          <button
            onClick={() =>
              updateLedger([...node.ledger, createLedgerLine({ label: 'New line' })])
            }
            className={`text-primary hover:brightness-125 -my-2 md:my-0 ${ICON_BUTTON}`}
            title="Add a line"
          >
            <Plus size={14} />
          </button>
        }
      >
        <div className="space-y-2">
          {node.ledger.length === 0 && (
            <p className="text-[10px] font-mono text-on-surface-variant/60 italic">
              Empty. Add your income, your fixed costs, and where your hours already go — this is the
              baseline everything else is measured against.
            </p>
          )}

          {node.ledger.map((line) => (
            <div key={line.id} className="p-2.5 bg-surface border border-outline-variant/20 space-y-2">
              <div className="flex gap-2">
                {/* Only the desktop type size is overridden here. The mobile
                    size has to stay with the primitive's `text-base`: iOS
                    Safari zooms the viewport when a focused field is under
                    16px, which breaks the layout far worse than dense text. */}
                <TextInput
                  value={line.label}
                  onChange={(v) => patchLine(line.id, { label: v }, 'label')}
                  onCommit={onCommit}
                  placeholder="Label"
                  className="!py-1 md:!text-[10px]"
                />
                <button
                  onClick={() => updateLedger(node.ledger.filter((l) => l.id !== line.id))}
                  className={`text-secondary hover:brightness-125 shrink-0 px-1 ${ICON_BUTTON}`}
                  title="Remove"
                >
                  <Trash2 size={11} />
                </button>
              </div>

              {/* 5rem + 5.5rem of fixed columns leaves the frequency select about
                  40px inside a 390px panel, so kind and frequency share a row and
                  the amount runs full width beneath them. Desktop keeps the
                  original three-up row. */}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-[5rem_1fr_5.5rem] md:gap-1.5">
                <Select
                  value={line.kind}
                  onChange={(v) => patchLine(line.id, { kind: v }, 'kind')}
                  options={[
                    { value: 'income', label: 'Income' },
                    { value: 'expense', label: 'Expense' },
                    { value: 'time', label: 'Time' },
                  ]}
                  className="!py-1 !px-2 md:!px-1.5 md:!text-[9px]"
                />
                <Select
                  value={line.frequency}
                  onChange={(v) => patchLine(line.id, { frequency: v }, 'frequency')}
                  options={FREQUENCIES}
                  className="!py-1 !px-2 md:!px-1.5 md:!text-[9px]"
                />
                {/* NumberInput puts its className on the input, not on the grid
                    item, so the span lives on a wrapper. */}
                <div className="col-span-2 md:col-span-1">
                  <NumberInput
                    value={line.value}
                    min={0}
                    onChange={(v) => patchLine(line.id, { value: v }, 'value')}
                    onCommit={onCommit}
                    suffix={line.kind === 'time' ? 'h' : '$'}
                    // px stays unprefixed: `!pr-6` only clears the suffix because
                    // Tailwind emits padding-right after padding-inline, and an
                    // `md:` px would land after it and undo that.
                    className="!py-1 !px-1.5 md:!text-[10px] !pr-6"
                  />
                </div>
              </div>

              {line.kind === 'time' && (
                <Select
                  value={line.category}
                  onChange={(v) => patchLine(line.id, { category: v as TimeCategory }, 'category')}
                  options={TIME_CATEGORIES.map((c) => ({ value: c, label: capitalise(c) }))}
                  className="!py-1 !px-2 md:!px-1.5 md:!text-[9px]"
                />
              )}

              <p className="text-[8px] font-mono text-on-surface-variant/50">
                {line.kind === 'time'
                  ? `${toDaily(line.value, line.frequency).toFixed(2)}h/day`
                  : `${money(toMonthly(line.value, line.frequency))}/mo`}
                {line.kind === 'time' && line.category !== 'other' && ` · counts toward ${line.category}`}
              </p>
            </div>
          ))}
        </div>
        <Explain>
          Time lines are categorised so the sleep, study, family and labour constraints have
          something to measure. In v1 these hours lived in sidebar sliders that never reached the
          simulator.
        </Explain>
      </Panel>
    </>
  );
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Local copies so the inspector can show a live normalisation preview without
// importing the whole engine surface into a render path.
const MONTHLY: Record<Frequency, number> = {
  daily: 30.4375,
  weekly: 4.348,
  biweekly: 2.174,
  monthly: 1,
  yearly: 1 / 12,
};
const DAILY: Record<Frequency, number> = {
  daily: 1,
  weekly: 1 / 7,
  biweekly: 1 / 14,
  monthly: 1 / 30.4375,
  yearly: 1 / 365.25,
};

const toMonthly = (v: number, f: Frequency) => (Number.isFinite(v) ? v : 0) * MONTHLY[f];
const toDaily = (v: number, f: Frequency) => (Number.isFinite(v) ? v : 0) * DAILY[f];
