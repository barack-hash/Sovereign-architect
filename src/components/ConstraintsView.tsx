import React, { useEffect, useMemo, useState } from 'react';
import { Shield, Clock, BookOpen, Users } from 'lucide-react';
import { cn } from '../lib/utils';

export type SystemConstraintsShape = {
  minCash: number;
  maxBurn: number;
  minMonthlyBuffer?: number;
  minSleep: number;
  maxLabor: number;
  prayerStrict?: boolean;
  minStudy?: number;
  minFamily?: number;
  coreContacts?: number;
};

interface ConstraintsViewProps {
  constraintsActive: boolean;
  systemConstraints: SystemConstraintsShape;
  setSystemConstraints: (v: SystemConstraintsShape | ((p: SystemConstraintsShape) => SystemConstraintsShape)) => void;
  baselineTenYearSeries: number[];
  computeTenYearSeriesForConstraints: (c: SystemConstraintsShape) => number[];
  projectedNetWorth: number;
  liveMonthlyExpenses: number;
  liveMonthlySavings: number;
  totalDailyHours: number;
  initialNetWorth: number;
  onCommitProtocols?: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);

function computeIntegrityScore(
  draft: SystemConstraintsShape,
  m: {
    projectedNetWorth: number;
    liveMonthlyExpenses: number;
    liveMonthlySavings: number;
    totalDailyHours: number;
    initialNetWorth: number;
  }
): number {
  let s = 100;
  if (draft.minCash > 0) {
    if (m.projectedNetWorth < draft.minCash) {
      s -= 28;
      s -= Math.min(22, ((draft.minCash - m.projectedNetWorth) / Math.max(draft.minCash, 1)) * 22);
    }
    if (m.initialNetWorth < draft.minCash) s -= 12;
  }
  if (draft.maxBurn > 0 && m.liveMonthlyExpenses > draft.maxBurn) {
    s -= 24;
    s -= Math.min(
      18,
      ((m.liveMonthlyExpenses - draft.maxBurn) / Math.max(draft.maxBurn, 1)) * 18
    );
  }
  if (draft.minMonthlyBuffer && draft.minMonthlyBuffer > 0 && m.liveMonthlySavings < draft.minMonthlyBuffer) {
    s -= 20;
    s -= Math.min(
      15,
      ((draft.minMonthlyBuffer - m.liveMonthlySavings) / Math.max(draft.minMonthlyBuffer, 1)) * 15
    );
  }
  if (draft.maxLabor > 0 && m.totalDailyHours > draft.maxLabor) {
    s -= 18;
    s -= Math.min(12, ((m.totalDailyHours - draft.maxLabor) / Math.max(draft.maxLabor, 1)) * 12);
  }
  return Math.max(0, Math.min(100, Math.round(s)));
}

