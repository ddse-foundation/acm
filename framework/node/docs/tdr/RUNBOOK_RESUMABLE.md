# Resumable Executor Operational Runbook

This runbook provides operational guidance for using the ACM resumable executor feature in production environments.

## Overview

The resumable executor enables fault-tolerant execution of long-running ACM workflows by:
- Creating checkpoints after each task completes
- Storing checkpoints to persistent storage (file system or custom store)
- Resuming execution from the last successful checkpoint on failure

## Quick Start

### Basic Usage

```bash
# Run with automatic checkpointing
acm-demo --goal refund --checkpoint-dir ./checkpoints

# Resume from checkpoint (use runId from previous execution)
acm-demo --resume run-1234567890 --checkpoint-dir ./checkpoints
```

### Programmatic Usage

```typescript
import { executeResumablePlan, FileCheckpointStore } from '@ddse/acm-runtime';

const checkpointStore = new FileCheckpointStore('./checkpoints');
const runId = 'my-workflow-001';

// Initial execution
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

// Resume from checkpoint
const resumedResult = await executeResumablePlan({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  runId,
  checkpointStore,
  resumeFrom: 'checkpoint-xyz', // or omit to use latest
});
```

## Checkpoint Management

### Listing Checkpoints

```typescript
import { ResumableExecutor, FileCheckpointStore } from '@ddse/acm-runtime';

const executor = new ResumableExecutor(
  new FileCheckpointStore('./checkpoints')
);

const checkpoints = await executor.listCheckpoints('run-1234567890');
console.log(`Found ${checkpoints.length} checkpoints`);

for (const cp of checkpoints) {
  console.log(`${cp.id}: ${cp.tasksCompleted} tasks at ${new Date(cp.ts)}`);
}
```

### Pruning Old Checkpoints

```typescript
// Keep only the last 5 checkpoints
await executor.pruneCheckpoints('run-1234567890', 5);
```

### Manual Checkpoint Inspection

Checkpoint files are stored as JSON and can be inspected manually:

```bash
# List checkpoints for a run
ls -lh ./checkpoints/run-1234567890/

# View checkpoint contents
cat ./checkpoints/run-1234567890/checkpoint-xyz.json | jq
```

## Storage Backends

### MemoryCheckpointStore

For testing and development:

```typescript
import { MemoryCheckpointStore } from '@ddse/acm-runtime';

const store = new MemoryCheckpointStore();
// Checkpoints stored in memory, lost on process exit
```

### FileCheckpointStore

For production use with persistent storage:

```typescript
import { FileCheckpointStore } from '@ddse/acm-runtime';

const store = new FileCheckpointStore('/var/acm/checkpoints');
// Checkpoints stored as JSON files
```

### Custom Store

Implement the `CheckpointStore` interface for custom backends (database, S3, etc.):

```typescript
import { CheckpointStore, Checkpoint } from '@ddse/acm-runtime';

class DatabaseCheckpointStore implements CheckpointStore {
  async put(runId: string, checkpoint: Checkpoint): Promise<void> {
    // Store in database
  }

  async get(runId: string, checkpointId?: string): Promise<Checkpoint | null> {
    // Retrieve from database
  }

  async list(runId: string): Promise<CheckpointMetadata[]> {
    // List from database
  }

  async prune(runId: string, keepLast: number): Promise<void> {
    // Delete old checkpoints
  }
}
```

## Troubleshooting

### Resume Fails: "Checkpoint not found"

**Cause**: The specified checkpoint ID doesn't exist.

**Solution**:
1. List available checkpoints: `executor.listCheckpoints(runId)`
2. Verify the checkpoint directory path
3. Check file permissions if using FileCheckpointStore

### Resume Fails: "Invalid checkpoint"

**Cause**: Checkpoint version mismatch or corrupted file.

**Solution**:
1. Check checkpoint version in file: `cat checkpoint.json | jq .version`
2. Verify checkpoint file is valid JSON
3. If corrupted, use an earlier checkpoint or restart execution

### Resume Executes Already-Completed Tasks

**Cause**: Checkpoint wasn't created after task completion.

**Solution**:
1. Verify `checkpointInterval` is set correctly (default: 1)
2. Check that checkpoint storage is working (no write errors)
3. Inspect checkpoint file to verify `executed` array

