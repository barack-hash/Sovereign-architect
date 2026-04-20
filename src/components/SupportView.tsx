import React from 'react';

export function SupportView() {
  return (
    <div className="flex-1 flex flex-col bg-surface overflow-y-auto terminal-scroll p-8 space-y-10">
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-sm font-headline font-bold uppercase tracking-[0.4em] text-primary">
            [ OPERATIONAL SUPPORT & DOCUMENTATION ]
          </h2>
          <div className="h-px flex-1 bg-primary/20 mx-8" />
          <span className="text-[10px] font-mono text-on-surface-variant">DOC_VER: 1.0.0</span>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* System Manual Card */}
          <div className="bg-surface-container border border-outline-variant/20 p-8 space-y-6 hover:border-primary/30 transition-all group">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant group-hover:text-primary transition-colors">
                [ SYSTEM MANUAL ]
              </h3>
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            </div>
            <div className="space-y-4">
              <p className="text-xs font-mono text-on-surface leading-relaxed">
                Deterministic Life Architect v1.0. Engine operates entirely locally. No external data transmission detected.
              </p>
              <div className="h-px w-full bg-outline-variant/10" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] font-headline uppercase text-on-surface-variant tracking-widest">Protocol Status</p>
                  <p className="text-[10px] font-mono text-primary">ACTIVE_LOCAL_ONLY</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-headline uppercase text-on-surface-variant tracking-widest">Security Clearance</p>
                  <p className="text-[10px] font-mono text-primary">ANALYST_LEVEL_01</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
