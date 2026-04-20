import React, { useEffect, useMemo, useState } from 'react';
import { X, ShieldCheck, Fingerprint } from 'lucide-react';
import { cn } from '../lib/utils';

type TimelineLite = {
  type: string;
  name: string;
  content?: string;
};

export function scanCanvasCompetencies(events: TimelineLite[]) {
  const hay = events
    .filter((e) => e.type !== 'genesis')
    .map((e) => `${e.name} ${e.type === 'note' ? e.content || '' : ''}`.toLowerCase())
    .join(' | ');
  const aviation =
    /\baviation\b/.test(hay) ||
    hay.includes('udc tuition') ||
    hay.includes('junior tech salary');
  const travel =
    /\btravel\b/.test(hay) ||
    hay.includes('dar al safar') ||
    hay.includes('gds subscription');
  return { aviation, travel };
}

function formatSessionUptime(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

export interface CommanderDossierModalProps {
  open: boolean;
  onClose: () => void;
  timelineEvents: TimelineLite[];
  stats: {
    education: string;
    netWorth: string;
    projectedExit: string;
  };
  stateOfUnion: {
    liquidity: string;
    risk: string;
    momentum: string;
  };
  pathFullyVerified: boolean;
}

export const CommanderDossierModal: React.FC<CommanderDossierModalProps> = ({
  open,
  onClose,
  timelineEvents,
  stats,
  stateOfUnion,
  pathFullyVerified,
}) => {
  const [sessionMs, setSessionMs] = useState(0);
  const [sealAck, setSealAck] = useState(false);

  useEffect(() => {
    if (!open) {
      setSealAck(false);
      return;
    }
    const t0 = performance.now();
    const id = window.setInterval(() => setSessionMs(Math.floor(performance.now() - t0)), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const competencies = useMemo(() => scanCanvasCompetencies(timelineEvents), [timelineEvents]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="commander-dossier-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-emerald-500/25 bg-neutral-950/70 shadow-[0_0_80px_rgba(16,185,129,0.12)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute left-6 top-0 z-10 flex h-9 items-center rounded-b-lg border border-t-0 border-emerald-500/35 bg-emerald-950/50 px-4 font-mono text-[9px] font-bold uppercase tracking-[0.28em] text-emerald-400/95 shadow-lg backdrop-blur-md">
          ID-CLASSIFIED
        </div>

        <div className="pointer-events-none absolute right-4 top-14 font-mono text-[9px] uppercase tracking-widest text-white/35">
          SYS_UPTIME
          <div className="mt-0.5 text-[11px] font-bold tabular-nums text-emerald-400/80">{formatSessionUptime(sessionMs)}</div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 rounded-full border border-white/10 bg-white/5 p-1.5 text-stone-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close dossier"
        >
          <X size={16} />
        </button>

        <div className="border-b border-white/5 bg-gradient-to-br from-emerald-950/30 via-transparent to-neutral-950/80 px-6 pb-5 pt-14">
          <h2 id="commander-dossier-title" className="font-headline text-sm font-black uppercase tracking-[0.22em] text-stone-100">
            [ COMMANDER DOSSIER : CLASSIFIED ]
          </h2>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-emerald-500/70">Strategic analytics · local session</p>
        </div>

        <div className="space-y-5 px-6 py-5">
          {(competencies.aviation || competencies.travel) && (
            <div className="flex flex-wrap gap-2">
              {competencies.aviation && (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                  Field of Expertise: Aviation Maintenance
                </span>
              )}
              {competencies.travel && (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                  Field of Expertise: Strategic Logistics
                </span>
              )}
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-black/25 p-4 backdrop-blur-sm">
            <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">State of the Union</p>
            <ul className="space-y-2 font-mono text-[11px] leading-relaxed text-stone-200">
              <li className="border-l-2 border-emerald-500/50 pl-3">{stateOfUnion.liquidity}</li>
              <li className="border-l-2 border-emerald-500/50 pl-3">{stateOfUnion.risk}</li>
              <li className="border-l-2 border-emerald-500/50 pl-3">{stateOfUnion.momentum}</li>
            </ul>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="w-full border-collapse font-mono text-[10px] uppercase tracking-wide">
              <thead>
                <tr className="bg-white/[0.04] text-left text-white/45">
                  <th className="border-b border-white/10 px-3 py-2 font-bold">Metric</th>
                  <th className="border-b border-white/10 px-3 py-2 font-bold">Value</th>
                </tr>
              </thead>
              <tbody className="text-stone-200">
                <tr className="border-b border-white/5">
                  <td className="px-3 py-2.5 text-white/55">Education</td>
                  <td className="px-3 py-2.5 tabular-nums text-emerald-200/90">{stats.education}</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-3 py-2.5 text-white/55">Net Worth</td>
                  <td className="px-3 py-2.5 tabular-nums text-emerald-200/90">{stats.netWorth}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-white/55">Projected Exit</td>
                  <td className="px-3 py-2.5 tabular-nums text-emerald-200/90">{stats.projectedExit}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-white/5 bg-black/20 px-6 py-4">
          <button
            type="button"
            onClick={() => pathFullyVerified && setSealAck((a) => !a)}
            disabled={!pathFullyVerified}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-2 rounded-xl border px-4 py-4 transition-all',
              pathFullyVerified
                ? 'cursor-pointer border-emerald-500/50 bg-emerald-950/35 shadow-[0_0_24px_rgba(16,185,129,0.25)] animate-[pulse_2.4s_ease-in-out_infinite]'
                : 'cursor-not-allowed border-white/10 bg-neutral-900/40 opacity-60'
            )}
          >
            <div className="flex items-center gap-2">
              {pathFullyVerified ? (
                <ShieldCheck className="h-8 w-8 text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
              ) : (
                <Fingerprint className="h-8 w-8 text-stone-500" />
              )}
            </div>
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-400/90">
              {pathFullyVerified
                ? sealAck
                  ? '[ SIGNATURE ACKNOWLEDGED — PATH VERIFIED ]'
                  : '[ TAP TO AFFIX COMMAND SEAL — PATH 100% VERIFIED ]'
                : '[ SEAL LOCKED — RESOLVE SIMULATION BREACHES ]'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
