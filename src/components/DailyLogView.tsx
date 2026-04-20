import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface DailyLogViewProps {
  currentSimMonth: number;
  setCurrentSimulationMonth: (n: number) => void;
  targetTimeline: number;
  simulationData: any[];
  systemConstraints?: any;
  /** Scheduled sleep from Terminal (lived day), not the Constraints policy floor. */
  requiredSleepHours: number;
  /** Daily average of active nodes’ weekly hours (weekly sum / 7). */
  totalDailyHours: number;
  totalFixedCosts: number;
  /** Full monthly burn (fixed + variable) vs Safety Net maxBurn. */
  liveMonthlyExpenses: number;
  variableCosts: number;
  projectedYield: number;
  savingsBelowBuffer?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);

function chronicleTimestamp(monthIndex: number): string {
  const mo = ((monthIndex - 1) % 12) + 1;
  const yr = Math.floor((monthIndex - 1) / 12) + 1;
  return `[ MO:${String(mo).padStart(2, '0')} | YR:${String(yr).padStart(2, '0')} ]`;
}

function financialAtMonth(simulationData: any[], m: number): number | undefined {
  const row = simulationData.find((d) => d.month === m);
  return typeof row?.Financial === 'number' ? row.Financial : undefined;
}

function liquidityDeltasUpTo(simulationData: any[], upToMonth: number): number[] {
  const deltas: number[] = [];
  for (let m = 1; m <= upToMonth; m++) {
    const cur = financialAtMonth(simulationData, m);
    const prev = financialAtMonth(simulationData, m - 1);
    if (typeof cur === 'number' && typeof prev === 'number') deltas.push(cur - prev);
    else deltas.push(0);
  }
  return deltas;
}

