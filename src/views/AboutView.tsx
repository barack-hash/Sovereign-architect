/**
 * Public About page: what the app is, how to think about it, and the
 * dedication it was built under. Reachable signed out (from the landing
 * page) and signed in, so it takes a single back handler rather than
 * assuming either chrome.
 */

import { ArrowLeft } from 'lucide-react';
import { DedicationText } from '../components/Dedication';

export function AboutView({ onBack }: { onBack: () => void }) {
  return (
    <div className="h-[100dvh] w-full bg-neutral-950 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10 space-y-14">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary font-mono text-[10px] uppercase tracking-[0.2em] transition-colors"
        >
          <ArrowLeft size={12} /> Back
        </button>

        <section className="space-y-5">
          <h1 className="text-primary font-headline font-bold text-2xl tracking-[0.2em] uppercase">
            About Sovereign
          </h1>
          <div className="space-y-4 text-white/80 font-mono text-sm leading-relaxed">
            <p>
              Sovereign is a deterministic life architect. You describe where you are now, the
              things you could do, and what must happen before what — and it does the arithmetic a
              spreadsheet can't: real critical-path scheduling over your dependencies, a
              month-by-month simulation of five kinds of capital (cash, debt, emotional,
              relational, spiritual), a search across orderings of your own tasks for the plan
              that best fits your priorities, and Monte Carlo analysis of how it all survives
              contact with bad luck.
            </p>
            <p>
              It is deterministic on purpose. The same plan always produces the same numbers, every
              figure is traceable to an assumption you typed, and nothing is hidden behind a model
              you can't inspect. Sovereign is a thinking tool, not an oracle — it will not tell you
              what to want, only what your own assumptions imply.
            </p>
            <p>
              Your plan belongs to you. It lives in your account, you can export the whole thing as
              JSON at any time, and you can delete everything — data and account — in one action
              from Settings.
            </p>
          </div>
        </section>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        <section className="space-y-9 text-center py-6">
          <DedicationText />
        </section>
      </div>
    </div>
  );
}
