import React, { useMemo } from 'react';
import { Target } from 'lucide-react';
import { cn } from '../lib/utils';

interface GoalsViewProps {
  objectives: any[];
  currentSimMonth: number;
  simulationData?: any[];
  timelineEvents?: any[];
}

const SEGMENTS = 10;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    value || 0
  );

function getSimRowAtOrBefore(data: any[] | undefined, month: number): any | undefined {
  if (!data?.length) return undefined;
  const eligible = data.filter((r) => typeof r.month === 'number' && r.month <= month);
  return eligible[eligible.length - 1];
}

function firstFailureMonth(data: any[] | undefined): number | undefined {
  if (!data?.length) return undefined;
  for (const row of data) {
    if (typeof row.month !== 'number' || row.month < 1) continue;
    if (row.isCrisis) return row.month;
    const viol = row.violations;
    if (Array.isArray(viol) && viol.some((v: string) => String(v).toLowerCase().includes('liquidity'))) {
      return row.month;
    }
  }
  return undefined;
}

function depId(d: string | { id: string }): string {
  return typeof d === 'string' ? d : d.id;
}

function eventDependenciesForObjective(objective: any, allEvents: any[] | undefined): any[] {
  if (!allEvents?.length || !objective?.dependencies?.length) return [];
  const out: any[] = [];
  for (const d of objective.dependencies) {
    const id = depId(d);
    const n = allEvents.find((e) => e.id === id);
    if (n?.type === 'event') out.push(n);
  }
  return out.sort((a, b) => (Number(a.month) || 0) - (Number(b.month) || 0));
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  objectives,
  currentSimMonth,
  simulationData,
  timelineEvents = [],
}) => {
  const lastSimRow = simulationData?.length ? simulationData[simulationData.length - 1] : undefined;
  const failMonth = useMemo(() => firstFailureMonth(simulationData), [simulationData]);

  return (
    <div className="flex-1 overflow-y-auto terminal-scroll p-8 space-y-10">
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-headline font-bold uppercase tracking-[0.3em] text-on-surface-variant">
            Mission Profiles
          </h2>
          <div className="h-px flex-1 bg-outline-variant/10 mx-6" />
          <span className="text-[10px] font-mono text-primary">
            OBJECTIVES: {objectives.length.toString().padStart(2, '0')}
          </span>
        </div>

        {objectives.length === 0 ? (
          <div className="flex items-center justify-center p-12 border border-dashed border-outline-variant/20 bg-surface-container/30 rounded-lg">
            <p className="font-mono text-xs text-on-surface-variant tracking-widest uppercase">
              [ NO EXTRACTION POINTS DETECTED ON CANVAS ]
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {objectives.map((node) => {
              const title = node?.name || 'Untitled objective';
              const targetMonth = Math.max(1, Number(node?.month || node?.targetTimeline) || 1);
              const satisfactionMonth = lastSimRow?.satisfiedObjectives?.[node.id];
              const pathTerminated =
                failMonth !== undefined &&
                (satisfactionMonth === undefined || failMonth < satisfactionMonth);

              const simRow = getSimRowAtOrBefore(simulationData, currentSimMonth);
              const progressPct = Math.round(
                Math.min(
                  100,
                  Math.max(
                    0,
                    satisfactionMonth !== undefined && currentSimMonth >= satisfactionMonth
                      ? 100
                      : simRow?.objectiveProgress?.[node.id] ?? 0
                  )
                )
              );

              const linearPct =
                targetMonth > 0 ? Math.min(100, Math.round((currentSimMonth / targetMonth) * 100)) : 0;
              const onTrack =
                !pathTerminated &&
                node.status !== 'FAILED' &&
                (progressPct >= linearPct - 10 || (satisfactionMonth !== undefined && currentSimMonth >= satisfactionMonth));

              const monthsLeft = Math.max(0, targetMonth - currentSimMonth);
              const etaInner = pathTerminated
                ? 'PATH TERMINATED'
                : `${monthsLeft} ${monthsLeft === 1 ? 'MONTH' : 'MONTHS'}`;

              let projectedLiquidity: number | null = null;
              if (pathTerminated && satisfactionMonth === undefined) {
                projectedLiquidity = null;
              } else if (satisfactionMonth !== undefined) {
                const hitRow = simulationData?.find((r) => r.month === satisfactionMonth);
                projectedLiquidity = typeof hitRow?.Financial === 'number' ? hitRow.Financial : null;
              } else {
                const atTarget = simulationData?.find((r) => r.month === targetMonth);
                projectedLiquidity =
                  typeof atTarget?.Financial === 'number'
                    ? atTarget.Financial
                    : typeof lastSimRow?.Financial === 'number'
                      ? lastSimRow.Financial
                      : null;
              }

              const milestones = eventDependenciesForObjective(node, timelineEvents);
              const filledSegments = Math.min(SEGMENTS, Math.max(0, Math.ceil(progressPct / (100 / SEGMENTS))));

              return (
                <div
                  key={node.id}
                  className={cn(
                    'group relative rounded-xl p-6 flex flex-col gap-4 overflow-hidden',
                    'bg-neutral-900/40 backdrop-blur-xl border border-white/5',
                    'transition-all duration-300 ease-out',
                    'hover:-translate-y-1.5 hover:border-white/10',
                    onTrack &&
                      'hover:shadow-[0_12px_40px_-8px_rgba(16,185,129,0.25),0_0_24px_rgba(16,185,129,0.12)]',
                    !onTrack &&
                      'hover:shadow-[0_12px_40px_-8px_rgba(220,38,38,0.2),0_0_28px_rgba(185,28,28,0.15)]'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'p-2 rounded-lg shrink-0',
                          onTrack ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                        )}
                      >
                        <Target size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-headline font-semibold text-sm text-on-surface truncate">{title}</h3>
                        <p className="font-mono text-[10px] text-on-surface-variant mt-0.5 uppercase tracking-wider">
                          TARGET: MONTH {targetMonth}
                        </p>
                      </div>
                    </div>
                    <div
                      className={cn(
                        'shrink-0 size-3 rounded-full mt-1',
                        onTrack ? 'mission-pulse-on-track' : 'mission-pulse-fail'
                      )}
                      title={onTrack ? 'On track' : 'Off track / terminated'}
                    />
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <span className="font-mono text-4xl font-bold tabular-nums tracking-tight text-on-surface leading-none">
                      {progressPct}%
                    </span>
                  </div>

                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface/90">
                    ETA:{' '}
                    <span className="text-white/95 font-semibold tracking-widest">
                      [ {etaInner} ]
                    </span>
                  </p>

                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant mb-1">
                      PROJECTED LIQUIDITY
                    </p>
                    <p className="font-mono text-sm font-bold tabular-nums text-secondary">
                      {projectedLiquidity === null ? '—' : formatCurrency(projectedLiquidity)}
                    </p>
                  </div>

                  <div className="flex gap-1 w-full">
                    {Array.from({ length: SEGMENTS }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex-1 h-2 rounded-[2px] transition-colors duration-300',
                          i < filledSegments
                            ? onTrack
                              ? 'bg-emerald-400/90 shadow-[0_0_8px_rgba(52,211,153,0.35)]'
                              : 'bg-red-500/90 shadow-[0_0_8px_rgba(248,113,113,0.35)]'
                            : 'bg-white/10'
                        )}
                      />
                    ))}
                  </div>

                  {milestones.length > 0 && (
                    <div className="pt-1 border-t border-white/5">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant mb-2">
                        Required milestones
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {milestones.map((ev) => {
                          const done = simRow?.nodeStatuses?.[ev.id] === 'COMPLETED';
                          const label = ev?.name || ev?.id?.slice(0, 6) || 'EVT';
                          return (
                            <span
                              key={ev.id}
                              title={`${label} · M${ev.month ?? '?'}`}
                              className="inline-flex items-center gap-1.5"
                            >
                              <span
                                className={cn(
                                  'size-2.5 rounded-full border transition-colors',
                                  done
                                    ? 'bg-emerald-400 border-emerald-300/80 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                                    : 'bg-transparent border-white/25'
                                )}
                              />
                              <span className="font-mono text-[9px] text-on-surface-variant truncate max-w-[7rem]">
                                {label}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
