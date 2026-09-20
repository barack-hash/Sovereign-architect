/**
 * What a signed-out visitor sees: what the thing is, why it exists, and a
 * way in. Only ever rendered inside ClerkProvider — local-only mode goes
 * straight to the workspace.
 */

import { SignInButton, SignUpButton } from '@clerk/react';
import { GitBranch, LineChart, Shuffle, Dice5 } from 'lucide-react';

const STEPS = [
  {
    icon: GitBranch,
    title: 'Map it',
    body: 'Lay out where you are now, the moves you could make, and which ones must come before which — a dependency graph of your actual life, not a to-do list.',
  },
  {
    icon: LineChart,
    title: 'Simulate it',
    body: 'Sovereign schedules your plan on its critical path and simulates it month by month across five kinds of capital: cash, debt, emotional, relational, spiritual.',
  },
  {
    icon: Shuffle,
    title: 'Search it',
    body: 'The Scenario Lab reorders your own tasks thousands of ways and shows the frontier: the plans that finish sooner, end richer, or cost less of you.',
  },
  {
    icon: Dice5,
    title: 'Stress it',
    body: 'Monte Carlo analysis shakes the plan with delays and cost overruns and reports what actually survives — before reality runs the experiment on you.',
  },
] as const;

export function LandingView({ onShowAbout }: { onShowAbout: () => void }) {
  return (
    <div className="min-h-[100dvh] w-full bg-neutral-950 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-14 sm:py-20 space-y-16 sm:space-y-24">
        {/* Hero */}
        <section className="text-center space-y-7">
          <div className="w-14 h-14 border-2 border-primary flex items-center justify-center text-primary font-black text-2xl mx-auto">
            S
          </div>
          <div className="space-y-3">
            <h1 className="text-primary font-headline font-bold text-2xl sm:text-4xl tracking-[0.25em] uppercase">
              Sovereign
            </h1>
            <p className="text-on-surface-variant font-mono text-[10px] sm:text-xs uppercase tracking-[0.3em]">
              Deterministic Life Architect
            </p>
          </div>
          <p className="text-white/80 font-mono text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
            Your next five years have a critical path. Describe where you are, what you could do,
            and what depends on what — Sovereign computes the schedule, simulates the cost in money
            and in you, and searches your options for the plan your priorities actually imply.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <SignUpButton mode="modal">
              <button className="w-full sm:w-auto bg-primary text-on-primary px-10 py-4 font-headline font-bold text-[11px] tracking-[0.2em] uppercase hover:brightness-110 transition-all">
                Start your architecture
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="w-full sm:w-auto border border-primary/50 text-primary hover:bg-primary/10 px-10 py-4 font-mono text-[11px] tracking-[0.2em] uppercase transition-all">
                Sign in
              </button>
            </SignInButton>
          </div>
        </section>

        {/* How it works */}
        <section className="grid sm:grid-cols-2 gap-4">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="border border-outline-variant/20 bg-surface/40 p-6 space-y-3">
              <div className="flex items-center gap-3">
                <Icon size={16} className="text-primary shrink-0" />
                <span className="text-[10px] font-mono text-on-surface-variant">0{i + 1}</span>
                <h2 className="font-headline font-bold text-xs uppercase tracking-[0.2em] text-on-surface">
                  {title}
                </h2>
              </div>
              <p className="text-white/60 font-mono text-xs leading-relaxed">{body}</p>
            </div>
          ))}
        </section>

        {/* Honesty block */}
        <section className="border border-primary/20 bg-primary/5 p-6 sm:p-8 space-y-3 text-center">
          <h2 className="font-headline font-bold text-xs uppercase tracking-[0.25em] text-primary">
            Deterministic means honest
          </h2>
          <p className="text-white/70 font-mono text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto">
            No black box. The same plan always yields the same numbers, and every figure traces back
            to an assumption you typed. Your data lives in your account — export it as JSON or
            delete everything, any time.
          </p>
        </section>

        {/* Footer */}
        <footer className="flex items-center justify-center gap-6 pb-6">
          <button
            onClick={onShowAbout}
            className="text-on-surface-variant hover:text-primary font-mono text-[10px] uppercase tracking-[0.2em] transition-colors"
          >
            About & dedication
          </button>
        </footer>
      </div>
    </div>
  );
}