function ShadowSparkline({
  baseline,
  shadow,
  className,
}: {
  baseline: number[];
  shadow: number[];
  className?: string;
}) {
  const { dBase, dShadow, w, h } = useMemo(() => {
    const all = [...baseline, ...shadow];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = max - min || 1;
    const pad = span * 0.06;
    const lo = min - pad;
    const hi = max + pad;
    const width = 520;
    const height = 120;
    const n = baseline.length;
    const toX = (i: number) => (i / Math.max(1, n - 1)) * width;
    const toY = (v: number) => height - ((v - lo) / (hi - lo)) * height;
    const line = (pts: number[]) =>
      pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ');
    return {
      dBase: line(baseline),
      dShadow: line(shadow),
      w: width,
      h: height,
    };
  }, [baseline, shadow]);

  return (
    <svg
      className={cn('overflow-visible', className)}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={dBase} fill="none" stroke="rgba(245,245,240,0.35)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <path
        d={dShadow}
        fill="none"
        stroke="rgba(185, 28, 28, 0.85)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function DialArc({ value, max, breach }: { value: number; max: number; breach: boolean }) {
  const t = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const angle = t * 180;
  const r = 36;
  const cx = 44;
  const cy = 44;
  const polar = (deg: number) => {
    const rad = ((180 - deg) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  };
  const start = polar(180);
  const end = polar(180 - angle);
  const large = angle > 180 ? 1 : 0;
  const d = `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;

  return (
    <svg width="88" height="52" viewBox="0 0 88 52" className="shrink-0">
      <path
        d="M 8 44 A 36 36 0 0 1 80 44"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d={d}
        fill="none"
        stroke={breach ? 'rgba(220,38,38,0.95)' : 'rgba(212,212,200,0.9)'}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProtocolSlider({
  label,
  subtitle,
  value,
  min,
  max,
  step,
  breach,
  onChange,
  dialMax,
  formatDisplay,
}: {
  label: string;
  subtitle: string;
  value: number;
  min: number;
  max: number;
  step: number;
  breach: boolean;
  onChange: (n: number) => void;
  dialMax: number;
  formatDisplay: (n: number) => string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-4 py-3 flex gap-4 items-center">
      <DialArc value={value} max={dialMax} breach={breach} />
      <div className="flex-1 min-w-0 space-y-2">
        <div>
          <p className="font-headline text-xs font-bold uppercase tracking-[0.2em] text-[#f5f5f0]">{label}</p>
          <p className="font-mono text-[10px] text-on-surface-variant/90 mt-0.5 tracking-wide">{subtitle}</p>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            'protocol-range w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10',
            breach && 'protocol-range-breach'
          )}
        />
        <p className="font-mono text-xs tabular-nums text-secondary text-right">{formatDisplay(value)}</p>
      </div>
    </div>
  );
}

const ConstraintsView: React.FC<ConstraintsViewProps> = ({
  constraintsActive,
  systemConstraints,
  setSystemConstraints,
  baselineTenYearSeries,
  computeTenYearSeriesForConstraints,
  projectedNetWorth,
  liveMonthlyExpenses,
  liveMonthlySavings,
  totalDailyHours,
  initialNetWorth,
  onCommitProtocols,
}) => {
  const [draft, setDraft] = useState<SystemConstraintsShape>(systemConstraints);
  const [flashOn, setFlashOn] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  useEffect(() => {
    if (constraintsActive) {
      setDraft(systemConstraints);
    }
  }, [constraintsActive, systemConstraints]);

  const metrics = useMemo(
    () => ({
      projectedNetWorth,
      liveMonthlyExpenses,
      liveMonthlySavings,
      totalDailyHours,
      initialNetWorth,
    }),
    [projectedNetWorth, liveMonthlyExpenses, liveMonthlySavings, totalDailyHours, initialNetWorth]
  );

  const integrity = useMemo(() => computeIntegrityScore(draft, metrics), [draft, metrics]);

  const shadowSeries = useMemo(
    () => computeTenYearSeriesForConstraints(draft),
    [computeTenYearSeriesForConstraints, draft]
  );

  const breachMinCash =
    draft.minCash > 0 && (projectedNetWorth < draft.minCash || initialNetWorth < draft.minCash);
  const breachMaxBurn = draft.maxBurn > 0 && liveMonthlyExpenses > draft.maxBurn;
  const breachBuffer =
    (draft.minMonthlyBuffer ?? 0) > 0 && liveMonthlySavings < (draft.minMonthlyBuffer ?? 0);
  const breachLabor = draft.maxLabor > 0 && totalDailyHours > draft.maxLabor;

  const maxMinCash = Math.max(250_000, projectedNetWorth * 1.5, initialNetWorth * 1.5, 25_000);
  const maxBurnSlider = Math.max(30_000, liveMonthlyExpenses * 2.5, draft.maxBurn || 0, 5000);
  const maxBufferSlider = Math.max(15_000, liveMonthlySavings * 2.5, draft.minMonthlyBuffer ?? 0, 2000);
  const maxLaborSlider = 24;

  const commit = () => {
    setSystemConstraints(draft);
    setFlashOn(true);
    onCommitProtocols?.();
    window.setTimeout(() => setFlashOn(false), 520);
  };

  const toggleSection = (section: string) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  const updateDraft = (patch: Partial<SystemConstraintsShape>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="relative min-h-[320px] w-full max-w-none p-6 md:p-8 lg:px-12">
      <div
        className="pointer-events-none absolute inset-0 z-0 flex flex-col justify-end opacity-20 pb-4 px-4"
        aria-hidden
      >
        <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#f5f5f0]/80 mb-2 relative z-10">
          [ PROJECTED IMPACT OF PROTOCOL CHANGE ]
        </p>
        <div className="w-full h-28 md:h-32">
          <ShadowSparkline baseline={baselineTenYearSeries} shadow={shadowSeries} className="w-full h-full" />
        </div>
      </div>

      {flashOn ? (
        <div
          className="pointer-events-none absolute inset-0 z-[70] protocol-shutter-flash bg-[#faf8f5]"
          aria-hidden
        />
      ) : null}

      <div className="relative z-10 space-y-8">
        <header className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xs font-headline font-bold uppercase tracking-[0.35em] text-[#f5f5f0]/90">
                Safety Protocols
              </h2>
              <p className="font-mono text-[10px] text-on-surface-variant mt-2 tracking-widest uppercase">
                Commander console · draft until commit
              </p>
            </div>
            <div className="text-right min-w-[8rem]">
              <p className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant">System integrity</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-[#f5f5f0]">{integrity}%</p>
              <div className="mt-1 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    integrity >= 70 ? 'bg-emerald-500/90' : integrity >= 40 ? 'bg-amber-500/90' : 'bg-red-600/90'
                  )}
                  style={{ width: `${integrity}%` }}
                />
              </div>
            </div>
          </div>
        </header>

        {/* Primary protocols */}
        <section className="rounded-2xl border border-white/5 bg-neutral-900/40 backdrop-blur-xl p-4 md:p-5 space-y-4">
          <div className="flex items-center gap-2 text-[#f5f5f0]">
            <Shield className="w-5 h-5 opacity-80" />
            <h3 className="font-headline text-[11px] font-bold uppercase tracking-[0.28em]">Liquidity & burn</h3>
          </div>
          <ProtocolSlider
            label="Sovereign liquidity reserve"
            subtitle="Hard deck (cash). The line you do not cross."
            value={draft.minCash}
            min={0}
            max={maxMinCash}
            step={500}
            breach={breachMinCash}
            dialMax={maxMinCash}
            formatDisplay={formatCurrency}
            onChange={(n) => updateDraft({ minCash: n })}
          />
          <ProtocolSlider
            label="Maximum sustainable attrition"
            subtitle="Ceiling on monthly burn the system tolerates."
            value={draft.maxBurn}
            min={0}
            max={maxBurnSlider}
            step={100}
            breach={breachMaxBurn}
            dialMax={maxBurnSlider}
            formatDisplay={(n) => `${formatCurrency(n)} / MO`}
            onChange={(n) => updateDraft({ maxBurn: n })}
          />
          <ProtocolSlider
            label="Emergency liquidity floor"
            subtitle="Minimum net savings velocity required each month."
            value={draft.minMonthlyBuffer ?? 0}
            min={0}
            max={maxBufferSlider}
            step={50}
            breach={breachBuffer}
            dialMax={maxBufferSlider}
            formatDisplay={(n) => `${formatCurrency(n)} / MO`}
            onChange={(n) => updateDraft({ minMonthlyBuffer: n })}
          />
        </section>

        <section className="rounded-2xl border border-white/5 bg-neutral-900/40 backdrop-blur-xl p-4 md:p-5 space-y-4">
          <button
            type="button"
            onClick={() => toggleSection('temporal')}
            className="w-full flex items-center justify-between gap-3 text-[#f5f5f0]"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 opacity-80" />
              <h3 className="font-headline text-[11px] font-bold uppercase tracking-[0.28em]">Temporal / Time</h3>
            </div>
            <span className="font-mono text-sm opacity-60">{openSection === 'temporal' ? '−' : '+'}</span>
          </button>
          {openSection === 'temporal' ? (
            <div className="space-y-4 pt-2">
              <ProtocolSlider
                label="Recovery floor (sleep)"
                subtitle="Absolute minimum rest hours per day."
                value={draft.minSleep}
                min={0}
                max={12}
                step={0.25}
                breach={false}
                dialMax={12}
                formatDisplay={(n) => `${n} HRS / DAY`}
                onChange={(n) => updateDraft({ minSleep: n })}
              />
              <ProtocolSlider
                label="Human capital ceiling"
                subtitle="Maximum active labor hours per day on the canvas."
                value={draft.maxLabor}
                min={0}
                max={maxLaborSlider}
                step={0.25}
                breach={breachLabor}
                dialMax={maxLaborSlider}
                formatDisplay={(n) => `${n} HRS / DAY`}
                onChange={(n) => updateDraft({ maxLabor: n })}
              />
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/5 bg-neutral-900/40 backdrop-blur-xl p-4 md:p-5 space-y-4">
          <button
            type="button"
            onClick={() => toggleSection('spiritual')}
            className="w-full flex items-center justify-between gap-3 text-[#f5f5f0]"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 opacity-80" />
              <h3 className="font-headline text-[11px] font-bold uppercase tracking-[0.28em]">Spiritual / Religion</h3>
            </div>
            <span className="font-mono text-sm opacity-60">{openSection === 'spiritual' ? '−' : '+'}</span>
          </button>
          {openSection === 'spiritual' ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Prayer protocol (strict)
                </span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.prayerStrict || false}
                    onChange={(e) => updateDraft({ prayerStrict: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-black/40 accent-red-700"
                  />
                  <span className="font-mono text-[10px] text-secondary uppercase">
                    {draft.prayerStrict ? 'ACTIVE' : 'STANDBY'}
                  </span>
                </label>
              </div>
              <ProtocolSlider
                label="Study & reading minimum"
                subtitle="Weekly hours reserved for formation."
                value={draft.minStudy || 0}
                min={0}
                max={80}
                step={1}
                breach={false}
                dialMax={80}
                formatDisplay={(n) => `${n} HRS / WK`}
                onChange={(n) => updateDraft({ minStudy: n })}
              />
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/5 bg-neutral-900/40 backdrop-blur-xl p-4 md:p-5 space-y-4">
          <button
            type="button"
            onClick={() => toggleSection('relational')}
            className="w-full flex items-center justify-between gap-3 text-[#f5f5f0]"
          >
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 opacity-80" />
              <h3 className="font-headline text-[11px] font-bold uppercase tracking-[0.28em]">Relational & Network</h3>
            </div>
            <span className="font-mono text-sm opacity-60">{openSection === 'relational' ? '−' : '+'}</span>
          </button>
          {openSection === 'relational' ? (
            <div className="space-y-4 pt-2">
              <ProtocolSlider
                label="Family time minimum"
                subtitle="Hours per week for core relationships."
                value={draft.minFamily || 0}
                min={0}
                max={80}
                step={1}
                breach={false}
                dialMax={80}
                formatDisplay={(n) => `${n} HRS / WK`}
                onChange={(n) => updateDraft({ minFamily: n })}
              />
              <ProtocolSlider
                label="Core contacts to maintain"
                subtitle="Count of relationships the system tracks."
                value={draft.coreContacts || 0}
                min={0}
                max={50}
                step={1}
                breach={false}
                dialMax={50}
                formatDisplay={(n) => `${n} CONTACTS`}
                onChange={(n) => updateDraft({ coreContacts: n })}
              />
            </div>
          ) : null}
        </section>

        <div className="sticky bottom-0 pt-2 pb-1 -mx-2 px-2 bg-gradient-to-t from-neutral-950/95 to-transparent">
          <button
            type="button"
            onClick={commit}
            className="w-full py-3 rounded-xl font-headline font-bold uppercase tracking-[0.35em] text-sm bg-red-950/80 text-[#f5f5f0] border border-red-900/50 hover:bg-red-900/90 hover:border-red-700/60 transition-colors shadow-[0_0_24px_rgba(127,29,29,0.35)]"
          >
            COMMIT PROTOCOLS
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConstraintsView;
