import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { listScenarioKeys, scenarios } from '../src/examples/scenarios.js';

describe('scenario reference plans', () => {
  for (const key of listScenarioKeys()) {
    const scenario = scenarios[key];

    it(`produces deterministic reference plan for ${scenario.name}`, async () => {
      const reference = await scenario.buildReferencePlan();
      const plan = reference.plan;

      assert.ok(plan, 'Expected a plan to be returned');
      assert.ok(Array.isArray(plan.tasks) && plan.tasks.length > 0, 'Plan must include at least one task');

      for (const task of plan.tasks ?? []) {
        assert.ok(task.id, 'Task must include a stable id');
        assert.ok(task.capability ?? task.capabilityRef, 'Task must include a capability reference');
        assert.ok(task.input && Object.keys(task.input).length > 0, 'Task must include deterministic input');
      }

      if (Array.isArray(plan.edges)) {
        for (const edge of plan.edges) {
          const fromExists = plan.tasks?.some(task => task.id === edge.from);
          const toExists = plan.tasks?.some(task => task.id === edge.to);
          assert.ok(fromExists, `Edge from ${edge.from} must reference an existing task`);
          assert.ok(toExists, `Edge to ${edge.to} must reference an existing task`);
        }
      }
    });
  }
});
