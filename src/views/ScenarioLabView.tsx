/**
 * The Scenario Lab: enumerate the orderings, quantify the tradeoffs, rank them.
 *
 * This is the view v1 gestured at with two hard-coded cards labelled
 * "Conservative" and "Aggressive". Here every row is a real schedule that was
 * actually simulated, and every column is a measured outcome.
 */

import React, { useState } from 'react';
import { AlertTriangle, Check, GitBranch, Play, Sparkles, Trophy } from 'lucide-react';
import type { Plan, ScoreWeights, Variant } from '../engine';
import { DEFAULT_WEIGHTS } from '../engine';
import type { Analysis } from '../state/useAnalysis';
import { Badge, Button, EmptyState, Explain, Panel, SectionHeading, SliderInput } from '../ui/primitives';
import { duration, hours, money, moneyShort, percent, rate } from '../ui/format';
import { cn } from '../lib/utils';

interface Props {
  plan: Plan;
  analysis: Analysis;
  onApplyVariant: (variant: Variant) => void;
}

const WEIGHT_FIELDS: Array<{ key: keyof ScoreWeights; label: string; hint: string }> = [
  { key: 'speed', label: 'Speed', hint: 'Reach the objectives sooner' },
  { key: 'wealth', label: 'Wealth', hint: 'End with more capital' },
  { key: 'health', label: 'Health', hint: 'Protect the emotional floor' },
  { key: 'relational', label: 'Relationships', hint: 'Protect relational capital' },
  { key: 'spiritual', label: 'Spiritual', hint: 'Protect spiritual alignment' },
  { key: 'safety', label: 'Safety', hint: 'Avoid breaches and insolvency' },
];

