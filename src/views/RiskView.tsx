/**
 * Monte Carlo risk analysis.
 *
 * v1 had a "Simulate" button wired to a single unseeded random trial that
 * printed "SYSTEM RESILIENT" or "SIMULATION FAILED" — a coin flip whose answer
 * changed every press. Separately it had a *correct* multi-scenario function
 * that nothing called, so the confidence bands on the chart never rendered.
 *
 * This runs N seeded trials and reports the distribution.
 */

import React, { useState } from 'react';
import { AlertTriangle, Dice5, ShieldCheck, TrendingDown } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Analysis } from '../state/useAnalysis';
import { CONSTRAINT_LABELS, type ConstraintType, type Plan } from '../engine';
import { Badge, Button, EmptyState, Explain, Panel, SectionHeading, Stat } from '../ui/primitives';
import { money, moneyShort, percent, rate } from '../ui/format';
import { cn } from '../lib/utils';

interface Props {
  plan: Plan;
  analysis: Analysis;
}

const TRIAL_OPTIONS = [200, 500, 1000];

export function RiskView({ plan, analysis }: Props) {
  const { risk, isRunningRisk, runRisk, simulation } = analysis;
  const [trials, setTrials] = useState(500);

  const chartData = React.useMemo(() => {
    if (!risk) return [];
    return risk.netWorthBands.map((band, i) => ({
      label: simulation.months[i]?.label ?? String(i),
      month: i,
      p5: band.p5,
      p25span: band.p25 - band.p5,
      p50: band.p50,
      p75span: band.p75 - band.p25,
      p95span: band.p95 - band.p75,
      plan: simulation.months[i]?.netWorth ?? 0,
    }));
  }, [risk, simulation.months]);

  const controlProps = {
    trials,
    onSelect: setTrials,
    onRun: () => void runRisk(trials),
    isRunning: isRunningRisk,
  };

  return (
    <div className="flex-1 overflow-y-auto terminal-scroll p-4 md:p-8 space-y-6 md:space-y-8">
      <div>
        {/*
         * SectionHeading lays its title and "right" slot out on one non-wrapping
         * row, so the trial controls would collide with the title at phone
         * widths. They are rendered into the slot on desktop only, and repeated
         * as a full-width row underneath the heading on mobile.
         */}
        <SectionHeading right={<TrialControls {...controlProps} className="hidden md:flex" />}>
          Risk
        </SectionHeading>
        <TrialControls {...controlProps} className="flex md:hidden -mt-2 mb-5" />
        <p className="text-[11px] text-on-surface-variant/80 leading-relaxed max-w-3xl -mt-2">
          The plan assumes everything goes as written. This runs it against thousands of futures
          where the market moves, income stops for a month, the car breaks, or you get ill — and
          reports how often you still make it. Results are seeded, so the same plan gives the same
          answer twice.
        </p>
      </div>

      {!risk ? (
        <EmptyState hint="Each trial perturbs investment returns, inflation, recurring costs, and injects random income disruptions, emergency expenses and health shocks — then runs the full simulation.">
          No trials run yet
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Stat
              label="Objectives met"
              value={rate(risk.successRate)}
              sub={`across ${risk.trials} futures`}
              tone={risk.successRate > 0.75 ? 'good' : risk.successRate > 0.4 ? 'warn' : 'bad'}
              icon={<ShieldCheck size={16} />}
            />
            <Stat
              label="Went insolvent"
              value={rate(risk.insolvencyRate)}
              sub="net worth below zero at some point"
              tone={risk.insolvencyRate < 0.05 ? 'good' : risk.insolvencyRate < 0.25 ? 'warn' : 'bad'}
              icon={<TrendingDown size={16} />}
            />
            <Stat
              label="Broke a redline"
              value={rate(risk.criticalBreachRate)}
              sub="at least one critical constraint"
              tone={risk.criticalBreachRate < 0.1 ? 'good' : risk.criticalBreachRate < 0.4 ? 'warn' : 'bad'}
              icon={<AlertTriangle size={16} />}
            />
            <Stat
              label="Median outcome"
              value={moneyShort(risk.finalNetWorth.p50)}
              sub={`${moneyShort(risk.finalNetWorth.p5)} to ${moneyShort(risk.finalNetWorth.p95)}`}
              tone={risk.finalNetWorth.p5 < 0 ? 'warn' : 'good'}
            />
          </div>

          <Panel
            title="Distribution of outcomes"
            subtitle="Dark band is the middle half of futures; light band spans the 5th to 95th percentile"
          >
            <div className="h-56 md:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#2a2a2e" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#7d8a7d', fontSize: 9 }}
                    minTickGap={24}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#7d8a7d', fontSize: 9 }}
                    tickFormatter={moneyShort}
                    width={56}
                  />
                  <ReferenceLine y={0} stroke="#ff4444" strokeOpacity={0.5} />

                  {/* Stacked areas build the percentile envelope from the p5 baseline up. */}
                  <Area type="monotone" dataKey="p5" stackId="b" stroke="none" fill="transparent" isAnimationActive={false} />
                  <Area type="monotone" dataKey="p25span" stackId="b" stroke="none" fill="#4be277" fillOpacity={0.1} isAnimationActive={false} />
                  <Area type="monotone" dataKey="p75span" stackId="b" stroke="none" fill="#4be277" fillOpacity={0.22} isAnimationActive={false} />
                  <Area type="monotone" dataKey="p95span" stackId="b" stroke="none" fill="#4be277" fillOpacity={0.1} isAnimationActive={false} />

                  <Line type="monotone" dataKey="p50" stroke="#4be277" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line
                    type="monotone"
                    dataKey="plan"
                    stroke="#ffb690"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                    isAnimationActive={false}
                  />

                  <Tooltip content={<RiskTooltip />} cursor={{ stroke: '#4be277', strokeOpacity: 0.2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3">
              <Legend color="#4be277" label="Median future" />
              <Legend color="#ffb690" label="The plan as written" dashed />
            </div>
            <Explain>
              Where the dashed line sits above the median, the plan is optimistic relative to how
              these futures actually played out.
            </Explain>
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <Panel title="What breaks first" subtitle="Constraints by how often they were crossed">
              {risk.topFailureModes.length === 0 ? (
                <p className="text-[11px] font-mono text-primary">
                  No critical constraint broke in any trial.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {risk.topFailureModes.map((mode) => (
                    <div key={mode.label}>
                      {/* Constraint names are long; let them wrap and pin the rate. */}
                      <div className="flex justify-between items-baseline gap-3 mb-1">
                        <span className="min-w-0 text-[10px] font-headline uppercase tracking-wider text-on-surface">
                          {CONSTRAINT_LABELS[mode.label as ConstraintType] ?? mode.label}
                        </span>
                        <span className="shrink-0 text-[10px] font-mono font-bold text-secondary tabular-nums">
                          {rate(mode.rate)}
                        </span>
                      </div>
                      <div className="h-1 bg-surface-highest">
                        <div className="h-full bg-secondary" style={{ width: `${mode.rate * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="When the objectives land" subtitle="Across the futures where they landed at all">
              {risk.completionMonth === null ? (
                <p className="text-[11px] font-mono text-secondary leading-relaxed">
                  No trial reached every objective inside the horizon. The plan does not survive
                  contact with uncertainty — extend the horizon, lower a target, or add income.
                </p>
              ) : (
                <div className="space-y-3">
                  {(
                    [
                      ['Fastest 5%', risk.completionMonth.p5],
                      ['Quarter of futures by', risk.completionMonth.p25],
                      ['Median', risk.completionMonth.p50],
                      ['Three quarters by', risk.completionMonth.p75],
                      ['Slowest 5%', risk.completionMonth.p95],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex justify-between items-baseline gap-3">
                      <span className="min-w-0 text-[10px] font-headline uppercase tracking-wider text-on-surface-variant">
                        {label}
                      </span>
                      <span className="shrink-0 text-[11px] font-mono font-bold text-on-surface tabular-nums">
                        month {Math.round(value)}
                      </span>
                    </div>
                  ))}
                  <Explain>
                    The gap between the fastest and slowest is your real exposure. A tight spread
                    means the plan is robust; a wide one means the outcome is mostly luck.
                  </Explain>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Trial-count picker plus the run button. Rendered in two places (desktop
 * heading slot, mobile row below the heading); `className` supplies the
 * display/visibility for each. Phone sizing keeps every control at a 40px
 * touch target and lets the count chips share the row width evenly.
 */
function TrialControls({
  trials,
  onSelect,
  onRun,
  isRunning,
  className,
}: {
  trials: number;
  onSelect: (n: number) => void;
  onRun: () => void;
  isRunning: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {TRIAL_OPTIONS.map((n) => (
        <button
          key={n}
          onClick={() => onSelect(n)}
          className={cn(
            'flex-1 md:flex-none min-h-[40px] md:min-h-0 px-3 py-2.5 md:px-2.5 md:py-1',
            'text-[10px] md:text-[9px] font-mono font-bold border transition-colors',
            trials === n
              ? 'border-primary text-primary bg-primary/10'
              : 'border-outline-variant/30 text-on-surface-variant hover:text-on-surface',
          )}
        >
          {n}
        </button>
      ))}
      <Button
        variant="primary"
        onClick={onRun}
        disabled={isRunning}
        className="min-h-[40px] md:min-h-0 py-2.5 md:py-2"
      >
        <span className="flex items-center gap-2">
          <Dice5 size={12} className={isRunning ? 'animate-spin' : ''} />
          {isRunning ? 'Running…' : 'Run trials'}
        </span>
      </Button>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="w-4 h-0.5"
        style={{
          background: dashed
            ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)`
            : color,
        }}
      />
      <span className="text-[9px] font-headline uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
    </span>
  );
}

function RiskTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const p25 = row.p5 + row.p25span;
  const p75 = p25 + row.p75span;
  const p95 = p75 + row.p95span;

  // max-w keeps the floating tooltip from spilling past the chart box on a phone;
  // desktop keeps the original shrink-to-fit box so long money values never wrap.
  return (
    <div className="bg-surface-lowest border border-outline-variant/40 p-2.5 md:p-3 shadow-2xl max-w-[15rem] md:max-w-none">
      <p className="text-[9px] font-headline uppercase tracking-[0.2em] text-on-surface-variant pb-2 mb-2 border-b border-outline-variant/20">
        {row.label} · month {row.month}
      </p>
      <div className="space-y-1">
        <Row label="Best 5%" value={money(p95)} />
        <Row label="Upper quartile" value={money(p75)} />
        <Row label="Median" value={money(row.p50)} tone="text-primary" />
        <Row label="Lower quartile" value={money(p25)} />
        <Row label="Worst 5%" value={money(row.p5)} tone="text-secondary" />
        <div className="pt-1 mt-1 border-t border-outline-variant/20">
          <Row label="Plan says" value={money(row.plan)} tone="text-[#ffb690]" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone = 'text-on-surface' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 md:gap-6">
      <span className="text-[9px] font-headline uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className={cn('shrink-0 text-[10px] font-mono font-bold tabular-nums', tone)}>{value}</span>
    </div>
  );
}
