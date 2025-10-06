---
id: adapters
sidebar_position: 7
title: "@ddse/acm-adapters"
---

`@ddse/acm-adapters` bridges ACM runtime semantics into popular orchestrators such as LangGraph and Microsoft Agent Framework (MSAF).

## Installation

```bash
pnpm add @ddse/acm-adapters @ddse/acm-sdk @ddse/acm-runtime
```

## LangGraph adapter

```typescript
import {asLangGraph} from '@ddse/acm-adapters';

const adapter = asLangGraph({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  ledger,
  policy: policyEngine,
  stream: streamSink
});

const result = await adapter.execute();
```

The adapter maps plan tasks to LangGraph nodes while preserving guard evaluation and ledger emission.

## Microsoft Agent Framework adapter

```typescript
import {wrapAgentNodes} from '@ddse/acm-adapters';

const msafAdapter = wrapAgentNodes({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  ledger,
  policy: policyEngine
});

await msafAdapter.execute();
```

## Limitations

- Adapter engines currently **do not** support checkpoint/resume. Use the native ACM runtime when you need resumability.
- Tool streaming is available, but guard failures are surfaced via adapter-specific error channels.

## When to reach for adapters

- You already orchestrate flows in LangGraph or MSAF and want ACM guarantees without rewriting everything.
- You need to embed ACM plans into heterogeneous agent stacks while preserving ledger and policy semantics.

## References

- [Integrations → LangGraph](../integrations/langgraph.md)
- [Integrations → Microsoft Agent Framework](../integrations/msaf.md)
- Package [README](https://github.com/ddse-foundation/acm/blob/main/framework/node/packages/acm-adapters/README.md)