function FlightSparkline({ deltas }: { deltas: number[] }) {
  if (deltas.length === 0) return null;
  const w = 72;
  const h = 22;
  const max = Math.max(...deltas.map(Math.abs), 1);
  const pts = deltas.map((d, i) => {
    const x = (i / Math.max(1, deltas.length - 1)) * w;
    const y = h / 2 - (d / max) * (h / 2 - 2);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const pos = deltas[deltas.length - 1] >= 0;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible" aria-hidden>
      <path
        d={pts.join(' ')}
        fill="none"
        stroke={pos ? 'rgba(74, 222, 128, 0.9)' : 'rgba(248, 113, 113, 0.9)'}
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const DailyLogView: React.FC<DailyLogViewProps> = ({
  currentSimMonth,
  setCurrentSimulationMonth,
  targetTimeline,
  simulationData,
  systemConstraints,
  requiredSleepHours,
  totalDailyHours,
  totalFixedCosts,
  liveMonthlyExpenses,
  variableCosts,
  projectedYield,
  savingsBelowBuffer = false,
}) => {
  const maxMonth = Math.max(1, targetTimeline);
  const scrubValue = Math.min(maxMonth, Math.max(1, currentSimMonth || 1));

  const maxLabor = systemConstraints?.maxLabor ?? 0;
  const unallocated = 24 - requiredSleepHours - totalDailyHours;
  const capacityOverload = unallocated < 0;

  const simRowAtScrub = useMemo(
    () => simulationData.find((d) => d.month === scrubValue),
    [simulationData, scrubValue]
  );
  const healthBreach = Boolean(simRowAtScrub?.violations?.length) || simRowAtScrub?.isCrisis === true;

  const monthRows = useMemo(() => {
    const rows: { month: number; row: any | undefined }[] = [];
    for (let m = 1; m <= maxMonth; m++) {
      rows.push({ month: m, row: simulationData.find((d) => d.month === m) });
    }
    return rows;
  }, [simulationData, maxMonth]);

  const navMetrics = (
    <div
      className={cn(
        'sticky top-0 z-20 font-terminal border-b pb-4 mb-4 transition-colors -mx-1 px-1',
        savingsBelowBuffer
          ? 'border-b-red-600/40 ring-1 ring-red-600/25 border-outline-variant/20 rounded-lg p-3 bg-surface-lowest/90'
          : 'border-outline-variant/20'
      )}
    >
      <h1 className="text-base font-bold text-primary tracking-[0.18em] uppercase leading-tight">
        [ BLACK BOX CHRONICLE · DAILY PROTOCOL ]
      </h1>
      <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-3">Navigation / Metrics</p>
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[10px] text-on-surface-variant tracking-widest">
            PROTOCOL REPLAY · {chronicleTimestamp(scrubValue)}
          </h2>
          <span className="text-[9px] text-on-surface-variant uppercase tracking-widest">
            {scrubValue} / {maxMonth}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={maxMonth}
          step={1}
          value={scrubValue}
          onChange={(e) => setCurrentSimulationMonth(Number(e.target.value) || 1)}
          className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
        />
      </div>
      <div className="grid grid-cols-1 gap-2 mt-4">
        <div className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2">
          <p className="text-[9px] uppercase tracking-[0.2em] text-on-surface-variant">Total fixed costs</p>
          <p className="text-sm font-bold text-secondary">{formatCurrency(totalFixedCosts)}</p>
          {Number(systemConstraints?.maxBurn) > 0 &&
            (() => {
              const cap = Number(systemConstraints.maxBurn) || 1;
              const pct = Math.min(100, (liveMonthlyExpenses / cap) * 100);
              const barClass =
                pct > 90 ? 'bg-red-600 animate-pulse' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
              return (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-[8px] uppercase text-on-surface-variant/80">
                    <span>Burn vs redline</span>
                    <span>
                      {formatCurrency(liveMonthlyExpenses)} / {formatCurrency(systemConstraints.maxBurn)}
                    </span>
                  </div>
                  <div className="h-px w-full overflow-hidden rounded-full bg-surface-highest">
                    <div
                      className={cn('h-px rounded-full transition-all duration-300', barClass)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}
        </div>
        <div className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2">
          <p className="text-[9px] uppercase tracking-[0.2em] text-on-surface-variant">Variable costs</p>
          <p className="text-sm font-bold text-secondary">{formatCurrency(variableCosts)}</p>
        </div>
        <div className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2">
          <p className="text-[9px] uppercase tracking-[0.2em] text-on-surface-variant">Projected yield</p>
          <p className="text-sm font-bold text-primary">{formatCurrency(projectedYield)}</p>
        </div>
      </div>
    </div>
  );

  const chronicleColumn = (
    <section className="min-w-0 w-full">
      <div className="text-[10px] uppercase tracking-[0.28em] text-on-surface-variant mb-4">
        [ TIMELINE STREAM · CHRONICLE ]
      </div>
      <div className="relative pl-10">
        <div
          className="absolute left-[11px] top-2 bottom-2 w-px bg-white/15 pointer-events-none"
          aria-hidden
        />
        <ul className="space-y-6">
          {monthRows.map(({ month: m, row }) => {
            const events = (row?.events as any[]) ?? [];
            const breached = Boolean(row?.violations?.length) || row?.isCrisis === true;
            const isHighlight = m === scrubValue;
            const deltasTrail = liquidityDeltasUpTo(simulationData, m).slice(-6);

            return (
              <li
                key={m}
                className={cn(
                  'relative rounded-lg border pl-4 pr-3 py-3 transition-colors',
                  isHighlight
                    ? 'border-primary/50 bg-primary/5 shadow-[0_0_20px_rgba(74,222,128,0.12)]'
                    : 'border-outline-variant/25 bg-surface-container/40'
                )}
              >
                <span
                  className={cn(
                    'absolute left-[-22px] top-4 size-2.5 rounded-full border-2 z-10',
                    breached ? 'border-red-500 bg-red-950' : 'border-primary/80 bg-surface-lowest'
                  )}
                  aria-hidden
                />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {breached ? (
                      <AlertTriangle className="size-4 text-red-500 shrink-0" aria-label="Breach" />
                    ) : (
                      <CheckCircle2 className="size-4 text-primary shrink-0" aria-label="Nominal" />
                    )}
                    <span className="text-[11px] text-on-surface tracking-wider">{chronicleTimestamp(m)}</span>
                  </div>
                  <div className="flex items-end gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-[8px] uppercase tracking-widest text-on-surface-variant">[ FLIGHT DATA ]</p>
                      <FlightSparkline deltas={deltasTrail} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {events.length > 0 ? (
                    events.map((ev: any) => (
                      <div
                        key={ev.id || ev.name}
                        className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2 first:border-t-0 first:pt-0"
                      >
                        <span className="text-on-surface text-xs tracking-wide truncate">{ev.name || 'Event'}</span>
                        <span
                          className={cn(
                            'text-[11px] font-bold whitespace-nowrap',
                            (Number(ev.monthlyIncome) || 0) >= (Number(ev.ongoingCost) || 0)
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          )}
                        >
                          {formatCurrency(
                            (Number(ev.monthlyIncome) || 0) - (Number(ev.ongoingCost) || 0)
                          )}
                          /mo
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-on-surface-variant/90 leading-relaxed border border-dashed border-white/10 rounded px-3 py-2 bg-black/20">
                      Stability maintained. Compound interest active.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );

  const emotional = typeof simRowAtScrub?.Emotional === 'number' ? simRowAtScrub.Emotional : '—';
  const relational = typeof simRowAtScrub?.Relational === 'number' ? simRowAtScrub.Relational : '—';
  const spiritual = typeof simRowAtScrub?.Spiritual === 'number' ? simRowAtScrub.Spiritual : '—';
  const financialSnap = typeof simRowAtScrub?.Financial === 'number' ? simRowAtScrub.Financial : null;

  const telemetryColumn = (
    <div className="space-y-6">
      <section
        className={cn(
          'rounded-lg border p-4 bg-surface-container/50 font-mono text-[10px]',
          healthBreach
            ? 'border-red-600/70 ring-2 ring-red-600/40 shadow-[0_0_16px_rgba(220,38,38,0.2)]'
            : 'border-outline-variant/30'
        )}
      >
        <h3 className="text-[10px] font-bold text-secondary tracking-widest uppercase mb-3 border-b border-outline-variant/20 pb-2">
          [ HEALTH TELEMETRY · MO {scrubValue} ]
        </h3>
        {healthBreach && (
          <p className="text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <AlertTriangle className="size-3 shrink-0" /> Breach / crisis flag
          </p>
        )}
        <table className="w-full border-collapse text-left">
          <tbody className="text-stone-200">
            <tr className="border-b border-white/5">
              <td className="py-2 text-on-surface-variant uppercase tracking-wide">Emotional</td>
              <td className="py-2 text-right tabular-nums text-primary">{emotional}</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 text-on-surface-variant uppercase tracking-wide">Relational</td>
              <td className="py-2 text-right tabular-nums text-primary">{relational}</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 text-on-surface-variant uppercase tracking-wide">Spiritual</td>
              <td className="py-2 text-right tabular-nums text-primary">{spiritual}</td>
            </tr>
            {financialSnap != null && (
              <tr>
                <td className="py-2 text-on-surface-variant uppercase tracking-wide">Financial</td>
                <td className="py-2 text-right tabular-nums text-emerald-300/90">{formatCurrency(financialSnap)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section
        className={cn(
          'rounded-lg border p-4 bg-surface-container/50',
          capacityOverload
            ? 'border-red-600/70 ring-2 ring-red-600/40 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.25)]'
            : 'border-outline-variant/30'
        )}
      >
        <div className="flex items-center justify-between mb-4 border-b border-outline-variant/20 pb-2">
          <h3 className="text-xs font-bold text-secondary tracking-widest uppercase">[ 24-HOUR CAPACITY ]</h3>
        </div>
        <div className="flex flex-col gap-3 text-xs font-mono">
          <div className="flex justify-between items-center p-2 border-b border-outline-variant/10">
            <span className="text-on-surface-variant uppercase tracking-wider">Base</span>
            <span className="font-bold">24 HRS</span>
          </div>
          <div className="flex justify-between items-center p-2 border-b border-outline-variant/10">
            <span className="text-on-surface-variant uppercase tracking-wider">Required sleep</span>
            <span className="font-bold">{requiredSleepHours.toFixed(1)} HRS</span>
          </div>
          <div className="flex justify-between items-center p-2 border-b border-outline-variant/10">
            <span className="text-on-surface-variant uppercase tracking-wider">Max labor</span>
            <span className="font-bold">{maxLabor} HRS</span>
          </div>
          <div className="flex justify-between items-center p-2 mt-2 border-t border-outline-variant/30 pt-3">
            <span className="font-bold text-xs uppercase tracking-wider">Unallocated</span>
            <span className={cn('font-bold text-lg', capacityOverload ? 'text-red-500' : 'text-primary')}>
              {unallocated.toFixed(1)} HRS
            </span>
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <div
      className={cn(
        'font-terminal crt-terminal-scanlines terminal-data-fog-host relative flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-lowest'
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-0 terminal-data-fog" aria-hidden />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 p-3 lg:gap-4 lg:p-4">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-3">
          <aside className="col-span-1 flex min-h-0 flex-col overflow-y-auto terminal-scroll px-1 lg:col-span-3 lg:px-2">
            {navMetrics}
          </aside>
          <main className="col-span-1 min-h-0 min-w-0 overflow-y-auto terminal-scroll px-1 lg:col-span-6 lg:px-2">
            {chronicleColumn}
          </main>
          <aside className="col-span-1 min-h-0 overflow-y-auto terminal-scroll px-1 lg:col-span-3 lg:px-2">
            {telemetryColumn}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default DailyLogView;
