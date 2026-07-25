/**
 * Execution: what to do now, and how reality is tracking against the plan.
 *
 * This replaces v1's Daily Log, which filtered on `n.type === 'eventNode'` and
 * read `node.data.label` — React Flow's node shape — while being handed the
 * domain objects, whose fields are `kind` and `name`. Nothing ever matched, so
 * the view was permanently empty.
 */

import React, { useMemo, useState } from 'react';
import { Activity, CheckCircle2, Clock, Plus, Target, Trash2 } from 'lucide-react';
import type { Analysis } from '../state/useAnalysis';
import { isTask, type Plan, type TelemetryCategory, type TaskNode } from '../engine';
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
  TextInput,
} from '../ui/primitives';
import { hours, money, monthToken, percent } from '../ui/format';
import { cn } from '../lib/utils';

interface Props {
  plan: Plan;
  analysis: Analysis;
  onSetCurrentMonth: (month: number) => void;
  onSetTaskStatus: (id: string, status: TaskNode['status']) => void;
  onAddTelemetry: (entry: {
    month: number;
    category: TelemetryCategory;
    amount: number;
    description: string;
  }) => void;
  onDeleteTelemetry: (id: string) => void;
  onSelectNode: (id: string) => void;
}

export function ExecutionView({
  plan,
  analysis,
  onSetCurrentMonth,
  onSetTaskStatus,
  onAddTelemetry,
  onDeleteTelemetry,
  onSelectNode,
}: Props) {
  const { schedule, simulation } = analysis;
  const month = Math.max(1, plan.currentMonth || 1);
  const state = simulation.months[month];

  const [draft, setDraft] = useState<{ category: TelemetryCategory; amount: number; description: string }>({
    category: 'expense',
    amount: 0,
    description: '',
  });

  /** Work whose scheduled window covers the current month. */
  const activeNow = useMemo(
    () =>
      plan.nodes.filter(isTask).filter((task) => {
        const s = schedule.nodes.get(task.id);
        return s && month > s.earlyStart && month <= s.earlyFinish;
      }),
    [plan.nodes, schedule, month],
  );

  /** Work that could start now: prerequisites done, earliest-start passed. */
  const startingSoon = useMemo(
    () =>
      plan.nodes
        .filter(isTask)
        .filter((task) => {
          const s = schedule.nodes.get(task.id);
          return s && s.earlyStart >= month && s.earlyStart < month + 3;
        })
        .sort((a, b) => (schedule.nodes.get(a.id)?.earlyStart ?? 0) - (schedule.nodes.get(b.id)?.earlyStart ?? 0)),
    [plan.nodes, schedule, month],
  );

  const monthTelemetry = useMemo(
    () => plan.telemetry.filter((t) => t.month === month).sort((a, b) => b.timestamp - a.timestamp),
    [plan.telemetry, month],
  );

  const drift = useMemo(() => {
    if (!state?.actualNetWorth || !state.netWorth) return null;
    return ((state.actualNetWorth - state.netWorth) / Math.abs(state.netWorth)) * 100;
  }, [state]);

  const submit = () => {
    if (!draft.description.trim() || draft.amount === 0) return;
    onAddTelemetry({ month, ...draft, description: draft.description.trim() });
    setDraft({ category: draft.category, amount: 0, description: '' });
  };

  return (
    <div className="flex-1 overflow-y-auto terminal-scroll p-4 md:p-8 space-y-6 md:space-y-8">
      <div>
        <SectionHeading
          right={
            // SectionHeading lays its slots out in a single nowrap row. Letting this
            // cluster wrap and shrink is what keeps the month picker inside 390px
            // instead of pushing the heading row wider than the page.
            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 min-w-0">
              <span className="text-[9px] font-headline uppercase tracking-wider text-on-surface-variant">
                Current month
              </span>
              <Select
                value={String(month)}
                onChange={(v) => onSetCurrentMonth(Number(v))}
                options={Array.from({ length: plan.horizonMonths }, (_, i) => ({
                  value: String(i + 1),
                  label: monthToken(i + 1),
                }))}
                className="!w-24 !py-1 min-h-10 md:min-h-0"
              />
            </div>
          }
        >
          Execution
        </SectionHeading>
        <p className="text-[11px] text-on-surface-variant/80 leading-relaxed max-w-3xl -mt-2">
          The plan says what should be happening this month. Log what actually happened, and the
          cyan line on the dashboard shows how far reality has drifted from the projection.
        </p>
      </div>

      {state && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <SmallStat label="Projected net worth" value={money(state.netWorth)} />
          <SmallStat
            label="Actual"
            value={state.actualNetWorth !== undefined ? money(state.actualNetWorth) : '—'}
            tone="info"
          />
          <SmallStat
            label="Drift"
            value={drift === null ? '—' : `${drift > 0 ? '+' : ''}${drift.toFixed(1)}%`}
            tone={drift === null ? 'neutral' : Math.abs(drift) > 5 ? 'bad' : 'good'}
          />
          <SmallStat
            label="Free time"
            value={hours(state.freeHours)}
            tone={state.freeHours < 0 ? 'bad' : 'good'}
          />
          <SmallStat
            label="Health"
            value={percent(state.emotional)}
            tone={state.emotional < 30 ? 'bad' : state.emotional < 55 ? 'warn' : 'good'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Panel
          title="In progress this month"
          subtitle={`${activeNow.length} task${activeNow.length === 1 ? '' : 's'} · ${hours(
            activeNow.reduce((s, t) => s + t.hoursPerDayWhileActive, 0),
          )}/day committed to them`}
        >
          {activeNow.length === 0 ? (
            <EmptyState hint="Nothing is scheduled to be running in this month. Check the Schedule panel on the dashboard.">
              No active work
            </EmptyState>
          ) : (
            <div className="space-y-2">
              {activeNow.map((task) => {
                const s = schedule.nodes.get(task.id)!;
                const monthsIn = month - s.earlyStart;
                return (
                  <div
                    key={task.id}
                    className="p-3 bg-surface-lowest border border-outline-variant/20 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 md:gap-3 mb-2">
                      <button
                        onClick={() => onSelectNode(task.id)}
                        // py/-my pair grows the tap target without moving the text, so it
                        // still lines up with the badge; min-h-10 guarantees the full 40px
                        // even for a single 11px line. The negative margin keeps the row's
                        // height driven by the badge, so nothing shifts.
                        className="min-w-0 break-words min-h-10 py-3 -my-3 md:min-h-0 md:py-0 md:my-0 text-[11px] font-headline font-bold uppercase tracking-wide text-on-surface hover:text-primary transition-colors text-left"
                      >
                        {task.name}
                      </button>
                      <Badge tone={s.isCritical ? 'bad' : 'neutral'}>
                        {s.isCritical ? 'CRITICAL' : `${s.totalSlack} MO SLACK`}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-mono text-on-surface-variant tabular-nums">
                        month {monthsIn} of {s.durationMonths}
                      </span>
                      <span className="flex-1 h-1 bg-surface-highest">
                        <span
                          className="block h-full bg-primary"
                          style={{ width: `${(monthsIn / s.durationMonths) * 100}%` }}
                        />
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(['active', 'completed', 'failed'] as const).map((status) => (
                        <button
                          key={status}
                          onClick={() => onSetTaskStatus(task.id, status)}
                          className={cn(
                            'px-3 py-2.5 min-h-10 md:min-h-0 md:px-2 md:py-1 text-[9px] font-mono font-bold uppercase border transition-colors',
                            task.status === status
                              ? status === 'completed'
                                ? 'border-primary text-primary bg-primary/10'
                                : status === 'failed'
                                  ? 'border-secondary text-secondary bg-secondary/10'
                                  : 'border-cyan-400 text-cyan-300 bg-cyan-400/10'
                              : 'border-outline-variant/30 text-on-surface-variant hover:text-on-surface',
                          )}
                        >
                          {status === 'failed' ? 'abandoned' : status}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Coming up" subtitle="Starting within three months">
          {startingSoon.length === 0 ? (
            <EmptyState>Nothing queued</EmptyState>
          ) : (
            <div className="space-y-1.5">
              {startingSoon.map((task) => {
                const s = schedule.nodes.get(task.id)!;
                return (
                  <button
                    key={task.id}
                    onClick={() => onSelectNode(task.id)}
                    className="w-full flex items-center justify-between gap-2 md:gap-3 px-3 py-2.5 md:py-2 bg-surface-lowest border-l-2 border-outline-variant/30 hover:border-primary transition-colors text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-[10px] font-mono uppercase text-on-surface truncate">
                        {task.name}
                      </span>
                      <span className="block text-[9px] font-mono text-on-surface-variant/60 mt-0.5">
                        {task.hoursPerDayWhileActive > 0
                          ? `${hours(task.hoursPerDayWhileActive)}/day for ${s.durationMonths} mo`
                          : `${s.durationMonths} mo`}
                        {task.immediateCost > 0 && ` · ${money(task.immediateCost)} upfront`}
                      </span>
                    </span>
                    <Badge tone={s.earlyStart < month + 1 ? 'good' : 'neutral'}>
                      {monthToken(s.earlyStart + 1)}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ---- Telemetry ---- */}
      <Panel
        title="Log what actually happened"
        subtitle={`Month ${month} · ${monthTelemetry.length} entr${monthTelemetry.length === 1 ? 'y' : 'ies'}`}
      >
        <div className="grid grid-cols-1 md:grid-cols-[9rem_8rem_1fr_auto] gap-3 items-end mb-5">
          <Field label="Kind">
            <Select
              value={draft.category}
              onChange={(v) => setDraft({ ...draft, category: v })}
              options={[
                { value: 'expense', label: 'Money out' },
                { value: 'income', label: 'Money in' },
                { value: 'timeInvested', label: 'Time invested' },
                { value: 'timeWasted', label: 'Time wasted' },
              ]}
              className="min-h-10 md:min-h-0"
            />
          </Field>
          <Field label="Amount">
            <NumberInput
              value={draft.amount}
              min={0}
              onChange={(v) => setDraft({ ...draft, amount: v })}
              prefix={draft.category === 'expense' || draft.category === 'income' ? '$' : undefined}
              suffix={draft.category.startsWith('time') ? 'h' : undefined}
              className="min-h-10 md:min-h-0"
            />
          </Field>
          <Field label="What was it">
            <TextInput
              value={draft.description}
              onChange={(v) => setDraft({ ...draft, description: v })}
              placeholder="e.g. car repair, studied Arabic"
              className="min-h-10 md:min-h-0"
            />
          </Field>
          <Button
            variant="primary"
            onClick={submit}
            disabled={!draft.description.trim() || draft.amount === 0}
            className="w-full md:w-auto min-h-10 md:min-h-0"
          >
            <span className="flex items-center justify-center gap-1.5">
              <Plus size={11} /> Log
            </span>
          </Button>
        </div>

        {monthTelemetry.length === 0 ? (
          <p className="text-[10px] font-mono text-on-surface-variant/60 italic">
            Nothing logged for this month yet.
          </p>
        ) : (
          <div className="space-y-1">
            {monthTelemetry.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 md:gap-4 py-2 px-2 border-b border-outline-variant/10 group"
              >
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <Badge
                    tone={
                      entry.category === 'income'
                        ? 'good'
                        : entry.category === 'expense'
                          ? 'bad'
                          : entry.category === 'timeInvested'
                            ? 'info'
                            : 'warn'
                    }
                  >
                    {entry.category === 'timeInvested'
                      ? 'invested'
                      : entry.category === 'timeWasted'
                        ? 'wasted'
                        : entry.category}
                  </Badge>
                  <span className="text-[10px] font-mono text-on-surface truncate">
                    {entry.description}
                  </span>
                </div>
                <div className="flex items-center gap-1 md:gap-3 shrink-0">
                  <span className="text-[10px] font-mono font-bold tabular-nums text-on-surface">
                    {entry.category.startsWith('time')
                      ? hours(entry.amount)
                      : money(entry.category === 'expense' ? -entry.amount : entry.amount)}
                  </span>
                  <button
                    onClick={() => onDeleteTelemetry(entry.id)}
                    // Reveal-on-hover is unreachable on touch, so the delete stays
                    // visible below md and only hides behind hover on pointer devices.
                    className="flex items-center justify-center min-h-10 min-w-10 md:min-h-0 md:min-w-0 text-secondary opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Explain>
          Logged money replaces the projection's assumed flows for months you have already lived.
          Logged time moves the health index directly — invested time builds it, wasted time costs
          more than it builds.
        </Explain>
      </Panel>
    </div>
  );
}

function SmallStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
}) {
  return (
    <div className="bg-surface border border-outline-variant/20 p-3">
      {/* Tighter tracking below md: at two columns on a 390px screen the wide
          spacing pushed labels like "Projected net worth" onto three lines. */}
      <p className="text-[8px] font-headline uppercase tracking-wider md:tracking-[0.15em] text-on-surface-variant mb-1">
        {label}
      </p>
      <p
        className={cn(
          'text-sm font-mono font-bold tabular-nums',
          tone === 'good' && 'text-primary',
          tone === 'warn' && 'text-amber-400',
          tone === 'bad' && 'text-secondary',
          tone === 'info' && 'text-cyan-300',
          tone === 'neutral' && 'text-on-surface',
        )}
      >
        {value}
      </p>
    </div>
  );
}
