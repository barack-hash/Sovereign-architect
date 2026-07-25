import { describe, expect, it } from 'vitest';
import { computeSchedule, criticalPathTo, activeMonths } from '../schedule';
import { g, o, t, makePlan } from './helpers';

/**
 * The reference network used across these tests:
 *
 *        ┌── A (3mo) ──┐
 *   G ───┤             ├── C (2mo) ── OBJ
 *        └── B (1mo) ──┘
 *
 * A is three months of work feeding a join that B reaches in one, so B carries
 * two months of slack and A does not. The critical path is G → A → C → OBJ and
 * the project finishes at month 5.
 */
function diamond() {
  return makePlan([
    g('G'),
    t('A', ['G'], { durationMonths: 3 }),
    t('B', ['G'], { durationMonths: 1 }),
    t('C', ['A', 'B'], { durationMonths: 2 }),
    o('OBJ', ['C']),
  ]);
}

describe('forward pass', () => {
  it('starts a task only once every prerequisite has finished', () => {
    const s = computeSchedule(diamond());
    expect(s.nodes.get('A')!.earlyStart).toBe(0);
    expect(s.nodes.get('A')!.earlyFinish).toBe(3);
    expect(s.nodes.get('B')!.earlyFinish).toBe(1);
    // C waits for the slower of its two inputs, not the faster.
    expect(s.nodes.get('C')!.earlyStart).toBe(3);
    expect(s.nodes.get('C')!.earlyFinish).toBe(5);
  });

  it('sets the project finish to the last early finish', () => {
    expect(computeSchedule(diamond()).projectFinish).toBe(5);
  });

  it('honours earliestStartMonth even when prerequisites are ready', () => {
    const plan = makePlan([g('G'), t('A', ['G'], { durationMonths: 2, earliestStartMonth: 4 })]);
    const s = computeSchedule(plan);
    expect(s.nodes.get('A')!.earlyStart).toBe(4);
    expect(s.nodes.get('A')!.earlyFinish).toBe(6);
  });

  it('treats objectives as zero-duration milestones', () => {
    const s = computeSchedule(diamond());
    const obj = s.nodes.get('OBJ')!;
    expect(obj.durationMonths).toBe(0);
    expect(obj.earlyStart).toBe(obj.earlyFinish);
  });
});

describe('backward pass and slack', () => {
  it('gives zero total slack to tasks on the critical path', () => {
    const s = computeSchedule(diamond());
    expect(s.nodes.get('A')!.totalSlack).toBe(0);
    expect(s.nodes.get('C')!.totalSlack).toBe(0);
  });

  it('gives the shorter parallel branch real slack', () => {
    const s = computeSchedule(diamond());
    // B finishes at 1 but is not needed until 3.
    expect(s.nodes.get('B')!.totalSlack).toBe(2);
    expect(s.nodes.get('B')!.isCritical).toBe(false);
  });

  it('computes free slack against the earliest successor start', () => {
    const s = computeSchedule(diamond());
    expect(s.nodes.get('B')!.freeSlack).toBe(2);
    expect(s.nodes.get('A')!.freeSlack).toBe(0);
  });

  it('produces negative slack when a deadline cannot be met', () => {
    // A needs 5 months but must be done by month 3.
    const plan = makePlan([g('G'), t('A', ['G'], { durationMonths: 5, deadlineMonth: 3 })]);
    const s = computeSchedule(plan);
    expect(s.nodes.get('A')!.totalSlack).toBeLessThan(0);
    expect(s.nodes.get('A')!.missesDeadlineBy).toBe(2);
    expect(s.infeasible.map((n) => n.id)).toContain('A');
  });
});

describe('critical path tracing', () => {
  it('returns the chain that sets the project end', () => {
    const s = computeSchedule(diamond());
    expect(s.criticalPath).toEqual(['G', 'A', 'C', 'OBJ']);
  });

  it('excludes the slack branch from the critical set', () => {
    const s = computeSchedule(diamond());
    expect(s.criticalNodeIds.has('A')).toBe(true);
    expect(s.criticalNodeIds.has('B')).toBe(false);
  });

  it('marks the edges along the critical chain', () => {
    const s = computeSchedule(diamond());
    expect(s.criticalEdgeIds.has('A->C')).toBe(true);
    expect(s.criticalEdgeIds.has('B->C')).toBe(false);
  });

  it('shifts the critical path when a branch grows longer', () => {
    // Make B the long pole instead of A.
    const plan = makePlan([
      g('G'),
      t('A', ['G'], { durationMonths: 1 }),
      t('B', ['G'], { durationMonths: 6 }),
      t('C', ['A', 'B'], { durationMonths: 2 }),
      o('OBJ', ['C']),
    ]);
    const s = computeSchedule(plan);
    expect(s.criticalPath).toEqual(['G', 'B', 'C', 'OBJ']);
    expect(s.nodes.get('A')!.totalSlack).toBe(5);
  });
});

describe('criticalPathTo', () => {
  it('reports the longest chain to a specific objective and its length', () => {
    const { path, months } = criticalPathTo(diamond(), 'OBJ');
    expect(path).toEqual(['G', 'A', 'C', 'OBJ']);
    expect(months).toBe(5);
  });

  it('returns an empty path for an unreachable objective', () => {
    const plan = makePlan([g('G'), t('A', ['G']), o('LOOSE')]);
    expect(criticalPathTo(plan, 'LOOSE').path).toEqual([]);
  });
});

describe('robustness', () => {
  it('degrades to an empty schedule when the cycle is reachable, rather than hanging', () => {
    // A depends on both G and B, and B depends on A, so the loop sits inside
    // the simulated scope and there is no valid ordering to produce.
    const plan = makePlan([g('G'), t('A', ['G', 'B']), t('B', ['A'])]);
    const s = computeSchedule(plan);
    expect(s.nodes.size).toBe(0);
    expect(s.criticalPath).toEqual([]);
  });

  it('ignores a cycle that is disconnected from Genesis', () => {
    // Broken nodes off to the side must not stop the rest of the plan from
    // scheduling; validateGraph is what surfaces them to the user.
    const plan = makePlan([g('G'), t('LIVE', ['G']), t('A', ['B']), t('B', ['A'])]);
    const s = computeSchedule(plan);
    expect([...s.nodes.keys()].sort()).toEqual(['G', 'LIVE']);
  });

  it('degrades to an empty schedule with no Genesis', () => {
    expect(computeSchedule(makePlan([t('A')])).nodes.size).toBe(0);
  });

  it('flags work that cannot finish inside the horizon', () => {
    const plan = makePlan([g('G'), t('A', ['G'], { durationMonths: 40 })], { horizonMonths: 12 });
    expect(computeSchedule(plan).nodes.get('A')!.beyondHorizon).toBe(true);
  });
});

describe('activeMonths', () => {
  it('lists the calendar months a task occupies', () => {
    const s = computeSchedule(diamond());
    // A starts at elapsed 0 for 3 months, so it occupies months 1, 2, 3.
    expect(activeMonths(s.nodes.get('A')!)).toEqual([1, 2, 3]);
    // C starts at elapsed 3 for 2 months, so months 4 and 5.
    expect(activeMonths(s.nodes.get('C')!)).toEqual([4, 5]);
  });

  it('returns nothing for a milestone', () => {
    expect(activeMonths(computeSchedule(diamond()).nodes.get('OBJ')!)).toEqual([]);
  });
});
