/**
 * Every starter template must be a plan the engine fully approves of: valid
 * graph, schedule inside the horizon, and objectives the simulation actually
 * satisfies with no critical violations. A template that opens with red
 * warnings would teach a new user that the tool is broken.
 */

import { describe, expect, it } from 'vitest';
import { validateGraph, hasBlockingIssue } from '../graph';
import { computeSchedule } from '../schedule';
import { simulate } from '../simulate';
import { PLAN_TEMPLATES, buildTemplatePlan, type TemplateId } from '../templates';
import { isObjective, isTask } from '../types';

const TEMPLATE_IDS = PLAN_TEMPLATES.map((t) => t.id);

describe('starter templates', () => {
  it('registry covers every id exactly once', () => {
    expect(new Set(TEMPLATE_IDS).size).toBe(TEMPLATE_IDS.length);
    expect(TEMPLATE_IDS).toContain('blank');
  });

  describe.each(TEMPLATE_IDS.map((id) => [id] as [TemplateId]))('%s', (id) => {
    const plan = buildTemplatePlan(id);

    it('builds a structurally valid plan', () => {
      expect(plan.version).toBeGreaterThan(0);
      expect(plan.nodes.length).toBeGreaterThan(0);

      const ids = plan.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);

      const issues = validateGraph(plan);
      expect(hasBlockingIssue(issues)).toBe(false);
    });

    it('gives every task the two numbers the analysis runs on', () => {
      for (const task of plan.nodes.filter(isTask)) {
        expect(task.durationMonths).toBeGreaterThanOrEqual(1);
        expect(task.hoursPerDayWhileActive).toBeGreaterThanOrEqual(0);
      }
    });

    it('schedules inside its own horizon', () => {
      const schedule = computeSchedule(plan);
      expect(schedule.projectFinish).toBeLessThanOrEqual(plan.horizonMonths);
    });

    it('satisfies its objectives in simulation, without critical violations', () => {
      const result = simulate(plan);

      const objectives = plan.nodes.filter(isObjective);
      expect(result.objectives.length).toBe(objectives.length);
      for (const outcome of result.objectives) {
        expect(outcome.satisfiedMonth, `objective "${outcome.name}" never satisfied`).not.toBeNull();
        if (outcome.deadlineMonth > 0) {
          expect(outcome.lateBy, `objective "${outcome.name}" is late`).toBe(0);
        }
      }

      const critical = result.violations.filter((v) => v.severity === 'critical');
      expect(critical, JSON.stringify(critical.slice(0, 3))).toEqual([]);
    });

    it('produces a fresh identity on every build', () => {
      const again = buildTemplatePlan(id);
      expect(again.id).not.toBe(plan.id);
    });
  });
});