### High Storage Usage

**Cause**: Too many checkpoints accumulating.

**Solution**:
1. Implement regular pruning: `executor.pruneCheckpoints(runId, keepLast)`
2. Set up a cleanup job to delete old run directories
3. Consider a custom store with automatic retention policy

## Performance Considerations

### Checkpoint Overhead

- Typical overhead: 5-10% execution time
- Overhead increases with:
  - Larger outputs (more data to serialize)
  - Smaller tasks (higher checkpoint frequency)
  - Slower storage backends

**Optimization**:
```typescript
// Checkpoint less frequently for small tasks
checkpointInterval: 5  // Checkpoint every 5 tasks instead of every 1
```

### Storage Space

- Checkpoint size depends on:
  - Plan complexity (number of tasks)
  - Output sizes
  - Ledger size

**Estimation**:
```
Checkpoint size ≈ 
  (plan size + sum of outputs + ledger) * 1.2 (JSON overhead)
```

**Example**:
- 10 tasks with 10KB average output
- Ledger: 50 entries × 500 bytes
- Checkpoint size ≈ (100KB + 25KB) × 1.2 ≈ 150KB

## Best Practices

### 1. Choose Appropriate Run IDs

Use meaningful, unique identifiers:

```typescript
// Good
const runId = `refund-${orderId}-${timestamp}`;

// Bad
const runId = Math.random().toString();
```

### 2. Set Checkpoint Intervals Wisely

```typescript
// For expensive operations (API calls, DB queries)
checkpointInterval: 1  // Checkpoint after each task

// For cheap in-memory operations
checkpointInterval: 10  // Checkpoint less frequently
```

### 3. Implement Retention Policies

```typescript
// Example: Daily cleanup job
async function cleanupOldCheckpoints() {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
  
  for (const runId of await listAllRuns()) {
    const checkpoints = await executor.listCheckpoints(runId);
    
    if (checkpoints.length > 0 && checkpoints[0].ts < cutoff) {
      await deleteRunDirectory(runId);
    }
  }
}
```

### 4. Monitor Checkpoint Health

```typescript
// Add monitoring/alerting
const checkpoints = await executor.listCheckpoints(runId);

if (checkpoints.length === 0) {
  console.warn(`No checkpoints created for ${runId}`);
}

if (checkpoints.length > 100) {
  console.warn(`Excessive checkpoints for ${runId}: ${checkpoints.length}`);
}
```

### 5. Test Resume Scenarios

```typescript
// Integration test
async function testResume() {
  // First execution (interrupted)
  let result = await executeResumablePlan({
    goal,
    context,
    plan: partialPlan,  // Only some tasks
    runId: 'test-resume',
    checkpointStore,
  });

  // Resume with full plan
  result = await executeResumablePlan({
    goal,
    context,
    plan: fullPlan,
    runId: 'test-resume',
    checkpointStore,
    resumeFrom: 'latest',
  });

  // Verify all tasks completed
  assert(Object.keys(result.outputsByTask).length === fullPlan.tasks.length);
}
```

## Limitations

### Current Limitations

1. **Adapter Support**: Resume is only supported with the `runtime` engine
   - LangGraph adapter: Not supported (warning displayed)
   - MSAF adapter: Not supported (warning displayed)

2. **State Determinism**: Resume assumes deterministic task execution
   - Non-deterministic tasks may produce different results on resume
   - Use idempotency keys where possible

3. **Plan Compatibility**: Resumed execution must use the same plan
   - Changing the plan structure invalidates checkpoints
   - Adding/removing tasks requires fresh execution

4. **Context Immutability**: Context must not change between executions
   - Checkpoint stores the context snapshot
   - Changing context facts invalidates resume

### Future Enhancements

- [ ] Cross-adapter resume support
- [ ] Partial checkpoint updates (incremental)
- [ ] Distributed checkpoint storage (Redis, S3)
- [ ] Checkpoint compression
- [ ] Plan migration/evolution support

## Support

For issues or questions:
- GitHub Issues: https://github.com/ddse-foundation/acm/issues
- Documentation: `framework/node/docs/`
- ADR: `framework/node/docs/adr/001-resumable-executor.md`
