---
id: planning
sidebar_position: 2
title: Structured Planning
---

The ACM planner generates structured plans using LLM tool-calls but protects you from nondeterminism through deterministic fallbacks and rich telemetry.

## Planner flow

1. Normalise the goal and context packet.
2. Hash the context to a `contextRef`.
3. Present capabilities and guard grammar to the LLM.
4. Request Plan-A and Plan-B in JSON format with rationale.
5. Validate responses against the schema.
6. Emit fallback plans when responses cannot be parsed.
7. Stream tool-call telemetry and rationale into the ledger.

## Example usage

```typescript
import {StructuredLLMPlanner} from '@ddse/acm-planner';
import {createVLLMClient} from '@ddse/acm-llm';

const planner = new StructuredLLMPlanner({ planCount: 2 });
const llm = createVLLMClient('Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8', 'http://localhost:8001/v1');

const {plans, rationale, contextRef} = await planner.plan({
  goal,
  context,
  capabilities: capabilityRegistry.list(),
  llm
});
```

## Plan anatomy

| Field | Description |
| ----- | ----------- |
| `id` | `plan-a`, `plan-b`, or `plan-fallback` |
| `contextRef` | SHA-256 hash of the normalised context packet |
| `capabilityMapVersion` | Semantic version of your capability map |
| `tasks[]` | Nodes in the DAG, each pointing to a capability |
| `edges[]` | Precedence relationships with optional guards |
| `rationale` | Free-form explanation from the LLM |
| `alternatives[]` | Optional references to alternative plans |

### Guard expressions

Guards are evaluated by the runtime with access to:

- `context` — Context packet facts (`context.customerTier`)
- `outputs` — Task outputs keyed by task id (`outputs.t1.score`)
- `policy` — Policy decisions (`policy.t2.allow`)

Example:

```javascript
outputs['lookup-customer'].riskTier !== 'HIGH' && context.region === 'EU'
```

## Choosing a plan

Use the planner selector to enforce deterministic decision policies:

```typescript
const planner = new StructuredLLMPlanner({
  selector: ({ plans }) => plans.find((plan) => plan.id === 'plan-a') ?? plans[0]
});
```

You can also reuse an existing plan when resuming execution:

```typescript
const plannerResult = await planner.plan(...);
await framework.execute({
  goal,
  context,
  existingPlan: plannerResult,
  engine: ExecutionEngine.ACM
});
```

## Telemetry

The planner emits `PLANNER_SUMMARY` ledger entries containing:

- Number of plans generated
- Rationale text
- Plan IDs and capability counts
- Hash of the context packet

This data feeds replay bundles and audit dashboards.

## Best practices

- Version your capability map and include the version in planner options.
- Log planner outputs centrally so you can diff plans across runs.
- Combine Plan-A/Plan-B with policy hints to favour safe alternatives.
- Use `planCount` to explore more diverse strategies (e.g., 3+ options) when budgets allow.

## Next steps

- Execute plans with the [runtime](./runtime.md).
- Use plans inside orchestrators via the [framework helper](../packages/framework.md).
- Export plans inside [replay bundles](../governance/replay-bundles.md).
