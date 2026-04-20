import React from 'react';
import { Target } from 'lucide-react';
import { cn } from '../lib/utils';

interface GoalsViewProps {
  objectives: any[];
  currentSimMonth: number;
  simulationData?: any[];
}

const statusLabel = (node: any): string => {
  const s = node?.status;
  if (s === 'COMPLETED') return 'COMPLETED';
  if (s === 'ACTIVE') return 'IN_PROGRESS';
  if (s === 'FAILED') return 'FAILED';
  return 'PENDING';
};

export const GoalsView: React.FC<GoalsViewProps> = ({ objectives, currentSimMonth }) => {
  return (
    <div className="flex-1 overflow-y-auto terminal-scroll p-8 space-y-10">
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-headline font-bold uppercase tracking-[0.3em] text-on-surface-variant">
            Strategic Objectives
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
          <>
            <div className="mb-8 rounded-lg border border-outline-variant/20 bg-surface-container/40 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2 border-b border-outline-variant/15 text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">
                <span>Title</span>
                <span className="text-right">Status</span>
              </div>
              <ul className="divide-y divide-outline-variant/10">
                {objectives.map((node) => {
                  const title = node?.name || 'Untitled objective';
                  const label = statusLabel(node);
                  return (
                    <li
                      key={node.id}
                      className="grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-3 hover:bg-white/[0.03] transition-colors"
                    >
                      <span className="font-mono text-sm text-on-surface tracking-wide truncate">{title}</span>
                      <span
                        className={cn(
                          'font-mono text-[10px] font-bold uppercase tracking-wider tabular-nums',
                          label === 'IN_PROGRESS' && 'text-cyan-400',
                          label === 'PENDING' && 'text-amber-400',
                          label === 'COMPLETED' && 'text-primary',
                          label === 'FAILED' && 'text-red-500'
                        )}
                      >
                        [ {label} ]
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {objectives.map((node) => {
                const label = node?.name || 'Unknown Target';
                const targetMonth = Number(node?.month || node?.targetTimeline) || 1;
                const isAchieved = currentSimMonth >= targetMonth;
                const progressPercent = isAchieved
                  ? 100
                  : Math.min(100, Math.max(0, Math.round((currentSimMonth / targetMonth) * 100)));

                return (
                  <div
                    key={`card-${node.id}`}
                    className="bg-surface-container border border-outline-variant/20 rounded-lg p-6 flex flex-col relative overflow-hidden group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'p-2 rounded-md',
                            isAchieved ? 'bg-primary/10 text-primary' : 'bg-amber-400/10 text-amber-400'
                          )}
                        >
                          <Target size={18} />
                        </div>
                        <div>
                          <h3 className="font-headline font-semibold text-sm text-on-surface">{label}</h3>
                          <p className="font-mono text-[10px] text-on-surface-variant mt-1 uppercase tracking-wider">
                            TARGET: MONTH {targetMonth}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={cn(
                            'font-mono text-[10px] tracking-widest uppercase font-bold',
                            isAchieved ? 'text-primary' : 'text-amber-400'
                          )}
                        >
                          STATUS: {isAchieved ? '[ SECURED ]' : '[ IN PROGRESS ]'}
                        </span>
                        <span className="font-mono text-[10px] text-on-surface-variant">{progressPercent}%</span>
                      </div>

                      <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all duration-1000 ease-out',
                            isAchieved ? 'bg-primary' : 'bg-amber-400'
                          )}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
