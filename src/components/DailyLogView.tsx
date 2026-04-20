import React from 'react';
import { cn } from '../lib/utils';

interface DailyLogViewProps {
  nodes: any[];
  currentSimMonth: number;
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

const DailyLogView: React.FC<DailyLogViewProps> = ({
  nodes,
  currentSimMonth,
  systemConstraints,
  requiredSleepHours,
  totalDailyHours,
  totalFixedCosts,
  liveMonthlyExpenses,
  variableCosts,
  projectedYield,
  savingsBelowBuffer = false,
}) => {
  const activeEvents = nodes.filter(n => n.type === 'event' && (n.month || 0) <= currentSimMonth);
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
  const formatEventTime = (event: any) => {
    if (event?.date) return event.date;
    const monthValue = Number(event?.month || 0);
    return `MONTH ${monthValue > 0 ? monthValue : currentSimMonth}`;
  };

  const maxLabor = systemConstraints?.maxLabor ?? 0;
  const unallocated = 24 - requiredSleepHours - totalDailyHours;
  const capacityOverload = unallocated < 0;

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto flex flex-col h-full bg-surface-lowest p-8 overflow-y-auto terminal-scroll">
      <div
        className={cn(
          'sticky top-0 z-10 bg-surface-lowest/95 backdrop-blur-md border-b pb-4 mb-6 transition-colors',
          savingsBelowBuffer
            ? 'border-b-red-600/40 ring-1 ring-red-600/25 border-outline-variant/20'
            : 'border-outline-variant/20'
        )}
      >
        <h1 className="text-xl font-headline font-bold text-primary tracking-widest uppercase">
          [ TACTICAL EXECUTION : DAILY PROTOCOL ]
        </h1>
        <h2 className="text-sm font-mono text-on-surface-variant mt-2 tracking-wider mb-4">
          SIMULATION MONTH: {currentSimMonth}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">Total Fixed Costs</p>
            <p className="text-sm font-mono font-bold text-secondary">{formatCurrency(totalFixedCosts)}</p>
            {Number(systemConstraints?.maxBurn) > 0 && (() => {
              const cap = Number(systemConstraints.maxBurn) || 1;
              const pct = Math.min(100, (liveMonthlyExpenses / cap) * 100);
              const barClass =
                pct > 90 ? 'bg-red-600 animate-pulse' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
              return (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-[8px] font-mono uppercase text-on-surface-variant/80">
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
            <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">Variable Costs</p>
            <p className="text-sm font-mono font-bold text-secondary">{formatCurrency(variableCosts)}</p>
          </div>
          <div className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">Projected Yield</p>
            <p className="text-sm font-mono font-bold text-primary">{formatCurrency(projectedYield)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
        <div className="border border-outline-variant/30 rounded-lg p-6 bg-surface-container flex flex-col">
          <div className="flex items-center justify-between mb-6 border-b border-outline-variant/20 pb-2">
            <h3 className="text-md font-headline font-bold text-secondary tracking-widest uppercase">
              [ ACTIVE OPERATIONS ]
            </h3>
          </div>
          <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-2">
            {activeEvents.length > 0 ? (
              activeEvents.map((event) => (
                <div 
                  key={event.id}
                  className={cn(
                    "group grid grid-cols-[120px_1fr] gap-3 p-3 border rounded bg-surface hover:bg-surface-highest transition-all cursor-pointer",
                    (Number(event.monthlyIncome) || 0) > (Number(event.ongoingCost) || 0)
                      ? "border-l-2 border-l-emerald-500/70 border-outline-variant/20 hover:border-primary/50"
                      : (Number(event.ongoingCost) || 0) > (Number(event.monthlyIncome) || 0)
                        ? "border-l-2 border-l-red-600/70 border-outline-variant/20 hover:border-secondary/50"
                        : "border-outline-variant/20 hover:border-primary/40"
                  )}
                >
                  <div className="text-[11px] font-mono text-on-surface-variant uppercase tracking-wider">
                    {formatEventTime(event)}
                  </div>
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <span className="text-on-surface font-mono text-sm tracking-wide truncate">
                      {event.name || 'Unnamed Op'}
                    </span>
                    <span className={cn(
                      "text-xs font-mono font-bold whitespace-nowrap",
                      (Number(event.monthlyIncome) || 0) >= (Number(event.ongoingCost) || 0) ? "text-emerald-500" : "text-red-600"
                    )}>
                      {formatCurrency((Number(event.monthlyIncome) || 0) - (Number(event.ongoingCost) || 0))}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-on-surface-variant font-mono text-sm opacity-70">
                  No active operations detected for this cycle.
                </p>
              </div>
            )}
          </div>
        </div>

        <div
          className={cn(
            'border rounded-lg p-6 bg-surface-container flex flex-col transition-colors',
            capacityOverload
              ? 'border-red-600/70 ring-2 ring-red-600/40 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.25)]'
              : 'border-outline-variant/30'
          )}
        >
          <div className="flex items-center justify-between mb-6 border-b border-outline-variant/20 pb-2">
            <h3 className="text-md font-headline font-bold text-secondary tracking-widest uppercase">
              [ 24-HOUR CAPACITY ]
            </h3>
          </div>
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex justify-between items-center p-3 border-b border-outline-variant/10">
              <span className="text-on-surface-variant font-mono text-sm uppercase tracking-wider">Base</span>
              <span className="text-on-surface font-mono font-bold">24 Hrs</span>
            </div>
            <div className="flex justify-between items-center p-3 border-b border-outline-variant/10">
              <span className="text-on-surface-variant font-mono text-sm uppercase tracking-wider">Required Sleep</span>
              <span className="text-on-surface font-mono font-bold">{requiredSleepHours.toFixed(1)} Hrs</span>
            </div>
            <div className="flex justify-between items-center p-3 border-b border-outline-variant/10">
              <span className="text-on-surface-variant font-mono text-sm uppercase tracking-wider">Max Labor</span>
              <span className="text-on-surface font-mono font-bold">{maxLabor} Hrs</span>
            </div>
            <div className="flex justify-between items-center p-3 mt-auto border-t border-outline-variant/30 pt-4">
              <span className="text-on-surface font-headline font-bold text-sm uppercase tracking-wider">Unallocated</span>
              <span
                className={cn(
                  'font-mono font-bold text-lg',
                  capacityOverload ? 'text-red-600' : 'text-primary'
                )}
              >
                {unallocated.toFixed(1)} Hrs
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyLogView;
