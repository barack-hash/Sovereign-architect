/**
 * Unit normalisation.
 *
 * Every rate in the plan is stored at whatever frequency the user typed it, and
 * converted here exactly once. The old code had two divergent copies of these
 * tables (App.tsx and CanvasView.tsx) keyed on capitalised strings, so a value
 * could normalise differently depending on which file read it.
 */

import type { Frequency } from './types';

/** Average months are 30.4375 days; weeks are 4.348 per month. */
const PER_MONTH: Record<Frequency, number> = {
  daily: 30.4375,
  weekly: 4.348,
  biweekly: 2.174,
  monthly: 1,
  yearly: 1 / 12,
};

const PER_DAY: Record<Frequency, number> = {
  daily: 1,
  weekly: 1 / 7,
  biweekly: 1 / 14,
  monthly: 1 / 30.4375,
  yearly: 1 / 365.25,
};

const PER_WEEK: Record<Frequency, number> = {
  daily: 7,
  weekly: 1,
  biweekly: 0.5,
  monthly: 1 / 4.348,
  yearly: 1 / 52.18,
};

export const toMonthly = (value: number, frequency: Frequency): number =>
  (Number.isFinite(value) ? value : 0) * (PER_MONTH[frequency] ?? 1);

export const toDaily = (value: number, frequency: Frequency): number =>
  (Number.isFinite(value) ? value : 0) * (PER_DAY[frequency] ?? 1);

export const toWeekly = (value: number, frequency: Frequency): number =>
  (Number.isFinite(value) ? value : 0) * (PER_WEEK[frequency] ?? 1);

/** Converts an annual percentage rate to its compounding monthly equivalent. */
export const annualPctToMonthlyRate = (annualPct: number): number => {
  const safe = Number.isFinite(annualPct) ? annualPct : 0;
  return Math.pow(1 + safe / 100, 1 / 12) - 1;
};

/** Guards every value entering the engine so one NaN cannot poison a whole run. */
export const num = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

/** Indices are all 0-100. */
export const clampIndex = (value: number): number => clamp(value, 0, 100);
