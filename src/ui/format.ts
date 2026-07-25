/**
 * Display formatting. One definition per unit, so the same number never renders
 * two different ways in two different panels.
 */

const CURRENCY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const CURRENCY_PRECISE = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const safe = (n: number) => (Number.isFinite(n) ? n : 0);

export const money = (n: number) => CURRENCY.format(safe(n));
export const moneyPrecise = (n: number) => CURRENCY_PRECISE.format(safe(n));

/** Compact form for chart axes and tight cells: $12.4k, $1.2M. */
export function moneyShort(n: number): string {
  const v = safe(n);
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

export const percent = (n: number, digits = 1) => `${safe(n).toFixed(digits)}%`;

/** For fractions in 0..1. */
export const rate = (n: number, digits = 0) => `${(safe(n) * 100).toFixed(digits)}%`;

export const hours = (n: number, digits = 1) => `${safe(n).toFixed(digits)}h`;

export function signed(n: number, format: (v: number) => string = money): string {
  const v = safe(n);
  return `${v > 0 ? '+' : ''}${format(v)}`;
}

/** "M04" — the padded month token used throughout the interface. */
export const monthToken = (m: number) => `M${String(Math.max(0, Math.round(safe(m)))).padStart(2, '0')}`;

/** "1 yr 4 mo" — for durations that outgrow a plain month count. */
export function duration(months: number): string {
  const m = Math.max(0, Math.round(safe(months)));
  if (m === 0) return 'immediate';
  if (m < 12) return `${m} mo`;
  const years = Math.floor(m / 12);
  const rest = m % 12;
  return rest === 0 ? `${years} yr` : `${years} yr ${rest} mo`;
}

/** Slack reads better as a word than as a raw integer in the common cases. */
export function slackLabel(slack: number): string {
  const s = Math.round(safe(slack));
  if (s < 0) return `${Math.abs(s)} MO LATE`;
  if (s === 0) return 'CRITICAL';
  return `${s} MO SLACK`;
}

/** Edge labels are tighter than node labels, so zero slack reads as "TIGHT". */
export function linkSlackLabel(slack: number): string {
  const s = Math.round(safe(slack));
  if (s < 0) return `${Math.abs(s)} MO OVER`;
  if (s === 0) return 'TIGHT';
  return `+${s} MO`;
}
