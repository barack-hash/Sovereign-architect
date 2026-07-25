import { describe, expect, it } from 'vitest';
import {
  findCycle,
  topologicalOrder,
  reachableFrom,
  ancestorsOf,
  descendantsOf,
  wouldCreateCycle,
  validateGraph,
  hasBlockingIssue,
} from '../graph';
import { g, o, t, makePlan } from './helpers';

describe('findCycle', () => {
  it('returns null for an acyclic graph', () => {
    const nodes = [g('G'), t('A', ['G']), t('B', ['A']), o('OBJ', ['B'])];
    expect(findCycle(nodes)).toBeNull();
  });

  it('detects a two-node cycle', () => {
    const nodes = [g('G'), t('A', ['B']), t('B', ['A'])];
    const cycle = findCycle(nodes);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain('A');
    expect(cycle).toContain('B');
  });

  it('detects a longer cycle buried in a valid graph', () => {
    const nodes = [g('G'), t('A', ['G']), t('B', ['A']), t('C', ['B']), t('D', ['C'])];
    // Close the loop C -> B.
    (nodes[2] as any).dependsOn.push({ id: 'D' });
    expect(findCycle(nodes)).not.toBeNull();
  });

  it('does not report a cycle for a diamond', () => {
    // A diamond has two paths to the same node but no loop.
    const nodes = [g('G'), t('A', ['G']), t('B', ['G']), t('C', ['A', 'B'])];
    expect(findCycle(nodes)).toBeNull();
  });
});

describe('topologicalOrder', () => {
  it('places every node after its prerequisites', () => {
    const nodes = [g('G'), t('B', ['A']), t('A', ['G']), o('OBJ', ['B'])];
    const order = topologicalOrder(nodes)!;
    expect(order).not.toBeNull();
    expect(order.indexOf('G')).toBeLessThan(order.indexOf('A'));
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('OBJ'));
  });

  it('returns null on a cycle rather than a partial order', () => {
    const nodes = [g('G'), t('A', ['B']), t('B', ['A'])];
    expect(topologicalOrder(nodes)).toBeNull();
  });

  it('is stable across repeated calls', () => {
    const nodes = [g('G'), t('A', ['G']), t('B', ['G']), t('C', ['G'])];
    const first = topologicalOrder(nodes);
    const second = topologicalOrder(nodes);
    expect(first).toEqual(second);
  });
});

describe('reachability', () => {
  const nodes = [g('G'), t('A', ['G']), t('B', ['A']), t('ORPHAN'), o('OBJ', ['B'])];

  it('finds everything downstream of the root', () => {
    const reachable = reachableFrom(nodes, 'G');
    expect([...reachable].sort()).toEqual(['A', 'B', 'G', 'OBJ']);
  });

  it('excludes disconnected nodes', () => {
    expect(reachableFrom(nodes, 'G').has('ORPHAN')).toBe(false);
  });

  it('collects transitive ancestors', () => {
    expect([...ancestorsOf(nodes, 'OBJ')].sort()).toEqual(['A', 'B', 'G']);
  });

  it('collects transitive descendants excluding self', () => {
    const desc = descendantsOf(nodes, 'A');
    expect([...desc].sort()).toEqual(['B', 'OBJ']);
    expect(desc.has('A')).toBe(false);
  });
});

describe('wouldCreateCycle', () => {
  const nodes = [g('G'), t('A', ['G']), t('B', ['A'])];

  it('rejects a self edge', () => {
    expect(wouldCreateCycle(nodes, 'A', 'A')).toBe(true);
  });

  it('rejects a back edge', () => {
    // B already depends on A, so A depending on B would close a loop.
    expect(wouldCreateCycle(nodes, 'B', 'A')).toBe(true);
  });

  it('allows a forward edge', () => {
    expect(wouldCreateCycle(nodes, 'G', 'B')).toBe(false);
  });
});

describe('validateGraph', () => {
  it('accepts a well-formed plan', () => {
    const plan = makePlan([g('G'), t('A', ['G']), o('OBJ', ['A'])]);
    expect(hasBlockingIssue(validateGraph(plan))).toBe(false);
  });

  it('flags a missing Genesis as blocking', () => {
    const plan = makePlan([t('A'), o('OBJ', ['A'])]);
    const issues = validateGraph(plan);
    expect(issues.some((i) => i.code === 'NO_GENESIS')).toBe(true);
    expect(hasBlockingIssue(issues)).toBe(true);
  });

  it('flags a dangling dependency', () => {
    const plan = makePlan([g('G'), t('A', ['does-not-exist'])]);
    expect(validateGraph(plan).some((i) => i.code === 'MISSING_DEPENDENCY')).toBe(true);
  });

  it('flags a cycle with the node names in the message', () => {
    const plan = makePlan([g('G'), t('A', ['B']), t('B', ['A'])]);
    const cycleIssue = validateGraph(plan).find((i) => i.code === 'CYCLE');
    expect(cycleIssue).toBeDefined();
    expect(cycleIssue!.message).toMatch(/→/);
  });

  it('warns about orphans without blocking simulation', () => {
    const plan = makePlan([g('G'), t('A', ['G']), t('LOOSE')]);
    const issues = validateGraph(plan);
    expect(issues.some((i) => i.code === 'ORPHANED' && i.nodeIds.includes('LOOSE'))).toBe(true);
    expect(hasBlockingIssue(issues)).toBe(false);
  });

  it('flags duplicate ids', () => {
    const plan = makePlan([g('G'), t('A', ['G']), t('A', ['G'])]);
    expect(validateGraph(plan).some((i) => i.code === 'DUPLICATE_ID')).toBe(true);
  });
});
