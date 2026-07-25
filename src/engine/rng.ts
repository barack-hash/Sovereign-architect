/**
 * Seeded pseudo-random number generation.
 *
 * The simulator is deterministic by design, so every source of randomness in
 * the system is explicit and reproducible: same seed, same trials, same answer.
 * `Math.random()` must never appear anywhere in the engine — a stress test you
 * cannot reproduce is not a test, it is an anecdote.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** Standard normal via Box-Muller. */
  normal(mean?: number, stdDev?: number): number;
  /** Uniformly picks one element. */
  pick<T>(items: T[]): T;
  /** Fisher-Yates, returning a new array. */
  shuffle<T>(items: T[]): T[];
}

/** mulberry32 — small, fast, good enough distribution for scenario sampling. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    normal(mean = 0, stdDev = 1) {
      // Reject exact zero so the log is finite.
      let u = 0;
      while (u === 0) u = next();
      const v = next();
      return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle(items) {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

/** Turns any string into a stable 32-bit seed, so plans seed reproducibly by id. */
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
