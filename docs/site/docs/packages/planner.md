---
id: planner
sidebar_position: 3
title: "@ddse/acm-planner"
---

`@ddse/acm-planner` turns goals, context packets, and capability maps into structured plans that comply with ACM v0.5.0.

## Installation

```bash
pnpm add @ddse/acm-planner @ddse/acm-llm @ddse/acm-sdk
```

## Structured planning loop

1. Normalise goal/context and compute `contextRef` (SHA-256).
2. Prompt the LLM with capability names and guard grammar.
3. Request Plan-A and Plan-B in JSON.
4. Validate JSON schema; fallback to a safe linear plan if parsing fails.
5. Emit telemetry and rationale to the ledger.

## Usage

```typescript
import {StructuredLLMPlanner} from '@ddse/acm-planner';
import {createVLLMClient} from '@ddse/acm-llm';

const planner = new StructuredLLMPlanner({ planCount: 2 });
const llm = createVLLMClient('Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8', 'http://localhost:8001/v1');

const result = await planner.plan({
  goal,
  context,
  capabilities: capabilityRegistry.list(),
  llm,
  capabilityMapVersion: 'v0.5.0'
});
```

Inspect plans and their rationale:

```typescript
result.plans.forEach((plan) => {
  console.log(plan.id, plan.tasks.length, plan.rationale);
});
```

## Telemetry

- `plans.length` — Typically 2 (Plan-A and Plan-B)
- `contextRef` — Bind plan to context
- `rationale` — Planner justification
- `alternatives` — Cross references to other plans in the set

## Safe fallback

When the LLM output cannot be parsed, the planner emits `plan-fallback`, a linear plan containing only safe, preconfigured steps. This keeps systems running while signalling that operator attention is required.

## Custom selectors

Choose which plan to execute:

```typescript
const planner = new StructuredLLMPlanner({
  planCount: 3,
  selector: ({ plans }) => plans.find((plan) => plan.id === 'plan-b') ?? plans[0]
});
```

## Streaming tokens

Attach a stream sink to surface reasoning in real time:

```typescript
stream.attach('planner', (chunk) => {
  if (chunk.delta) process.stdout.write(chunk.delta);
});
```

## References

- Package [README](https://github.com/ddse-foundation/acm/blob/main/framework/node/packages/acm-planner/README.md)
- [Core Concepts → Structured Planning](../core-concepts/planning.md)
- [Governance → Policies](../governance/policy-checks.md) for guard and verification strategies
