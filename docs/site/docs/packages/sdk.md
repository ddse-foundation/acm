---
id: sdk
sidebar_position: 1
title: "@ddse/acm-sdk"
---

`@ddse/acm-sdk` provides the foundational contracts and helper classes used across the ACM stack. It is intentionally lightweight and has no runtime dependencies.

## Installation

```bash
pnpm add @ddse/acm-sdk
```

## Key exports

| Export | Purpose |
| ------ | ------- |
| `Tool<I, O>` | Base class for invoking external systems |
| `Task<I, O>` | Base class for deterministic task execution |
| `CapabilityRegistry` | Registers capabilities mapped to tasks |
| `ToolRegistry` | Registers tools available to the runtime |
| `PolicyEngine` | Interface for allow/deny decisions |
| `DefaultStreamSink` | Emits planner and task events to listeners |
| `Goal`, `Context`, `Plan`, `LedgerEntry` | Typed artifacts representing ACM contracts |

## Example: tool + task trio

```typescript
import {Tool, Task, type RunContext} from '@ddse/acm-sdk';

class SearchTool extends Tool<{ query: string }, { results: string[] }> {
  name() {
    return 'search';
  }

  async call(input: { query: string }) {
    return { results: await runSearch(input.query) };
  }
}

class SummariseTask extends Task<{ query: string }, { summary: string }> {
  constructor() {
    super('summarise', 'knowledge.summarise');
  }

  async execute(ctx: RunContext, input: { query: string }) {
    const { results } = await ctx.getTool('search')!.call({ query: input.query });
    return { summary: summarise(results) };
  }
}
```

Register these implementations with your capability and tool registries, then share the registries with the planner and runtime.

## Idempotency & verification

Override `idemKey`, `policyInput`, and `verification` to enrich resilience and governance:

```typescript
class ApproveRefundTask extends Task<{ amount: number }, { approved: boolean }> {
  constructor() {
    super('approve-refund', 'refund.approve');
  }

  idemKey(_, input) {
    return `refund:${input.amount}`;
  }

  policyInput(ctx, input) {
    return { amount: input.amount, userId: ctx.context.facts.agentId };
  }

  verification() {
    return ['output.approved === true'];
  }
}
```

## Stream sink

Attach listeners to the `DefaultStreamSink` for CLI or UI rendering:

```typescript
const stream = new DefaultStreamSink();
stream.attach('planner', (chunk) => process.stdout.write(chunk.delta ?? ''));
stream.attach('task', (update) => console.log(update));
```

## More resources

- Package [README](https://github.com/ddse-foundation/acm/blob/main/framework/node/packages/acm-sdk/README.md)
- [Core Concepts](../core-concepts/introduction.md)
