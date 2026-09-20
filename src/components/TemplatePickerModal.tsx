/**
 * The "what do you want to build?" moment. Shown automatically the first time
 * someone lands in an empty workspace, and any time they start a new plan.
 * Templates come from the engine and are tested there: each one opens valid,
 * scheduled, and satisfiable.
 */

import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { PLAN_TEMPLATES, buildTemplatePlan, type Plan, type TemplateId } from '../engine';

export function TemplatePickerModal({
  firstRun,
  onPick,
  onClose,
}: {
  /** First visit: adds a short orientation and softer dismissal copy. */
  firstRun: boolean;
  onPick: (plan: Plan) => void;
  onClose: () => void;
}) {
  const pick = (id: TemplateId) => onPick(buildTemplatePlan(id));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-black/75">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto terminal-scroll bg-surface border border-primary/40 p-5 sm:p-7 space-y-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="font-headline font-bold text-sm uppercase tracking-[0.2em] text-on-surface">
              {firstRun ? 'Start your architecture' : 'Start a new plan'}
            </h2>
            {firstRun && (
              <p className="text-[11px] font-mono text-on-surface-variant leading-relaxed max-w-lg">
                A plan is a graph: where you are now, the tasks you could do, and what must happen
                before what. Two numbers on each task power the whole analysis — how many months it
                takes, and how many hours a day it demands while active. A template gives you a
                working example to bend into your own life.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 -m-2 text-on-surface-variant hover:text-on-surface shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {PLAN_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => pick(template.id)}
              className="text-left border border-outline-variant/25 bg-surface-lowest hover:border-primary/50 hover:bg-primary/5 p-4 space-y-2 transition-colors group"
            >
              <span className="block font-headline font-bold text-[11px] uppercase tracking-[0.15em] text-on-surface group-hover:text-primary transition-colors">
                {template.name}
              </span>
              <span className="block text-[9px] font-mono uppercase tracking-[0.15em] text-primary/70">
                {template.tagline}
              </span>
              <span className="block text-[10px] font-mono text-on-surface-variant leading-relaxed">
                {template.description}
              </span>
            </button>
          ))}
        </div>

        {firstRun && (
          <p className="text-[9px] font-mono text-on-surface-variant/60 uppercase tracking-[0.15em] text-center">
            You can start a new plan any time from the sidebar
          </p>
        )}
      </motion.div>
    </div>
  );
}
