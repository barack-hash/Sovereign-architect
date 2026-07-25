/**
 * Assumptions and data management.
 *
 * The assumptions here are the ones the engine actually reads. v1's path yields
 * added a hard-coded +4.2% (conservative) or +18.7% (aggressive) on top of the
 * user's number, which meant the return you typed was never the return you got.
 */

import React, { useRef, useState } from 'react';
import { Download, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import type { Assumptions, Plan } from '../engine';
import type { PlanController } from '../state/usePlan';
import {
  Badge,
  Button,
  Explain,
  Field,
  NumberInput,
  Panel,
  SectionHeading,
  SliderInput,
  TextInput,
  Toggle,
} from '../ui/primitives';
import { money, percent } from '../ui/format';

interface Props {
  plan: Plan;
  controller: PlanController;
  onUpdateAssumptions: (patch: Partial<Assumptions>, historyKey?: string) => void;
  onUpdatePlan: (patch: Partial<Plan>, historyKey?: string) => void;
}

export function SettingsView({ plan, controller, onUpdateAssumptions, onUpdatePlan }: Props) {
  const { assumptions } = plan;
  const fileRef = useRef<HTMLInputElement>(null);
  const [snapshotName, setSnapshotName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const commit = controller.commitHistory;

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    const result = await controller.importPlan(file);
    setImportError(result.ok ? null : (result.error ?? 'Import failed.'));
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto terminal-scroll p-4 md:p-8 space-y-6 md:space-y-8">
      <SectionHeading>Plan</SectionHeading>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Panel title="Identity">
          <div className="space-y-4">
            <Field label="Plan name">
              <TextInput
                value={plan.name}
                onChange={(v) => onUpdatePlan({ name: v }, 'plan:name')}
                onCommit={commit}
              />
            </Field>
            <Field label="Horizon" hint="how many months to simulate">
              <NumberInput
                value={plan.horizonMonths}
                min={1}
                max={600}
                suffix="mo"
                onChange={(v) => onUpdatePlan({ horizonMonths: Math.max(1, Math.round(v)) }, 'plan:horizon')}
                onCommit={commit}
              />
            </Field>
            <Explain>
              A short horizon makes long objectives look unreachable. If a goal is five years out,
              simulate sixty months.
            </Explain>
          </div>
        </Panel>

        <Panel title="Returns & costs">
          <div className="space-y-4">
            <Field label="Expected annual return">
              <NumberInput
                value={assumptions.annualYieldPct}
                step={0.1}
                suffix="%"
                onChange={(v) => onUpdateAssumptions({ annualYieldPct: v }, 'a:yield')}
                onCommit={commit}
              />
            </Field>
            <SliderInput
              label="Share of cash actually invested"
              min={0}
              max={1}
              step={0.05}
              value={assumptions.investedFraction}
              display={percent(assumptions.investedFraction * 100, 0)}
              onChange={(v) => onUpdateAssumptions({ investedFraction: v }, 'a:invested')}
              onCommit={commit}
            />
            <Field label="Annual inflation">
              <NumberInput
                value={assumptions.annualInflationPct}
                step={0.1}
                suffix="%"
                onChange={(v) => onUpdateAssumptions({ annualInflationPct: v }, 'a:inflation')}
                onCommit={commit}
              />
            </Field>
            <Explain>
              Return compounds only on the invested share of positive cash, never on debt.
              Inflation escalates recurring expenses month over month.
            </Explain>
          </div>
        </Panel>

        <Panel title="Debt">
          <div className="space-y-4">
            <Field label="Annual interest on debt">
              <NumberInput
                value={assumptions.annualDebtInterestPct}
                step={0.1}
                suffix="%"
                onChange={(v) => onUpdateAssumptions({ annualDebtInterestPct: v }, 'a:debt')}
                onCommit={commit}
              />
            </Field>
            <Toggle
              checked={assumptions.autoPayDebtFromSurplus}
              onChange={(v) => onUpdateAssumptions({ autoPayDebtFromSurplus: v })}
              label="Pay down debt from surplus"
              hint="Applies each month's positive cash flow against the balance"
            />
            <Field label="Cash to keep back" hint="before paying down debt">
              <NumberInput
                value={assumptions.cashReserve}
                min={0}
                prefix="$"
                onChange={(v) => onUpdateAssumptions({ cashReserve: v }, 'a:reserve')}
                onCommit={commit}
              />
            </Field>
            <Explain>
              Any month you spend more than you earn, the shortfall becomes debt at this rate rather
              than silently disappearing.
            </Explain>
          </div>
        </Panel>

        <Panel title="How you wear">
          <div className="space-y-4">
            <SliderInput
              label="Baseline health drift"
              min={-5}
              max={5}
              step={0.1}
              value={assumptions.baselineEmotionalDrift}
              display={`${assumptions.baselineEmotionalDrift > 0 ? '+' : ''}${assumptions.baselineEmotionalDrift}/mo`}
              tone={assumptions.baselineEmotionalDrift < 0 ? 'bad' : 'good'}
              onChange={(v) => onUpdateAssumptions({ baselineEmotionalDrift: v }, 'a:edrift')}
              onCommit={commit}
            />
            <SliderInput
              label="Baseline relational drift"
              min={-5}
              max={5}
              step={0.1}
              value={assumptions.baselineRelationalDrift}
              display={`${assumptions.baselineRelationalDrift > 0 ? '+' : ''}${assumptions.baselineRelationalDrift}/mo`}
              tone={assumptions.baselineRelationalDrift < 0 ? 'bad' : 'good'}
              onChange={(v) => onUpdateAssumptions({ baselineRelationalDrift: v }, 'a:rdrift')}
              onCommit={commit}
            />
            <SliderInput
              label="Baseline spiritual drift"
              min={-5}
              max={5}
              step={0.1}
              value={assumptions.baselineSpiritualDrift}
              display={`${assumptions.baselineSpiritualDrift > 0 ? '+' : ''}${assumptions.baselineSpiritualDrift}/mo`}
              tone={assumptions.baselineSpiritualDrift < 0 ? 'bad' : 'good'}
              onChange={(v) => onUpdateAssumptions({ baselineSpiritualDrift: v }, 'a:sdrift')}
              onCommit={commit}
            />
            <Explain>
              Drift is what happens if you do nothing. Ledger lines and tasks push against it —
              time with family, study, worship — so a flat or rising index means the things you do
              are outpacing the entropy.
            </Explain>
          </div>
        </Panel>

        <Panel title="Burnout & overload">
          <div className="space-y-4">
            <SliderInput
              label="Burnout threshold"
              min={0}
              max={100}
              value={assumptions.burnoutThreshold}
              display={percent(assumptions.burnoutThreshold, 0)}
              tone="warn"
              onChange={(v) => onUpdateAssumptions({ burnoutThreshold: v }, 'a:bthresh')}
              onCommit={commit}
            />
            <SliderInput
              label="Income lost while burned out"
              min={0}
              max={1}
              step={0.05}
              value={assumptions.burnoutIncomePenalty}
              display={percent(assumptions.burnoutIncomePenalty * 100, 0)}
              tone="bad"
              onChange={(v) => onUpdateAssumptions({ burnoutIncomePenalty: v }, 'a:bpen')}
              onCommit={commit}
            />
            <SliderInput
              label="Health lost per hour of overallocation"
              min={0}
              max={10}
              step={0.5}
              value={assumptions.overloadEmotionalPenaltyPerHour}
              display={`${assumptions.overloadEmotionalPenaltyPerHour}/mo per hour`}
              tone="bad"
              onChange={(v) => onUpdateAssumptions({ overloadEmotionalPenaltyPerHour: v }, 'a:opl')}
              onCommit={commit}
            />
            <Explain>
              These three numbers create the feedback loop that makes the model worth trusting:
              overcommit your day, health falls, income falls, the plan slows, and you fall further
              behind. Set the overload penalty to zero to disable it.
            </Explain>
          </div>
        </Panel>

        <Panel title="Snapshots" subtitle="Frozen copies of the whole plan">
          <div className="space-y-4">
            {/* The input is the only thing allowed to shrink here: without the
                min-w-0 wrapper its `w-full` fights the button for the ~324px a
                390px phone leaves inside the panel. */}
            <div className="flex items-stretch gap-2">
              <div className="flex-1 min-w-0">
                <TextInput
                  value={snapshotName}
                  onChange={setSnapshotName}
                  placeholder="Name this version"
                />
              </div>
              <Button
                variant="primary"
                title="Save snapshot"
                className="shrink-0 inline-flex items-center justify-center min-h-10 md:min-h-0"
                onClick={() => {
                  controller.saveSnapshot(snapshotName);
                  setSnapshotName('');
                }}
              >
                <Save size={11} />
              </Button>
            </div>

            {controller.snapshots.length === 0 ? (
              <p className="text-[10px] font-mono text-on-surface-variant/60 italic">
                No snapshots yet. These persist across reloads — v1's did not.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto terminal-scroll pr-1">
                {controller.snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="flex items-center justify-between gap-2 md:gap-3 px-3 py-1.5 md:py-2 bg-surface-lowest border border-outline-variant/20 group"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-headline font-bold uppercase text-on-surface truncate">
                        {snapshot.name}
                      </span>
                      <span className="block text-[9px] font-mono text-on-surface-variant/60 truncate">
                        {new Date(snapshot.createdAt).toLocaleString()}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 md:gap-2 shrink-0">
                      <button
                        onClick={() => controller.loadSnapshot(snapshot.id)}
                        className="inline-flex items-center justify-center min-h-10 md:min-h-0 min-w-10 md:min-w-auto px-2 md:px-0 text-[9px] font-mono font-bold uppercase text-primary hover:brightness-125"
                      >
                        Load
                      </button>
                      {/* Delete is hover-revealed only where a real pointer exists.
                          Gating on `pointer-fine` rather than a width breakpoint
                          matters because Tailwind compiles `group-hover` inside
                          `@media (hover: hover)`: on any touch screen the reveal
                          rule can never fire, so a width-based `md:opacity-0`
                          would leave this permanently invisible on a tablet. */}
                      <button
                        onClick={() => controller.deleteSnapshot(snapshot.id)}
                        title="Delete snapshot"
                        className="inline-flex items-center justify-center min-h-10 md:min-h-0 min-w-10 md:min-w-auto px-2 md:px-0 text-secondary opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={11} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Data" subtitle="Everything lives in this browser; nothing is sent anywhere">
        {/* Wraps to two rows at 390px; each button keeps a 40px touch target. */}
        <div className="flex flex-wrap gap-2 md:gap-3">
          <Button
            onClick={controller.exportPlan}
            className="inline-flex items-center justify-center min-h-10 md:min-h-0"
          >
            <span className="flex items-center gap-2">
              <Download size={11} /> Export plan
            </span>
          </Button>

          <Button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center justify-center min-h-10 md:min-h-0"
          >
            <span className="flex items-center gap-2">
              <Upload size={11} /> Import plan
            </span>
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => void handleImport(e.target.files?.[0])}
          />

          <Button
            variant="danger"
            className="inline-flex items-center justify-center min-h-10 md:min-h-0"
            onClick={() => {
              if (window.confirm('Replace the current plan with a fresh one? This can be undone.')) {
                controller.resetPlan();
              }
            }}
          >
            <span className="flex items-center gap-2">
              <RotateCcw size={11} /> Start a new plan
            </span>
          </Button>
        </div>

        {importError && (
          <p className="mt-3 text-[10px] font-mono text-secondary">{importError}</p>
        )}

        <Explain>
          Import accepts both this version's format and a v1 export, which is converted on the way
          in. Exporting is the only backup — clearing browser data erases everything.
        </Explain>
      </Panel>
    </div>
  );
}
