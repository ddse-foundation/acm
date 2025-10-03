# @acm/runtime

ACM v0.5 execution engine with guards, retries, policy hooks, and memory ledger.

## Overview

The runtime package provides deterministic plan execution with full ACM v0.5 semantics including guard evaluation, retry logic, policy enforcement, verification, and decision logging.

## Installation

```bash
pnpm add @acm/runtime @acm/sdk
```

## Features

- ✅ Task graph execution with topological ordering
- ✅ Guard expression evaluation
- ✅ Configurable retry with exponential backoff
- ✅ Policy pre/post hooks
- ✅ Verification assertions
- ✅ Memory ledger (append-only decision log)
- ✅ Streaming progress updates
- ✅ Error handling and compensation
- ✅ **Resumable execution with checkpointing** (NEW in Phase 2)

## Usage

### Basic Execution

```typescript
import { executePlan, MemoryLedger } from '@acm/runtime';
import type { Goal, Context, Plan } from '@acm/sdk';

const result = await executePlan({
  goal: { id: 'g1', intent: 'Process order' },
  context: { id: 'ctx1', facts: { orderId: 'O123' } },
  plan: myPlan,
  capabilityRegistry: myCapabilities,
  toolRegistry: myTools,
});

console.log('Outputs:', result.outputsByTask);
console.log('Ledger entries:', result.ledger.length);
```

### With Policy Enforcement

```typescript
import { PolicyEngine, type PolicyDecision } from '@acm/sdk';

class MyPolicyEngine implements PolicyEngine {
  async evaluate(action: string, payload: any): Promise<PolicyDecision> {
    if (action === 'task.pre' && payload.riskLevel === 'HIGH') {
      return { allow: false, reason: 'Risk too high' };
    }
    return { allow: true };
  }
}

const result = await executePlan({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  policy: new MyPolicyEngine(),
});
```

### With Verification

```typescript
const verify = async (taskId: string, output: any, expressions: string[]): Promise<boolean> => {
  for (const expr of expressions) {
    const func = new Function('output', `return ${expr};`);
    if (!func(output)) {
      console.error(`Verification failed: ${expr}`);
      return false;
    }
  }
  return true;
};

const result = await executePlan({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  verify,
});
```

### With Streaming

```typescript
import { DefaultStreamSink } from '@acm/sdk';

const stream = new DefaultStreamSink();

stream.attach('task', (update) => {
  console.log(`[${update.taskId}] ${update.status}`);
});

const result = await executePlan({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  stream,
});
```

### Memory Ledger

```typescript
import { MemoryLedger } from '@acm/runtime';

const ledger = new MemoryLedger();

const result = await executePlan({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  ledger,
});

// Inspect decisions
for (const entry of ledger.getEntries()) {
  console.log(`${entry.type} at ${entry.ts}:`, entry.details);
}
```

### Resumable Execution (Phase 2)

Execute plans with automatic checkpointing and resume support:

```typescript
import { executeResumablePlan, FileCheckpointStore } from '@acm/runtime';

// Setup checkpoint storage
const checkpointStore = new FileCheckpointStore('./checkpoints');
const runId = 'my-run-123';

// Execute with checkpointing
const result = await executeResumablePlan({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  runId,
  checkpointStore,
  checkpointInterval: 1, // Checkpoint after each task
});
```

Resume from a previous execution:

```typescript
// Resume from checkpoint
const result = await executeResumablePlan({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  runId: 'my-run-123',
  resumeFrom: 'checkpoint-xyz', // Resume from specific checkpoint
  checkpointStore,
});
```

Using the ResumableExecutor class:

```typescript
import { ResumableExecutor, FileCheckpointStore } from '@acm/runtime';

const executor = new ResumableExecutor(
  new FileCheckpointStore('./checkpoints')
);

// Execute with checkpointing
const result = await executor.execute({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  runId: 'my-run-123',
});

// List checkpoints
const checkpoints = await executor.listCheckpoints('my-run-123');
console.log(`Available checkpoints: ${checkpoints.length}`);

// Resume from latest checkpoint
const latest = await executor.getCheckpoint('my-run-123');
const resumed = await executor.execute({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  runId: 'my-run-123',
  resumeFrom: latest?.id,
});
```

## API Reference

### executePlan(options)

Execute a plan with full ACM v0.5 semantics.

