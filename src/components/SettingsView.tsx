import React from 'react';

export function SettingsView() {
  return (
    <div className="flex-1 flex flex-col bg-surface overflow-y-auto terminal-scroll p-8 space-y-10">
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-sm font-headline font-bold uppercase tracking-[0.4em] text-primary">
            [ SYSTEM PREFERENCES & CONFIGURATION ]
          </h2>
          <div className="h-px flex-1 bg-primary/20 mx-8" />
          <span className="text-[10px] font-mono text-on-surface-variant">CONFIG_VER: 1.0.4</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Theme Engine Card */}
          <div className="bg-surface-container border border-outline-variant/20 p-6 space-y-4 hover:border-primary/30 transition-all group">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant group-hover:text-primary transition-colors">
                [ THEME ENGINE ]
              </h3>
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-mono text-on-surface">Dark Mode Strict (Locked)</p>
              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                System aesthetic is hard-coded for maximum focus and low-light operational efficiency.
              </p>
            </div>
          </div>

          {/* Data Management Card */}
          <div className="bg-surface-container border border-outline-variant/20 p-6 space-y-4 hover:border-primary/30 transition-all group">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant group-hover:text-primary transition-colors">
                [ DATA MANAGEMENT ]
              </h3>
              <div className="w-2 h-2 rounded-full bg-on-surface-variant/30" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-mono text-on-surface">Local Storage clear/reset options pending...</p>
              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                Persistence is currently handled via browser local storage. Manual purge protocols are under development.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
