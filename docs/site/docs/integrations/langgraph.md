---
id: langgraph
sidebar_position: 2
title: LangGraph Integration
---

Use the LangGraph adapter when you want to embed ACM tasks inside existing LangGraph flows while retaining deterministic guards and ledger capture.

## Setup

```bash
pnpm add @ddse/acm-adapters @langchain/langgraph
```

## Wrap ACM plan in LangGraph

```typescript
import {asLangGraph} from '@ddse/acm-adapters';

const acmGraph = asLangGraph({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  ledger,
  policy: policyEngine,
  stream: streamSink
});

const result = await acmGraph.execute();
```

### Tips

- Provide a `MemoryLedger` to capture adapter events and forward them to LangGraph monitoring.
- Use guards inside the plan rather than LangGraph branching to ensure replay bundles remain truthful.
- When you need resumability, run the plan with the native ACM runtime before invoking LangGraph-specific post-processing.

## Combining with other LangGraph nodes

1. Execute ACM plan to obtain deterministic outputs and ledger.
2. Feed outputs into existing LangGraph nodes (e.g., summarisation, user prompts).
3. Optionally append ledger metadata to downstream logs for a unified timeline.

## Limitations

- Checkpoint/resume is not available through the adapter (use the ACM runtime directly when required).
- Streamed updates follow LangGraph conventions; adjust listeners accordingly.

## References

- Adapter [README](https://github.com/ddse-foundation/acm/blob/main/framework/node/packages/acm-adapters/README.md)
- [Packages → @ddse/acm-adapters](../packages/adapters.md)