**Options:**
- `goal: Goal` - The goal being pursued
- `context: Context` - Immutable context packet
- `plan: Plan` - The plan to execute
- `capabilityRegistry: CapabilityRegistry` - Task registry
- `toolRegistry: ToolRegistry` - Tool registry
- `policy?: PolicyEngine` - Optional policy enforcement
- `verify?: (taskId, output, expressions) => Promise<boolean>` - Optional verification
- `stream?: StreamSink` - Optional streaming sink
- `ledger?: MemoryLedger` - Optional ledger (created if not provided)

**Returns:**
```typescript
{
  outputsByTask: Record<string, any>;
  ledger: readonly LedgerEntry[];
}
```

### evaluateGuard(expr, context)

Evaluate a guard expression.

**Parameters:**
- `expr: string` - JavaScript boolean expression
- `context: { context, outputs, policy }` - Evaluation context

**Returns:** `boolean`

### withRetry(fn, config)

Execute a function with retry logic.

**Parameters:**
- `fn: () => Promise<T>` - Function to retry
- `config: { attempts, backoff, baseMs?, jitter? }` - Retry configuration

**Returns:** `Promise<T>`

### MemoryLedger

Append-only decision log.

**Methods:**
- `append(type, details)` - Add entry
- `getEntries()` - Get all entries
- `clear()` - Clear ledger (for testing)

### executeResumablePlan(options)

Execute a plan with checkpoint and resume support.

**Additional Options (extends executePlan):**
- `runId?: string` - Unique run identifier (generated if not provided)
- `checkpointStore?: CheckpointStore` - Storage backend (default: MemoryCheckpointStore)
- `checkpointInterval?: number` - Checkpoint after N tasks (default: 1)
- `resumeFrom?: string` - Checkpoint ID to resume from

**Returns:** Same as `executePlan`

### CheckpointStore

Interface for checkpoint storage backends.

**Implementations:**
- `MemoryCheckpointStore` - In-memory storage (for testing)
- `FileCheckpointStore(basePath)` - File-based storage

**Methods:**
- `put(runId, checkpoint)` - Store a checkpoint
- `get(runId, checkpointId?)` - Retrieve checkpoint (latest if no ID)
- `list(runId)` - List all checkpoints for a run
- `prune(runId, keepLast)` - Remove old checkpoints

### ResumableExecutor

High-level class for managing resumable executions.

**Constructor:**
- `new ResumableExecutor(checkpointStore?)` - Create executor with optional store

**Methods:**
- `execute(options)` - Execute with checkpointing
- `listCheckpoints(runId)` - List available checkpoints
- `getCheckpoint(runId, checkpointId?)` - Get specific checkpoint
- `pruneCheckpoints(runId, keepLast)` - Clean up old checkpoints

## Guard Expressions

Guards are JavaScript boolean expressions evaluated with:
- `context`: The Context Packet facts
- `outputs`: Task outputs so far
- `policy`: Policy decisions

Examples:
```javascript
// Simple fact check
'context.region === "EU"'

// Output dependency
'outputs.t1.riskTier !== "HIGH"'

// Policy check
'policy.t1.allow === true'

// Combined
'context.amount > 100 && outputs.t2.approved === true'
```

## Retry Configuration

```typescript
{
  attempts: 3,
  backoff: 'exp',  // or 'fixed'
  baseMs: 1000,
  jitter: true
}
```

Backoff strategies:
- **fixed**: Always wait `baseMs`
- **exp**: Wait `baseMs * 2^attempt`
- **jitter**: Add random variation (50-100% of delay)

## Ledger Entry Types

- `PLAN_SELECTED` - Plan chosen for execution
- `GUARD_EVAL` - Guard evaluation result
- `TASK_START` - Task execution started
- `TASK_END` - Task execution completed
- `POLICY_PRE` - Policy pre-check
- `POLICY_POST` - Policy post-check
- `VERIFICATION` - Verification result
- `ERROR` - Error occurred
- `COMPENSATION` - Compensation triggered

## ACM v0.5 Compliance

- ✅ Section 6.1: Task execution ordering
- ✅ Section 6.2: Guard evaluation (deterministic)
- ✅ Section 6.3: Retry and backoff
- ✅ Section 6.4: Policy enforcement hooks
- ✅ Section 6.5: Verification hooks
- ✅ Section 5.8: Memory Ledger

## License

Apache-2.0
