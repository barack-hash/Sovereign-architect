/**
 * Shared interface primitives.
 *
 * v1 repeated the same ~10 Tailwind class strings across 5,700 lines, which is
 * why a handful of inputs quietly diverged (some committed on change, some on
 * blur, some coerced `NaN` into state). Every input here behaves identically.
 */

import React from 'react';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  tone = 'default',
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  tone?: 'default' | 'primary' | 'danger';
}) {
  return (
    <section
      className={cn(
        'bg-surface border',
        tone === 'primary' && 'border-primary/30',
        tone === 'danger' && 'border-secondary/40',
        tone === 'default' && 'border-outline-variant/20',
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 md:px-5 py-3 border-b border-outline-variant/10">
          <div className="min-w-0">
            {title && (
              <h3 className="text-[10px] font-headline font-bold uppercase tracking-[0.25em] text-on-surface truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[9px] font-mono uppercase tracking-wider text-on-surface-variant/70 mt-1 truncate">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className="p-4 md:p-5">{children}</div>
    </section>
  );
}

export function SectionHeading({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    // The connecting rule is hidden on mobile: at 390px it squeezes to a few
    // pixels between the title and whatever sits in the `right` slot.
    <div className="flex items-center gap-3 md:gap-6 mb-4 md:mb-5">
      <h2 className="text-[11px] font-headline font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] text-on-surface-variant whitespace-nowrap">
        {children}
      </h2>
      <div className="hidden sm:block h-px flex-1 bg-outline-variant/20" />
      <div className="ml-auto sm:ml-0 shrink-0">{right}</div>
    </div>
  );
}

export function EmptyState({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-outline-variant/30 py-12 px-6 text-center">
      <p className="font-mono text-[11px] uppercase tracking-widest text-on-surface-variant">
        {children}
      </p>
      {hint && <p className="mt-3 text-[10px] text-on-surface-variant/60 max-w-md mx-auto leading-relaxed">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text and badges
// ---------------------------------------------------------------------------

export function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-[9px] font-headline uppercase tracking-[0.15em] text-on-surface-variant mb-1.5">
      {children}
      {hint && <span className="ml-2 normal-case tracking-normal text-on-surface-variant/50">{hint}</span>}
    </label>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  pulse,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 border text-[9px] font-mono font-bold uppercase tracking-wider whitespace-nowrap',
        tone === 'good' && 'bg-primary/10 text-primary border-primary/30',
        tone === 'warn' && 'bg-amber-400/10 text-amber-400 border-amber-400/30',
        tone === 'bad' && 'bg-secondary/10 text-secondary border-secondary/40',
        tone === 'info' && 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30',
        tone === 'neutral' && 'bg-surface-container text-on-surface-variant border-outline-variant/30',
        pulse && 'animate-pulse',
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
  icon,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-surface border-l-2 border-outline-variant/30 p-4 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between mb-3 gap-2">
        <span className="text-[9px] font-headline uppercase tracking-[0.2em] text-on-surface-variant leading-tight">
          {label}
        </span>
        {icon && (
          <span
            className={cn(
              'p-1.5 shrink-0',
              tone === 'good' && 'bg-primary/10 text-primary',
              tone === 'warn' && 'bg-amber-400/10 text-amber-400',
              tone === 'bad' && 'bg-secondary/10 text-secondary',
              tone === 'info' && 'bg-cyan-400/10 text-cyan-300',
              tone === 'neutral' && 'bg-surface-highest text-on-surface-variant',
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p
        className={cn(
          'text-2xl font-headline font-bold tracking-tight tabular-nums',
          tone === 'bad' && 'text-secondary',
          tone === 'good' && 'text-primary',
          tone === 'warn' && 'text-amber-400',
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[9px] font-mono uppercase tracking-wider text-on-surface-variant/70 mt-1">
          {sub}
        </p>
      )}
    </div>
  );
}

export function Meter({ value, max = 100, tone = 'good' }: { value: number; max?: number; tone?: 'good' | 'warn' | 'bad' | 'info' }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className="h-1 w-full bg-surface-highest overflow-hidden">
      <div
        className={cn(
          'h-full transition-[width] duration-500',
          tone === 'good' && 'bg-primary',
          tone === 'warn' && 'bg-amber-400',
          tone === 'bad' && 'bg-secondary',
          tone === 'info' && 'bg-cyan-400',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

/**
 * `text-base` on mobile is deliberate: iOS Safari zooms the viewport whenever a
 * focused input has a font-size below 16px, which throws the whole layout off.
 * The taller padding also keeps every field a comfortable touch target.
 */
const inputClass =
  'w-full bg-surface-lowest border border-outline-variant/30 px-3 py-2.5 md:py-2 ' +
  'text-base md:text-xs font-mono text-on-surface ' +
  'focus:border-primary focus:outline-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed ' +
  'placeholder:text-on-surface-variant/40';

export function TextInput({
  value,
  onChange,
  onCommit,
  disabled,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      className={cn(inputClass, className)}
    />
  );
}

/**
 * A numeric field that keeps its own text while focused.
 *
 * Binding a number directly to an input makes it impossible to clear the field
 * or type "-" or "1.", because each keystroke round-trips through `Number()`.
 * v1 handled this with `Number(e.target.value) || 0`, which silently rewrote a
 * half-typed "1.5" as 0 and made "-" impossible to enter at all.
 */
export function NumberInput({
  value,
  onChange,
  onCommit,
  disabled,
  min,
  max,
  step,
  prefix,
  suffix,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const display = draft ?? String(Number.isFinite(value) ? value : 0);

  const clampToBounds = (n: number) => {
    let out = n;
    if (min !== undefined) out = Math.max(min, out);
    if (max !== undefined) out = Math.min(max, out);
    return out;
  };

  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-on-surface-variant pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={display}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          // Push through only genuinely parseable values; intermediate states
          // like "" or "-" are held in the draft until blur.
          const parsed = Number(text);
          if (text.trim() !== '' && Number.isFinite(parsed)) onChange(clampToBounds(parsed));
        }}
        onBlur={() => {
          const parsed = Number(draft ?? '');
          if (draft !== null && (draft.trim() === '' || !Number.isFinite(parsed))) {
            onChange(clampToBounds(0));
          } else if (draft !== null) {
            onChange(clampToBounds(parsed));
          }
          setDraft(null);
          onCommit?.();
        }}
        className={cn(inputClass, prefix && 'pl-7', suffix && 'pr-10', 'tabular-nums', className)}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-on-surface-variant pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(inputClass, 'cursor-pointer', className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-surface-lowest">
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SliderInput({
  value,
  onChange,
  onCommit,
  min,
  max,
  step = 1,
  label,
  display,
  tone = 'good',
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  min: number;
  max: number;
  step?: number;
  label: React.ReactNode;
  display?: React.ReactNode;
  tone?: 'good' | 'warn' | 'bad';
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline gap-3">
        <span className="text-[9px] font-headline uppercase tracking-[0.15em] text-on-surface-variant">
          {label}
        </span>
        <span
          className={cn(
            'text-[10px] font-mono font-bold tabular-nums',
            tone === 'good' && 'text-primary',
            tone === 'warn' && 'text-amber-400',
            tone === 'bad' && 'text-secondary',
          )}
        >
          {display ?? value}
        </span>
      </div>
      {/* A 1px-tall range is unusable with a fingertip; `slider-touch` (index.css)
          keeps the visual track thin but grows the hit area and thumb on coarse
          pointers. `touch-action: none` stops a drag scrolling the page instead. */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : min}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className={cn(
          'slider-touch w-full cursor-pointer disabled:opacity-40',
          tone === 'good' && 'accent-primary',
          tone === 'warn' && 'accent-amber-400',
          tone === 'bad' && 'accent-secondary',
        )}
      />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full gap-4 p-2.5 bg-surface-container border border-outline-variant/20 hover:border-primary/30 transition-colors text-left disabled:opacity-40"
    >
      <span className="min-w-0">
        <span className="block text-[10px] font-headline font-bold uppercase tracking-wider text-on-surface">
          {label}
        </span>
        {hint && <span className="block text-[9px] text-on-surface-variant/70 mt-0.5">{hint}</span>}
      </span>
      <span
        className={cn(
          'relative w-9 h-4 shrink-0 transition-colors',
          checked ? 'bg-primary/25' : 'bg-surface-highest',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-3 h-3 transition-all',
            checked ? 'left-[calc(100%-0.875rem)] bg-primary' : 'left-0.5 bg-on-surface-variant',
          )}
        />
      </span>
    </button>
  );
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  disabled,
  className,
  title,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'danger' | 'ghost' | 'accent';
  disabled?: boolean;
  className?: string;
  title?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-4 py-2 text-[10px] font-headline font-bold uppercase tracking-[0.15em] transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100',
        variant === 'primary' && 'bg-primary text-on-primary hover:brightness-110',
        variant === 'accent' && 'bg-secondary text-surface-lowest hover:brightness-110',
        variant === 'danger' &&
          'bg-transparent border border-secondary/50 text-secondary hover:bg-secondary/10',
        variant === 'ghost' &&
          'bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:border-primary/40',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label hint={hint}>{label}</Label>
      {children}
    </div>
  );
}

/** Inline explanation of what a control actually does to the simulation. */
export function Explain({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] leading-relaxed text-on-surface-variant/60 mt-1.5">{children}</p>
  );
}
