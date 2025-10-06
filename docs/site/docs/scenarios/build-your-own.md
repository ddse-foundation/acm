---
id: build-your-own
sidebar_position: 2
title: Build Your Own Scenario
---

Use the recipe below to create a deterministic workflow tailored to your organisation while preserving ACM guarantees.

## 1. Shape the goal & context

- Capture the primary objective (`Goal.intent`).
- Identify required facts and assemble a context packet (`Context.facts`).
- Decide which MCP servers or internal services can enrich context.

## 2. Model capabilities & tasks

1. Sketch the ideal task graph.
2. For each step, define:
   - Capability name and schema
   - Input/output contracts
   - Retry policy and guard requirements
   - Verification expressions (what must be true afterwards)
3. Implement the task with `Task<I, O>` and register it with `CapabilityRegistry`.

## 3. Implement tools

Wrap integrations in `Tool<I, O>` subclasses:

- External APIs (CRM, payments, ticketing)
- Internal services (policy engines, risk models)
- MCP servers (filesystem, GitHub, knowledge search)

## 4. Register policies & verification

- Build a `PolicyEngine` that inspects risk metrics, budgets, or user roles.
- Implement `verification()` methods or a global verification callback to validate outputs.

## 5. Define a reference plan

Provide a deterministic reference plan alongside the scenario so integration tests can run without an LLM.

```typescript
scenario.buildReferencePlan = () => ({
  plans: [planA, planB],
  selectedPlanId: 'plan-a'
});
```

## 6. Write integration tests

Leverage the example test harness:

```typescript
it('runs my scenario deterministically', async () => {
  const summary = await scenario.run({
    provider: 'stub',
    checkpointDir: tmpDir
  });
  expect(summary.ledgerEntries).toBeGreaterThan(0);
});
```

## 7. Expose CLI flags

Extend `packages/acm-examples/bin/acm-demo.ts` to add scenario-specific options (e.g., `--region`, `--budget`).

## 8. Publish replay bundles

Export bundles for QA and auditors:

```bash
pnpm --filter @ddse/acm-examples demo -- --scenario my-scenario --save-bundle
```

## Checklist

- [ ] Capability map covers every task
- [ ] Guard expressions documented and tested
- [ ] Policy decisions logged with clear reasons
- [ ] Replay bundles generated during CI
- [ ] MCP dependencies documented (tokens, servers, budgets)

## Next steps

- Review governance requirements in [Policies & Verification](../governance/policy-checks.md).
- Follow the [Integrations guides](../integrations/overview.md) to connect external systems.
