---
id: runtime
sidebar_position: 4
title: "@ddse/acm-runtime"
---

`@ddse/acm-runtime` executes ACM plans deterministically with guard evaluation, policy checks, verification, streaming, and resumable checkpoints.

## Installation

```bash
pnpm add @ddse/acm-runtime @ddse/acm-sdk
```

## Basic execution

```typescript
import {executePlan, MemoryLedger} from '@ddse/acm-runtime';

const ledger = new MemoryLedger();
const result = await executePlan({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  policy: policyEngine,
  verify: verifyFn,
  stream: streamSink,
  ledger
});
```

`result.outputsByTask` contains task narratives, outputs, and success criteria status for downstream processing.

## Resumable executor

```typescript
import {executeResumablePlan, FileCheckpointStore} from '@ddse/acm-runtime';

const result = await executeResumablePlan({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  checkpointStore: new FileCheckpointStore('./checkpoints'),
  runId: 'refund-2024-10-05',
  checkpointInterval: 1
});
```

Resume the run later:

```typescript
await executeResumablePlan({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  checkpointStore: new FileCheckpointStore('./checkpoints'),
  resumeFrom: 'checkpoint-0002',
  runId: 'refund-2024-10-05'
});
```

## Policy & verification hooks

- Implement `PolicyEngine` to enforce guardrails (budget, PII, risk levels).
- Provide a verification function to validate planner-specified expressions after task completion.

```typescript
const verify = async (taskId: string, output: any, expressions: string[]) => {
  return expressions.every((expr) => {
    const fn = new Function('output', `return ${expr};`);
    return Boolean(fn(output));
  });
};
```

## Streaming

Use `DefaultStreamSink` to feed UI experiences or logs.

```typescript
stream.attach('task', (update) => console.log(`[${update.taskId}]`, update.status));
```

## Ledger utilities

- `MemoryLedger` — Append-only log used by default when no ledger is supplied.
- Integrate with observability by forwarding ledger entries to your telemetry pipeline.

## Replay bundles

Pair the runtime with `@ddse/acm-replay` to export bundles for audits and regression tests. See [Replay utilities](./replay.md).

## References

- Package [README](https://github.com/ddse-foundation/acm/blob/main/framework/node/packages/acm-runtime/README.md)
- [Core Concepts → Runtime](../core-concepts/runtime.md)
- [Governance → Resumable execution](../governance/resumable.md)
