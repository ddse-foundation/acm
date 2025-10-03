# ADR 001: Resumable Executor

## Status

Accepted

## Context

The ACM runtime needs the ability to checkpoint execution state and resume from interruptions or failures. This enables:

1. **Fault tolerance**: Resume execution after crashes or infrastructure failures
2. **Long-running workflows**: Pause and resume multi-hour executions
3. **Cost optimization**: Resume from checkpoints instead of re-executing expensive tasks
4. **Debugging**: Examine execution state at specific points

## Decision

### Checkpoint Cadence

Checkpoints are created:
- After each task completes successfully (`TASK_END`)
- After each guard evaluation (`GUARD_EVAL`)
- After policy decisions (`POLICY_PRE`, `POLICY_POST`)
- Before compensation actions (`COMPENSATION`)

### Storage Contract

We define a `CheckpointStore` interface with pluggable implementations:

```typescript
interface CheckpointStore {
  put(runId: string, checkpoint: Checkpoint): Promise<void>;
  get(runId: string, checkpointId?: string): Promise<Checkpoint | null>;
  list(runId: string): Promise<CheckpointMetadata[]>;
  prune(runId: string, keepLast: number): Promise<void>;
}
```

### Checkpoint Structure

```typescript
interface Checkpoint {
  id: string;              // Checkpoint identifier
  runId: string;           // Execution run identifier
  ts: number;              // Timestamp
  version: string;         // Schema version for compatibility
  state: {
    goal: Goal;
    context: Context;
    plan: Plan;
    outputs: Record<string, any>;    // Task outputs so far
    executed: Set<string>;           // Completed task IDs
    ledger: LedgerEntry[];           // Decision log
    metrics: {
      costUsd: number;
      elapsedSec: number;
    };
  };
}
```

### Ledger Alignment

Checkpoints are created synchronously with ledger entries. Each checkpoint references the ledger entry that triggered it, ensuring deterministic replay.

### Failure Semantics

- **Recoverable failures** (network timeout, rate limit): Resume from last checkpoint
- **Fatal failures** (invalid plan, policy denial): Do not resume; require user intervention
- **Partial failures** (task retry exhausted): Resume with user guidance or skip task

### Resume Options

```typescript
interface ResumableExecutePlanOptions extends ExecutePlanOptions {
  resumeFrom?: string;           // Checkpoint ID to resume from
  checkpointInterval?: number;   // Checkpoint after N tasks (default: 1)
  checkpointStore?: CheckpointStore;  // Storage backend
}
```

## Consequences

### Positive

- Enables long-running and fault-tolerant workflows
- Maintains deterministic execution semantics
- Backward compatible (opt-in via feature flag)
- Pluggable storage allows different backends (memory, file, database)

### Negative

- Adds ~5-10% execution overhead for checkpoint serialization
- Requires careful state management to ensure determinism
- Increases storage requirements (mitigated by pruning)
- Checkpoint compatibility must be maintained across versions

### Risks & Mitigations

1. **State divergence**: Enforce deterministic serialization via JSON schema validation
2. **Storage costs**: Implement `prune()` with configurable retention
3. **Adapter incompatibility**: Keep resume optional; log warnings instead of hard failures
4. **Version skew**: Include schema version in checkpoints; reject incompatible versions

## Implementation Phases

1. **R0**: This ADR + CheckpointStore interface
2. **R1**: Checkpoint generation in executor
3. **R2**: ResumableExecutor class with resume logic
4. **R3**: Adapter integration (LangGraph, MSAF)
5. **R4**: Store implementations + CLI support

## References

- ACM Spec v0.5 § 5.9 Memory Ledger
- IMPLEMENTATION_PLAN_PHASE2.md
- Replay Bundle Schema (for checkpoint integration)
