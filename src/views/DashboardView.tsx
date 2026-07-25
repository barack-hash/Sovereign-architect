/**
 * The main projection: where the plan takes you across all five capitals.
 *
 * Every number here comes from the engine. Nothing is hard-coded, which is the
 * substantive difference from v1 — its comparison cards displayed a fixed
 * "4.2% / 18.7% annual variance" and a fixed "EMOTIONAL TAX 2.5 / 8.2"
 * regardless of what the plan contained.
 */

import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flag,
  Hourglass,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Analysis } from '../state/useAnalysis';
import type { Plan } from '../engine';
import { isObjective } from '../engine';
import { Badge, EmptyState, Meter, Panel, SectionHeading, Stat } from '../ui/primitives';
import { duration, hours, money, moneyShort, monthToken, percent, slackLabel } from '../ui/format';
import { cn } from '../lib/utils';

interface Props {
  plan: Plan;
  analysis: Analysis;
  onSelectNode: (id: string) => void;
}

export function DashboardView({ plan, analysis, onSelectNode }: Props) {
  const { simulation, schedule, objectivePaths, risk, issues } = analysis;
  const final = simulation.months[simulation.months.length - 1];
  const start = simulation.months[0];

  const chartData = useMemo(
    () =>
      simulation.months.map((m, i) => ({
        label: m.label,
        month: m.month,
        netWorth: m.netWorth,
        emotional: m.emotional,
        relational: m.relational,
        spiritual: m.spiritual,
        freeHours: m.freeHours,
        actualNetWorth: m.actualNetWorth ?? null,
        actualEmotional: m.actualEmotional ?? null,
        violations: m.violations,
        // Monte Carlo bands are rendered as a stacked area: the base is p5 and
        // the visible band is the span up to p95.
        bandBase: risk ? risk.netWorthBands[i]?.p5 : undefined,
        bandSpan: risk ? (risk.netWorthBands[i]?.p95 ?? 0) - (risk.netWorthBands[i]?.p5 ?? 0) : undefined,
      })),
    [simulation.months, risk],
  );

  const objectives = plan.nodes.filter(isObjective);
  const netChange = final.netWorth - start.netWorth;
  const blockingIssues = issues.filter((i) => i.severity === 'error');

  const criticalTasks = useMemo(
    () =>
      [...schedule.nodes.values()]
        .filter((n) => n.kind === 'task')
        .sort((a, b) => a.earlyStart - b.earlyStart),
    [schedule],
  );

  return (
    <div className="flex-1 overflow-y-auto terminal-scroll p-4 md:p-8 space-y-6 md:space-y-10">
      {blockingIssues.length > 0 && (
        <div className="border-2 border-secondary bg-secondary/5 p-4 md:p-5">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle size={16} className="text-secondary shrink-0" />
            {/* Wide letter-spacing on a 23-character heading overflows a 390px
                screen, so the tracking only opens up from md. */}
            <h3 className="text-[11px] font-headline font-bold uppercase tracking-wider md:tracking-[0.25em] text-secondary">
              Plan cannot be simulated
            </h3>
          </div>
          <ul className="space-y-1.5">
            {blockingIssues.map((issue, i) => (
              <li key={i} className="text-[11px] font-mono text-on-surface leading-relaxed break-words">
                — {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- The five capitals ---- */}
      <section>
        <SectionHeading
          right={
            <span className="text-[9px] font-mono text-on-surface-variant whitespace-nowrap">
              HORIZON {duration(plan.horizonMonths).toUpperCase()}
            </span>
          }
        >
          The Five Capitals
        </SectionHeading>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <Stat
            label="Financial"
            value={moneyShort(final.netWorth)}
            sub={`${netChange >= 0 ? '+' : ''}${moneyShort(netChange)} over ${duration(plan.horizonMonths)}`}
            tone={final.netWorth >= start.netWorth ? 'good' : 'bad'}
            icon={<TrendingUp size={16} />}
          />
          <Stat
            label="Temporal"
            value={final.isOverallocated ? 'OVER' : hours(final.freeHours)}
            sub={
              final.isOverallocated
                ? `${hours(Math.abs(final.freeHours))} beyond a day`
                : 'free per day at horizon'
            }
            tone={final.isOverallocated ? 'bad' : simulation.minFreeHours < 1 ? 'warn' : 'good'}
            icon={<Hourglass size={16} />}
          />
          <Stat
            label="Emotional"
            value={percent(final.emotional)}
            sub={`floor ${percent(simulation.minEmotional)}`}
            tone={simulation.minEmotional < 30 ? 'bad' : simulation.minEmotional < 55 ? 'warn' : 'good'}
            icon={<Activity size={16} />}
          />
          <Stat
            label="Relational"
            value={percent(final.relational)}
            sub={`floor ${percent(simulation.minRelational)}`}
            tone={simulation.minRelational < 30 ? 'bad' : simulation.minRelational < 55 ? 'warn' : 'info'}
            icon={<Users size={16} />}
          />
          <Stat
            label="Spiritual"
            value={percent(final.spiritual)}
            sub={`floor ${percent(simulation.minSpiritual)}`}
            tone={simulation.minSpiritual < 30 ? 'bad' : simulation.minSpiritual < 55 ? 'warn' : 'info'}
            icon={<Sparkles size={16} />}
          />
        </div>
      </section>

      {/* ---- Objectives ---- */}
      <section>
        <SectionHeading>Objectives</SectionHeading>

        {objectives.length === 0 ? (
          <EmptyState hint="Add an Objective node on the canvas and connect the work that leads to it. Until then there is nothing for the engine to aim at.">
            No objectives defined
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
            {objectivePaths.map(({ objective, path, months }) => {
              const met = objective.satisfiedMonth !== null;
              const late = objective.lateBy > 0;

              return (
                <Panel
                  key={objective.id}
                  tone={met ? (late ? 'default' : 'primary') : 'danger'}
                  title={
                    <span className="flex items-center gap-2 min-w-0">
                      <Flag
                        size={12}
                        className={cn('shrink-0', met ? 'text-primary' : 'text-secondary')}
                      />
                      <span className="truncate">{objective.name}</span>
                    </span>
                  }
                  subtitle={
                    objective.targetCapital > 0 ? `Target ${money(objective.targetCapital)}` : 'Structural goal'
                  }
                  actions={
                    met ? (
                      late ? (
                        <Badge tone="warn">{objective.lateBy} MO LATE</Badge>
                      ) : (
                        <Badge tone="good">MONTH {objective.satisfiedMonth}</Badge>
                      )
                    ) : (
                      <Badge tone="bad">NOT REACHED</Badge>
                    )
                  }
                >
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-[9px] font-mono uppercase tracking-wider text-on-surface-variant mb-1.5">
                        <span>Progress</span>
                        <span>{percent(objective.peakProgress * 100, 0)}</span>
                      </div>
                      <Meter
                        value={objective.peakProgress * 100}
                        tone={met ? 'good' : objective.peakProgress > 0.6 ? 'warn' : 'bad'}
                      />
                    </div>

                    {objective.blockedReason && (
                      <p className="text-[10px] font-mono text-secondary leading-relaxed">
                        {objective.blockedReason}
                      </p>
                    )}

                    <div>
                      {/* This label runs ~45 characters; wide tracking pushes it
                          past 390px, so it only opens up from md. */}
                      <p className="text-[9px] font-headline uppercase tracking-normal md:tracking-[0.15em] text-on-surface-variant mb-2">
                        Critical chain — {duration(months)} of sequential work
                      </p>
                      {path.length <= 1 ? (
                        <p className="text-[10px] font-mono text-on-surface-variant/60 italic">
                          Nothing feeds this objective. Connect the work that leads to it.
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {path.map((id, i) => {
                            const node = plan.nodes.find((n) => n.id === id);
                            const scheduled = schedule.nodes.get(id);
                            return (
                              <React.Fragment key={id}>
                                {i > 0 && (
                                  <ArrowRight size={10} className="text-on-surface-variant/40 shrink-0" />
                                )}
                                {/* min-h keeps each crumb a 40px touch target on a
                                    phone; it collapses back to the tight chip at md.
                                    min-w-0 + wrap-anywhere are what make max-w-full
                                    binding: without them the chip's automatic
                                    minimum size is the longest word in the node
                                    name, so a single long token would still push
                                    past the panel. */}
                                <button
                                  onClick={() => onSelectNode(id)}
                                  className="inline-flex items-center min-w-0 max-w-full min-h-10 md:min-h-0 px-2.5 md:px-2 py-2 md:py-1 bg-surface-container border border-outline-variant/30 hover:border-primary/50 transition-colors text-[9px] font-mono uppercase tracking-tight text-on-surface text-left wrap-anywhere"
                                >
                                  {node?.name ?? id}
                                  {scheduled && scheduled.durationMonths > 0 && (
                                    <span className="ml-1.5 text-on-surface-variant/60">
                                      {scheduled.durationMonths}mo
                                    </span>
                                  )}
                                </button>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </section>

      {/* ---- Trajectory ---- */}
      <Panel
        title="Trajectory"
        subtitle={
          risk
            ? `Plan against ${risk.trials} simulated futures — shaded band is the 5th to 95th percentile`
            : 'Projected capital against system health'
        }
        actions={
          // The panel header keeps its actions from shrinking, so the max-width
          // is what lets three swatches wrap onto two lines on a phone. The cap
          // lifts at sm, not md: by 640px the header has room for all three on
          // one line, and holding it to md would wrap them for no reason.
          <div className="flex flex-wrap justify-end items-center gap-x-3 gap-y-1 md:gap-4 max-w-[9.5rem] sm:max-w-none">
            <LegendSwatch color="#4be277" label="Net worth" />
            <LegendSwatch color="#ffb690" label="Health" />
            {plan.currentMonth > 0 && <LegendSwatch color="#22d3ee" label="Actual" />}
          </div>
        }
      >
        <div className="h-56 md:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#2a2a2e" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#7d8a7d', fontSize: 9 }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                yAxisId="money"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#7d8a7d', fontSize: 9 }}
                tickFormatter={moneyShort}
                width={56}
              />
              <YAxis yAxisId="index" orientation="right" domain={[0, 100]} hide />

              {risk && (
                <>
                  <Area
                    yAxisId="money"
                    type="monotone"
                    dataKey="bandBase"
                    stackId="band"
                    stroke="none"
                    fill="transparent"
                    isAnimationActive={false}
                  />
                  <Area
                    yAxisId="money"
                    type="monotone"
                    dataKey="bandSpan"
                    stackId="band"
                    stroke="none"
                    fill="#4be277"
                    fillOpacity={0.12}
                    isAnimationActive={false}
                  />
                </>
              )}

              {objectives.map((o) =>
                o.targetCapital > 0 ? (
                  <ReferenceLine
                    key={o.id}
                    yAxisId="money"
                    y={o.targetCapital}
                    stroke="#fbbf24"
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                    label={{
                      value: o.name.toUpperCase(),
                      position: 'insideTopRight',
                      fill: '#fbbf24',
                      fontSize: 8,
                    }}
                  />
                ) : null,
              )}

              <ReferenceLine yAxisId="money" y={0} stroke="#ff4444" strokeOpacity={0.4} />

              {plan.currentMonth > 0 && chartData[plan.currentMonth] && (
                <ReferenceLine
                  yAxisId="money"
                  x={chartData[plan.currentMonth].label}
                  stroke="#22d3ee"
                  strokeDasharray="3 3"
                  label={{ value: 'NOW', position: 'top', fill: '#22d3ee', fontSize: 8 }}
                />
              )}

              <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#4be277', strokeOpacity: 0.2 }} />

              <Line
                yAxisId="money"
                type="monotone"
                dataKey="netWorth"
                stroke="#4be277"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="index"
                type="monotone"
                dataKey="emotional"
                stroke="#ffb690"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="money"
                type="monotone"
                dataKey="actualNetWorth"
                stroke="#22d3ee"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: '#22d3ee', strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {simulation.insolventMonth !== null && (
          <div className="mt-4 flex items-start md:items-center gap-2 px-3 py-2 bg-secondary/10 border border-secondary/30">
            <AlertTriangle size={12} className="text-secondary shrink-0 mt-0.5 md:mt-0" />
            <span className="text-[10px] font-mono text-secondary uppercase tracking-wide">
              Net worth goes negative in month {simulation.insolventMonth}
            </span>
          </div>
        )}
      </Panel>

      {/* ---- Schedule and slack ---- */}
      <Panel
        title="Schedule & Slack"
        subtitle="Zero slack means any delay here delays the whole plan"
        actions={
          <span className="text-[9px] font-mono text-on-surface-variant">
            FINISHES {monthToken(schedule.projectFinish)}
          </span>
        }
      >
        {criticalTasks.length === 0 ? (
          <EmptyState hint="Add task nodes and connect them with dependency edges. Critical-path analysis needs work with durations to measure.">
            No scheduled work
          </EmptyState>
        ) : (
          <div className="space-y-1.5">
            {criticalTasks.map((task) => {
              const barLeft = (task.earlyStart / Math.max(1, schedule.projectFinish)) * 100;
              const barWidth = (task.durationMonths / Math.max(1, schedule.projectFinish)) * 100;
              const slackWidth = (Math.max(0, task.totalSlack) / Math.max(1, schedule.projectFinish)) * 100;

              return (
                // An 11rem name column plus a bar plus the dates does not fit a
                // 390px screen, so on mobile the name and the date/slack badge
                // share the first row and the bar spans a second row beneath
                // them. From md the three cells return to the single gantt row
                // so the bars still line up across tasks. Every cell is placed
                // explicitly, so DOM order stays the same at both sizes.
                <button
                  key={task.id}
                  onClick={() => onSelectNode(task.id)}
                  className="w-full text-left group grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-x-3 gap-y-2 md:gap-4 px-2 md:px-3 py-2.5 md:py-2 hover:bg-surface-container transition-colors"
                >
                  <span className="col-start-1 row-start-1 text-[10px] font-mono uppercase tracking-tight text-on-surface truncate group-hover:text-primary transition-colors">
                    {task.name}
                  </span>

                  {/* start/end rather than col-span: the `grid-column` shorthand
                      that col-span emits would fight the col-start override at md. */}
                  <span className="col-start-1 col-end-3 row-start-2 md:col-start-2 md:col-end-3 md:row-start-1 relative h-4 bg-surface-lowest">
                    <span
                      className={cn(
                        'absolute inset-y-0.5',
                        task.isCritical ? 'bg-secondary' : 'bg-primary/60',
                      )}
                      style={{ left: `${barLeft}%`, width: `${Math.max(1.5, barWidth)}%` }}
                    />
                    {slackWidth > 0 && (
                      <span
                        className="absolute inset-y-1.5 bg-primary/20"
                        style={{ left: `${barLeft + barWidth}%`, width: `${slackWidth}%` }}
                      />
                    )}
                  </span>

                  <span className="col-start-2 row-start-1 md:col-start-3 flex items-center justify-end gap-2 shrink-0">
                    <span className="text-[9px] font-mono text-on-surface-variant tabular-nums">
                      {monthToken(task.earlyStart + 1)}–{monthToken(task.earlyFinish)}
                    </span>
                    <Badge
                      tone={
                        task.totalSlack < 0 ? 'bad' : task.isCritical ? 'warn' : 'good'
                      }
                    >
                      {slackLabel(task.totalSlack)}
                    </Badge>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {schedule.infeasible.length > 0 && (
          <div className="mt-4 pt-4 border-t border-outline-variant/10 space-y-1.5">
            {schedule.infeasible.map((n) => (
              <p key={n.id} className="text-[10px] font-mono text-secondary break-words">
                — {n.name}{' '}
                {n.missesDeadlineBy > 0
                  ? `misses its deadline by ${n.missesDeadlineBy} month${n.missesDeadlineBy === 1 ? '' : 's'}`
                  : 'does not finish inside the horizon'}
              </p>
            ))}
          </div>
        )}
      </Panel>

      {/* ---- Breaches ---- */}
      <BreachPanel analysis={analysis} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2" style={{ backgroundColor: color }} />
      <span className="text-[9px] font-headline uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
    </span>
  );
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    // Capped against the viewport so the tooltip cannot push the page sideways
    // when recharts places it near the right edge on a narrow screen.
    <div className="bg-surface-lowest border border-outline-variant/40 p-3 shadow-2xl min-w-44 md:min-w-52 max-w-[calc(100vw-3rem)]">
      <p className="text-[9px] font-headline uppercase tracking-[0.2em] text-on-surface-variant pb-2 mb-2 border-b border-outline-variant/20">
        {row.label} · month {row.month}
      </p>
      <dl className="space-y-1">
        <TooltipRow label="Net worth" value={money(row.netWorth)} tone="text-primary" />
        {row.actualNetWorth !== null && (
          <TooltipRow label="Actual" value={money(row.actualNetWorth)} tone="text-cyan-300" />
        )}
        <TooltipRow label="Health" value={percent(row.emotional)} tone="text-secondary" />
        <TooltipRow label="Relational" value={percent(row.relational)} tone="text-blue-300" />
        <TooltipRow label="Spiritual" value={percent(row.spiritual)} tone="text-purple-300" />
        <TooltipRow
          label="Free time"
          value={hours(row.freeHours)}
          tone={row.freeHours < 0 ? 'text-secondary' : 'text-on-surface'}
        />
      </dl>
      {row.violations?.length > 0 && (
        <div className="mt-2 pt-2 border-t border-outline-variant/20 space-y-1">
          {row.violations.slice(0, 3).map((v: any, i: number) => (
            <p key={i} className="text-[9px] font-mono text-secondary leading-tight">
              {v.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function TooltipRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between gap-3 md:gap-6">
      <dt className="text-[9px] font-headline uppercase tracking-wider text-on-surface-variant">
        {label}
      </dt>
      <dd className={cn('text-[10px] font-mono font-bold tabular-nums', tone)}>{value}</dd>
    </div>
  );
}

function BreachPanel({ analysis }: { analysis: Analysis }) {
  const { simulation } = analysis;

  // One row per constraint, at the month it first broke — a constraint that
  // breaches for twenty consecutive months is one problem, not twenty.
  const firstBreaches = useMemo(() => {
    const seen = new Map<string, (typeof simulation.violations)[number]>();
    for (const v of simulation.violations) {
      if (!seen.has(v.constraintId)) seen.set(v.constraintId, v);
    }
    return [...seen.values()].sort((a, b) => a.month - b.month);
  }, [simulation.violations]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of simulation.violations) map.set(v.constraintId, (map.get(v.constraintId) ?? 0) + 1);
    return map;
  }, [simulation.violations]);

  return (
    <Panel
      title="Constraint Breaches"
      subtitle="Redlines crossed anywhere in the projection"
      actions={
        firstBreaches.length === 0 ? (
          <Badge tone="good">ALL CLEAR</Badge>
        ) : (
          <Badge tone="bad">{firstBreaches.length} BREACHED</Badge>
        )
      }
    >
      {firstBreaches.length === 0 ? (
        <div className="flex items-center gap-3 text-primary">
          <CheckCircle2 size={16} />
          <p className="text-[11px] font-mono uppercase tracking-wide">
            No constraint is crossed across the whole horizon.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {firstBreaches.map((v) => (
            <div
              key={v.constraintId}
              className={cn(
                'flex items-start gap-2.5 md:gap-3 p-2.5 md:p-3 border',
                v.severity === 'critical'
                  ? 'bg-secondary/5 border-secondary/30'
                  : 'bg-amber-400/5 border-amber-400/25',
              )}
            >
              <Clock
                size={12}
                className={cn('mt-0.5 shrink-0', v.severity === 'critical' ? 'text-secondary' : 'text-amber-400')}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-mono text-on-surface leading-relaxed break-words">
                  {v.message}
                </p>
                <p className="text-[9px] font-mono uppercase tracking-wider text-on-surface-variant/70 mt-1">
                  First breach {monthToken(v.month)} · {counts.get(v.constraintId)} month
                  {counts.get(v.constraintId) === 1 ? '' : 's'} affected
                </p>
              </div>
              {/* shrink-0 so the severity badge never squeezes below its own text */}
              <span className="shrink-0">
                <Badge tone={v.severity === 'critical' ? 'bad' : 'warn'}>{v.severity}</Badge>
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
