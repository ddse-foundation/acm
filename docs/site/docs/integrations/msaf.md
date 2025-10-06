---
id: msaf
sidebar_position: 3
title: Microsoft Agent Framework Integration
---

Embed ACM contracts into Microsoft Agent Framework (MSAF) while preserving deterministic execution and governance.

## Setup

```bash
pnpm add @ddse/acm-adapters @microsoft/agents
```

## Wrap ACM plan

```typescript
import {wrapAgentNodes} from '@ddse/acm-adapters';

const wrapped = wrapAgentNodes({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  ledger,
  policy: policyEngine
});

await wrapped.execute();
```

## Best practices

- Use ACM tasks to interact with side-effectful systems; keep MSAF orchestrators thin.
- Export replay bundles after MSAF runs to provide compliance evidence.
- Propagate ledger IDs through MSAF telemetry for correlation with other services.

## Limitations

- Resumable execution currently requires running the ACM runtime directly. Use adapters for non-resumable flows or wrap runtime results inside MSAF once execution completes.
- Streaming events follow MSAF’s observable interfaces; adapt UI components accordingly.

## References

- Adapter [README](https://github.com/ddse-foundation/acm/blob/main/framework/node/packages/acm-adapters/README.md)
- [Packages → Adapters](../packages/adapters.md)
