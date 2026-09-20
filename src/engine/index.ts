/**
 * Public surface of the simulation engine.
 *
 * The UI imports only from here. Nothing in `src/components` should reach into
 * an engine module directly — that boundary is what keeps the maths testable in
 * isolation and stops calculation logic drifting back into render code, which is
 * how v1 ended up with three divergent copies of its unit conversions.
 */

export * from './types';
export * from './units';
export * from './graph';
export * from './schedule';
export * from './constraints';
export * from './simulate';
export * from './explore';
export * from './montecarlo';
export * from './rng';
export * from './factory';
export * from './migrate';
export * from './templates';
