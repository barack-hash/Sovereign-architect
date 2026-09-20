/**
 * Offered once, on first sign-in in a browser that already holds a plan from
 * the pre-account era. Importing is a copy — the browser's own data is never
 * touched — and declining never destroys anything either; the plan can still
 * be imported later from Settings.
 */

import { HardDriveUpload } from 'lucide-react';
import { motion } from 'motion/react';

export function ImportOfferModal({
  onAccept,
  onDecline,
}: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5 bg-black/75">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-surface border border-primary/40 p-6 space-y-5 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <HardDriveUpload size={18} className="text-primary shrink-0" />
          <h2 className="font-headline font-bold text-sm uppercase tracking-[0.2em] text-on-surface">
            A plan already lives in this browser
          </h2>
        </div>

        <p className="text-[11px] font-mono text-on-surface-variant leading-relaxed">
          This browser holds a plan from before accounts existed. Import it into your account to
          keep working on it from any device. The copy in this browser stays untouched either way,
          and you can import it later from Settings.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={onAccept}
            className="flex-1 bg-primary text-on-primary py-3 font-headline font-bold text-[10px] tracking-[0.2em] uppercase hover:brightness-110 transition-all"
          >
            Import into my account
          </button>
          <button
            onClick={onDecline}
            className="flex-1 border border-outline-variant/40 text-on-surface-variant hover:text-on-surface py-3 font-mono text-[10px] tracking-[0.2em] uppercase transition-colors"
          >
            Not now
          </button>
        </div>
      </motion.div>
    </div>
  );
}
