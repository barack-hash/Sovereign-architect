/**
 * Privacy policy and terms, written to be read. This app stores what people
 * earn, owe, and hope for; the least it owes them is a straight account of
 * where that data goes.
 */

import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

const EFFECTIVE_DATE = 'September 20, 2026';

function Shell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="h-[100dvh] w-full bg-neutral-950 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10 space-y-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary font-mono text-[10px] uppercase tracking-[0.2em] transition-colors"
        >
          <ArrowLeft size={12} /> Back
        </button>

        <div className="space-y-2">
          <h1 className="text-primary font-headline font-bold text-2xl tracking-[0.2em] uppercase">
            {title}
          </h1>
          <p className="text-on-surface-variant font-mono text-[10px] uppercase tracking-[0.2em]">
            Effective {EFFECTIVE_DATE}
          </p>
        </div>

        <div className="space-y-6 text-white/80 font-mono text-[13px] leading-relaxed [&_h2]:text-primary [&_h2]:font-headline [&_h2]:font-bold [&_h2]:text-xs [&_h2]:uppercase [&_h2]:tracking-[0.2em] [&_h2]:pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}

export function PrivacyView({ onBack }: { onBack: () => void }) {
  return (
    <Shell title="Privacy" onBack={onBack}>
      <p>
        Sovereign exists to run calculations on a plan you describe. That plan can contain
        sensitive things — income, debts, family commitments, matters of faith. This page says
        plainly what is stored, where, and what is never done with it.
      </p>

      <h2>What is stored</h2>
      <p>
        <strong>Your account:</strong> authentication is handled by Clerk. They hold your email
        address (or connected social login) and sign-in metadata on our behalf.
      </p>
      <p>
        <strong>Your plans:</strong> plans, and the snapshots you save of them, are stored in a
        Postgres database hosted by Neon, keyed to your account, and served through functions
        running on Vercel. A working copy is also cached in your own browser so the app is fast
        and works offline.
      </p>
      <p>
        <strong>If you never sign in:</strong> everything stays in your browser's local storage
        and nothing is sent to any server.
      </p>

      <h2>What is not done</h2>
      <p>
        The contents of your plans are not read, analysed, sold, shared, or fed to advertising or
        analytics of any kind. There is no tracking pixel and no third-party analytics script on
        this site. Cookies are used only by Clerk, only to keep you signed in.
      </p>

      <h2>Who processes data</h2>
      <p>
        Three infrastructure providers process data to make the service work: Clerk
        (authentication), Neon (database), and Vercel (hosting and functions). Each receives only
        what its role requires.
      </p>

      <h2>Export and deletion</h2>
      <p>
        Settings → Account lets you download everything the server holds about you as a single
        JSON file, and delete your account, which permanently removes every plan and snapshot and
        the account itself. Deletion is immediate and cannot be undone.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy: open an issue at github.com/barack-hash/Sovereign-architect.
      </p>
    </Shell>
  );
}

export function TermsView({ onBack }: { onBack: () => void }) {
  return (
    <Shell title="Terms of use" onBack={onBack}>
      <p>By using Sovereign you agree to the following, which is short on purpose.</p>

      <h2>What this is</h2>
      <p>
        Sovereign is a deterministic planning calculator. It computes exactly what your own
        assumptions imply — nothing more. Its outputs are arithmetic, not advice.
      </p>

      <h2>What this is not</h2>
      <p>
        Sovereign is not financial, investment, legal, medical, or religious advice, and no output
        of it should be treated as a recommendation to buy, sell, borrow, quit, move, or commit to
        anything. Decisions you make remain yours. If a decision matters, check the numbers
        yourself and consider advice from a qualified professional.
      </p>

      <h2>Your account and data</h2>
      <p>
        You are responsible for the accuracy of what you enter and for keeping access to your
        sign-in method. You can export or delete your data at any time from Settings. Accounts
        used to abuse the service (automated flooding, attempts to access others' data) may be
        removed.
      </p>

      <h2>Warranty and liability</h2>
      <p>
        The service is provided as-is, without warranty of any kind. To the maximum extent
        permitted by law, its operator is not liable for losses arising from use of the service or
        from decisions made in reliance on its outputs.
      </p>

      <h2>Changes</h2>
      <p>
        If these terms change materially, the effective date above changes and the app will say so
        before you continue.
      </p>
    </Shell>
  );
}