export function ScenarioLabView({ plan, analysis, onApplyVariant }: Props) {
  const { exploration, isExploring, runExplore } = analysis;
  const [weights, setWeights] = useState<ScoreWeights>({ ...DEFAULT_WEIGHTS });
  const [selected, setSelected] = useState<string | null>(null);
  const [respectCash, setRespectCash] = useState(true);

  const optionalCount = plan.nodes.filter((n) => n.kind === 'task' && (n as any).optional).length;
  const taskCount = plan.nodes.filter((n) => n.kind === 'task').length;

  const run = () => {
    void runExplore(weights, { respectCashOnHand: respectCash, randomSamples: 8 }).then((result) => {
      setSelected(result.best?.id ?? null);
    });
  };

  const selectedVariant =
    exploration?.variants.find((v) => v.id === selected) ?? exploration?.best ?? null;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto terminal-scroll p-4 md:p-8 space-y-6 md:space-y-8">
      <div>
        <SectionHeading right={<Badge tone="info">{taskCount} TASKS · {optionalCount} OPTIONAL</Badge>}>
          Scenario Lab
        </SectionHeading>
        <p className="text-[11px] text-on-surface-variant/80 leading-relaxed max-w-3xl -mt-2">
          Every ordering of your work that fits inside a day, simulated end to end and scored. Tasks
          marked optional are also tried both ways. Adjust what you care about, and the ranking
          changes — that is the tradeoff, made explicit.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[20rem_1fr] gap-4 md:gap-6 items-start">
        {/* ---- Controls ---- */}
        <div className="space-y-4 min-w-0">
          <Panel title="What matters to you" subtitle="Weights for the headline score">
            <div className="space-y-5 md:space-y-4">
              {WEIGHT_FIELDS.map((field) => (
                // No height override here on purpose: `.slider-touch` (index.css)
                // already gives the range input a 2.25rem hit area with a 22px
                // thumb on coarse pointers, and 1.25rem on desktop. A local
                // `h-*` would out-specify it and collapse the desktop track.
                <div key={field.key}>
                  <SliderInput
                    label={field.label}
                    min={0}
                    max={1}
                    step={0.05}
                    value={weights[field.key]}
                    display={weights[field.key].toFixed(2)}
                    tone={weights[field.key] === 0 ? 'bad' : 'good'}
                    onChange={(v) => setWeights((w) => ({ ...w, [field.key]: v }))}
                  />
                  <Explain>{field.hint}</Explain>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Search settings">
            <div className="space-y-3">
              {/* The whole label toggles, so the real target is this row, not the
                  box — min-h-10 guarantees it clears 40px even if the copy ever
                  shortens to one line. The box itself is also enlarged on touch. */}
              <label className="flex items-start gap-3 cursor-pointer group py-1.5 md:py-0 min-h-10 md:min-h-0">
                <input
                  type="checkbox"
                  checked={respectCash}
                  onChange={(e) => setRespectCash(e.target.checked)}
                  className="mt-0.5 shrink-0 w-5 h-5 md:w-3.5 md:h-3.5 accent-primary"
                />
                <span>
                  <span className="block text-[10px] font-headline uppercase tracking-wider text-on-surface group-hover:text-primary transition-colors">
                    Only start what I can afford
                  </span>
                  <Explain>
                    Delays a task until the cash for its upfront cost exists. Turn off to see the
                    schedule you could run with unlimited credit.
                  </Explain>
                </span>
              </label>

              {/* min-h-10 keeps the primary action a full 40px target on mobile. */}
              <Button
                variant="primary"
                onClick={run}
                disabled={isExploring}
                className="w-full min-h-10 md:min-h-0 py-3 md:py-2"
              >
                <span className="flex items-center justify-center gap-2">
                  {isExploring ? <Sparkles size={12} className="animate-pulse" /> : <Play size={12} />}
                  {isExploring ? 'Searching…' : 'Run the search'}
                </span>
              </Button>
            </div>
          </Panel>

          {exploration && exploration.notes.length > 0 && (
            <Panel title="Notes" tone="danger">
              <ul className="space-y-2">
                {exploration.notes.map((note, i) => (
                  <li key={i} className="text-[10px] font-mono text-on-surface-variant leading-relaxed">
                    — {note}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        {/* ---- Results ---- */}
        <div className="space-y-6 min-w-0">
          {!exploration ? (
            <EmptyState hint="The search runs every priority rule against every combination of optional work, simulates each one, and ranks the results. Nothing is precomputed.">
              Run the search to compare orderings
            </EmptyState>
          ) : exploration.variants.length === 0 ? (
            <EmptyState hint="Add task nodes with durations and dependencies, then run again.">
              No variants could be generated
            </EmptyState>
          ) : (
            <>
              <BestByAxis exploration={exploration} onSelect={setSelected} />

              <Panel
                title="Ranked orderings"
                subtitle={`${exploration.evaluated} schedules simulated · ${exploration.variants.length} distinct · ${exploration.paretoFront.length} non-dominated`}
              >
                {/*
                  The table is deliberately wider than a phone and scrolls inside
                  this container rather than shrinking below a readable size. The
                  edge-to-edge bleed (-mx-5) is desktop-only: it assumes the panel's
                  own padding, so on mobile the scroller stays safely inside it and
                  can never push the page sideways. overscroll-x-contain stops a
                  sideways swipe from chaining out to the page.
                */}
                <div className="overflow-x-auto overscroll-x-contain md:-mx-5 md:px-5">
                  <table className="w-full min-w-[52rem] border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant/20">
                        <Th>Strategy</Th>
                        <Th align="right">Score</Th>
                        <Th align="right">Done</Th>
                        <Th align="right">Net worth</Th>
                        <Th align="right">Health floor</Th>
                        <Th align="right">Free time</Th>
                        <Th align="right">Breaches</Th>
                        <Th>Front</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {exploration.variants.map((variant, rank) => (
                        <VariantRow
                          key={variant.id}
                          variant={variant}
                          rank={rank}
                          selected={selectedVariant?.id === variant.id}
                          onSelect={() => setSelected(variant.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile only: the table's extra columns are off-screen until swiped. */}
                <div className="md:hidden">
                  <Explain>Swipe the table sideways to see every column.</Explain>
                </div>
                <Explain>
                  "Front" marks a plan nothing else beats on every axis at once. Anything without it
                  is strictly worse than some other row and can be discarded.
                </Explain>
              </Panel>

              {selectedVariant && (
                <VariantDetail
                  plan={plan}
                  variant={selectedVariant}
                  onApply={() => onApplyVariant(selectedVariant)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={cn(
        'py-2 px-2 text-[9px] font-headline uppercase tracking-[0.15em] text-on-surface-variant font-bold',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
  tone,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  tone?: string;
}) {
  return (
    <td
      className={cn(
        // Rows are clickable, so they need a ~40px tall hit area on touch screens.
        'py-3.5 md:py-2 px-2 text-[10px] font-mono tabular-nums',
        align === 'right' ? 'text-right' : 'text-left',
        tone ?? 'text-on-surface',
      )}
    >
      {children}
    </td>
  );
}

function VariantRow({
  variant,
  rank,
  selected,
  onSelect,
}: {
  variant: Variant;
  rank: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const m = variant.metrics;

  return (
    <tr
      onClick={onSelect}
      className={cn(
        'border-b border-outline-variant/10 cursor-pointer transition-colors',
        selected ? 'bg-primary/10' : 'hover:bg-surface-container',
      )}
    >
      <Td>
        <span className="flex items-center gap-2">
          {rank === 0 && <Trophy size={11} className="text-primary shrink-0" />}
          <span className="truncate max-w-[22rem]">{variant.label}</span>
          {variant.omitted.length > 0 && (
            <Badge tone="warn">−{variant.omitted.length}</Badge>
          )}
        </span>
      </Td>
      <Td align="right" tone="text-primary font-bold">
        {(variant.score * 100).toFixed(0)}
      </Td>
      <Td align="right" tone={m.completionMonth === null ? 'text-secondary' : 'text-on-surface'}>
        {m.completionMonth === null ? `${m.objectivesMet}/${m.objectivesTotal}` : `M${m.completionMonth}`}
      </Td>
      <Td align="right" tone={m.finalNetWorth < 0 ? 'text-secondary' : 'text-on-surface'}>
        {moneyShort(m.finalNetWorth)}
      </Td>
      <Td align="right" tone={m.minEmotional < 30 ? 'text-secondary' : m.minEmotional < 55 ? 'text-amber-400' : 'text-primary'}>
        {percent(m.minEmotional, 0)}
      </Td>
      <Td align="right" tone={m.minFreeHours < 0 ? 'text-secondary' : 'text-on-surface'}>
        {hours(m.minFreeHours)}
      </Td>
      <Td align="right" tone={m.criticalViolations > 0 ? 'text-secondary' : 'text-on-surface-variant'}>
        {m.criticalViolations > 0 ? `${m.criticalViolations}!` : m.warningViolations || '—'}
      </Td>
      <Td>{variant.onParetoFront ? <Badge tone="good">YES</Badge> : <span className="text-on-surface-variant/40">—</span>}</Td>
    </tr>
  );
}

function BestByAxis({
  exploration,
  onSelect,
}: {
  exploration: NonNullable<Analysis['exploration']>;
  onSelect: (id: string) => void;
}) {
  const entries: Array<{ key: keyof typeof exploration.bestBy; label: string; describe: (v: Variant) => string }> = [
    {
      key: 'speed',
      label: 'Fastest',
      describe: (v) =>
        v.metrics.completionMonth === null
          ? `${v.metrics.objectivesMet}/${v.metrics.objectivesTotal} met`
          : duration(v.metrics.completionMonth),
    },
    { key: 'wealth', label: 'Richest', describe: (v) => money(v.metrics.finalNetWorth) },
    { key: 'health', label: 'Gentlest', describe: (v) => `health floor ${percent(v.metrics.minEmotional, 0)}` },
    { key: 'safety', label: 'Safest', describe: (v) => `${v.metrics.criticalViolations} critical breaches` },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {entries.map(({ key, label, describe }) => {
        const variant = exploration.bestBy[key];
        if (!variant) return null;
        return (
          <button
            key={key}
            onClick={() => onSelect(variant.id)}
            className="min-w-0 text-left bg-surface border-l-2 border-primary/40 p-3 md:p-4 hover:border-primary transition-colors"
          >
            <p className="text-[9px] font-headline uppercase tracking-[0.2em] text-on-surface-variant mb-2">
              {label}
            </p>
            <p className="text-[11px] font-headline font-bold text-on-surface truncate">
              {variant.label}
            </p>
            {/* truncate: variant descriptions can exceed a half-width phone card. */}
            <p className="text-[10px] font-mono text-primary mt-1 truncate">{describe(variant)}</p>
          </button>
        );
      })}
    </div>
  );
}

function VariantDetail({
  plan,
  variant,
  onApply,
}: {
  plan: Plan;
  variant: Variant;
  onApply: () => void;
}) {
  const m = variant.metrics;

  const ordered = Object.entries(variant.startMonths)
    .map(([id, start]) => ({
      id,
      start,
      node: plan.nodes.find((n) => n.id === id),
    }))
    .filter((row) => row.node)
    .sort((a, b) => a.start - b.start);

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <GitBranch size={12} className="text-primary" />
          {variant.label}
        </span>
      }
      subtitle={`Score ${(variant.score * 100).toFixed(0)} / 100${variant.onParetoFront ? ' · on the Pareto front' : ''}`}
      actions={
        // Shorter label on mobile so the panel header still fits its title beside it.
        <Button
          variant="primary"
          onClick={onApply}
          className="min-h-10 md:min-h-0 px-3 md:px-4 py-3 md:py-2"
        >
          <span className="flex items-center gap-2">
            <Check size={12} />
            <span className="md:hidden">Adopt</span>
            <span className="hidden md:inline">Adopt this ordering</span>
          </span>
        </Button>
      }
    >
      <div className="space-y-5 md:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat
            label="Objectives"
            value={`${m.objectivesMet}/${m.objectivesTotal}`}
            tone={m.objectivesMet === m.objectivesTotal ? 'good' : 'bad'}
          />
          <MiniStat
            label="Completes"
            value={m.completionMonth === null ? 'never' : duration(m.completionMonth)}
            tone={m.completionMonth === null ? 'bad' : 'good'}
          />
          <MiniStat label="Final net worth" value={money(m.finalNetWorth)} tone={m.finalNetWorth < 0 ? 'bad' : 'good'} />
          <MiniStat label="Lowest net worth" value={money(m.troughNetWorth)} tone={m.troughNetWorth < 0 ? 'bad' : 'neutral'} />
          <MiniStat label="Health floor" value={percent(m.minEmotional, 0)} tone={m.minEmotional < 30 ? 'bad' : 'good'} />
          <MiniStat label="Relational floor" value={percent(m.minRelational, 0)} tone={m.minRelational < 30 ? 'bad' : 'good'} />
          <MiniStat label="Spiritual floor" value={percent(m.minSpiritual, 0)} tone={m.minSpiritual < 30 ? 'bad' : 'good'} />
          <MiniStat
            label="Months insolvent"
            value={String(m.monthsInsolvent)}
            tone={m.monthsInsolvent > 0 ? 'bad' : 'good'}
          />
        </div>

        {variant.omittedNames.length > 0 && (
          <div className="flex items-start gap-3 p-3 bg-amber-400/5 border border-amber-400/25">
            <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[10px] font-mono text-on-surface leading-relaxed">
              This plan drops: <span className="text-amber-400">{variant.omittedNames.join(', ')}</span>
            </p>
          </div>
        )}

        <div>
          <p className="text-[9px] font-headline uppercase tracking-[0.2em] text-on-surface-variant mb-3">
            Order of operations
          </p>
          <ol className="space-y-1.5">
            {ordered.map((row, i) => (
              <li
                key={row.id}
                className="flex items-center gap-2 md:gap-3 px-3 py-2 md:py-1.5 bg-surface-lowest border-l border-outline-variant/30"
              >
                <span className="text-[9px] font-mono text-on-surface-variant/50 w-5 shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-mono text-on-surface flex-1 truncate">
                  {row.node!.name}
                </span>
                <span className="text-[9px] font-mono text-primary tabular-nums shrink-0">
                  starts M{row.start + 1}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <Explain>
          Adopting an ordering writes each task's start month back onto the plan as its earliest
          start, and removes any work this variant dropped. Undo reverses it.
        </Explain>
      </div>
    </Panel>
  );
}

function MiniStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad' | 'neutral';
}) {
  return (
    <div className="bg-surface-lowest border border-outline-variant/15 p-3">
      <p className="text-[8px] font-headline uppercase tracking-[0.15em] text-on-surface-variant mb-1">
        {label}
      </p>
      <p
        className={cn(
          'text-xs font-mono font-bold tabular-nums',
          tone === 'good' && 'text-primary',
          tone === 'bad' && 'text-secondary',
          tone === 'neutral' && 'text-on-surface',
        )}
      >
        {value}
      </p>
    </div>
  );
}
