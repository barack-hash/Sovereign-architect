import React from 'react';
import { cn } from '../lib/utils';

interface DailyLogViewProps {
  nodes: any[];
  currentSimMonth: number;
  systemConstraints?: any;
}

const DailyLogView: React.FC<DailyLogViewProps> = ({ nodes, currentSimMonth, systemConstraints }) => {
  const activeEvents = nodes.filter(n => n.type === 'event' && (n.month || 0) <= currentSimMonth);

  const minSleep = systemConstraints?.minSleep || 0;
  const maxLabor = systemConstraints?.maxLabor || 0;
  const unallocated = 24 - minSleep - maxLabor;

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-lowest p-8 overflow-y-auto terminal-scroll">
      {/* Main Header */}
      <div className="mb-8 border-b border-outline-variant/20 pb-4">
        <h1 className="text-xl font-headline font-bold text-primary tracking-widest uppercase">
          [ TACTICAL EXECUTION : DAILY PROTOCOL ]
        </h1>
        <h2 className="text-sm font-mono text-on-surface-variant mt-2 tracking-wider">
          SIMULATION MONTH: {currentSimMonth}
        </h2>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
        {/* Left Column: ACTIVE OPERATIONS */}
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
                  className="group flex items-center gap-3 p-3 border border-outline-variant/20 rounded bg-surface hover:bg-surface-highest hover:border-primary/50 transition-all cursor-pointer"
                >
                  <span className="text-on-surface-variant font-mono group-hover:text-primary transition-colors">
                    [ ]
                  </span>
                  <span className="text-on-surface font-mono text-sm tracking-wide">
                    {event.name || 'Unnamed Op'}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-on-surface-variant font-mono text-sm opacity-50">
                  No active operations for this month.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: 24-HOUR CAPACITY */}
        <div className="border border-outline-variant/30 rounded-lg p-6 bg-surface-container flex flex-col">
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
              <span className="text-on-surface font-mono font-bold">{minSleep} Hrs</span>
            </div>
            <div className="flex justify-between items-center p-3 border-b border-outline-variant/10">
              <span className="text-on-surface-variant font-mono text-sm uppercase tracking-wider">Max Labor</span>
              <span className="text-on-surface font-mono font-bold">{maxLabor} Hrs</span>
            </div>
            <div className="flex justify-between items-center p-3 mt-auto border-t border-outline-variant/30 pt-4">
              <span className="text-on-surface font-headline font-bold text-sm uppercase tracking-wider">Unallocated</span>
              <span className={cn(
                "font-mono font-bold text-lg",
                unallocated < 0 ? "text-error" : "text-primary"
              )}>
                {unallocated} Hrs
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyLogView;
