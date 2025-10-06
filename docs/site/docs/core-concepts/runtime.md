---
id: runtime
sidebar_position: 3
title: Deterministic Runtime & Resumable Execution
---

The ACM runtime executes plans with deterministic semantics, guard evaluation, policy enforcement, and resumable checkpoints. It is the heart of the "Execute" pillar.

## Execution modes

### `executePlan`

Use when you only need in-memory execution without checkpoints.

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
  verify: verificationFn,
  stream: streamSink,
  ledger
});
```

### `executeResumablePlan`

Persists checkpoints after each task so runs can resume after interruptions.

```typescript
import {executeResumablePlan, FileCheckpointStore} from '@ddse/acm-runtime';

const checkpointStore = new FileCheckpointStore('./checkpoints');

const result = await executeResumablePlan({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  checkpointStore,
  checkpointInterval: 1, // after every task
  runId: 'refund-2024-10-05'
});
```

Resume the run without replanning:

```typescript
await executeResumablePlan({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  checkpointStore,
  resumeFrom: 'checkpoint-0003',
  runId: 'refund-2024-10-05'
});
```

## Policies and verification

- **Policy engine** — Decide whether a task may execute (`allow: false` blocks execution and records an audit entry).
- **Verification hooks** — Evaluate expressions supplied by the planner to double check task outputs (`output.total >= context.minTotal`).

Both callbacks stream information into the ledger.

## Streaming

Attach an `DefaultStreamSink` to surface planner tokens, task status, and checkpoint notifications to CLI or UI experiences.

```typescript
stream.attach('task', update => console.log(update));
stream.attach('planner', chunk => process.stdout.write(chunk.delta ?? ''));
```

## Checkpoint stores

| Store | Description | Usage |
| ----- | ----------- | ----- |
| `MemoryCheckpointStore` | In-memory; best for tests | Default when nothing is configured |
| `FileCheckpointStore` | Persists checkpoints to disk | Provide a directory path |
| Custom store | Implement the `CheckpointStore` interface | Persist to S3, Redis, etc. |

Each checkpoint includes:

- Goal + context snapshot
- Plan metadata
- Completed task outputs
- Ledger entries up to the checkpoint

## Ledger entries

The runtime appends entries such as `TASK_START`, `TASK_END`, `GUARD_EVAL`, `POLICY_PRE`, and `VERIFICATION`. Replay bundles serialise the ledger so you can diff runs and diagnose issues offline.

## Error handling

- Retries use `withRetry` with fixed or exponential backoff.
- Compensation tasks can be invoked when guards fail or outputs violate policies.
- Errors are raised with rich context so operators can diagnose issues quickly.

## Best practices

- Always supply a `runId` when using checkpoints to group runs logically.
- Export replay bundles after successful runs to support audits.
- Use policy engines to enforce budget limits, PII access control, and tool allowlists.
- Record ledger entries in a central storage system when running in production.

## Next steps

- Inspect replay data flow in [Governance → Replay bundles](../governance/replay-bundles.md).
- Explore the [Scenario Playbook](../scenarios/examples.md) to see the runtime in action.
- Integrate the runtime via the [framework helper](../packages/framework.md) for reduced boilerplate.
