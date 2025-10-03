// Resumable executor with checkpoint and resume support
import type {
  Goal,
  Context,
  Plan,
  CapabilityRegistry,
  ToolRegistry,
  PolicyEngine,
  StreamSink,
  RunContext,
} from '@acm/sdk';
import { evaluateGuard } from './guards.js';
import { MemoryLedger } from './ledger.js';
import { withRetry } from './retry.js';
import {
  createCheckpoint,
  validateCheckpoint,
  MemoryCheckpointStore,
  type Checkpoint,
  type CheckpointStore,
  type CheckpointState,
} from './checkpoint.js';
import type { ExecutePlanOptions, ExecutePlanResult } from './executor.js';

/**
 * Extended options for resumable execution
 */
export interface ResumableExecutePlanOptions extends ExecutePlanOptions {
  resumeFrom?: string;           // Checkpoint ID to resume from
  checkpointInterval?: number;   // Checkpoint after N tasks (default: 1)
  checkpointStore?: CheckpointStore;  // Storage backend
  runId?: string;                // Execution run identifier
}

/**
 * Execute a plan with checkpoint and resume support
 */
export async function executeResumablePlan(
  options: ResumableExecutePlanOptions
): Promise<ExecutePlanResult> {
  const {
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
    policy,
    verify,
    stream,
    resumeFrom,
    checkpointInterval = 1,
    checkpointStore = new MemoryCheckpointStore(),
    runId = `run-${Date.now()}`,
  } = options;

  const ledger = options.ledger ?? new MemoryLedger();
  let outputs: Record<string, any> = {};
  const policyContext: Record<string, any> = {};
  const metrics = { costUsd: 0, elapsedSec: 0 };
  let startTime = Date.now();
  let executed = new Set<string>();
  let tasksExecutedSinceCheckpoint = 0;

  // Restore from checkpoint if resuming
  if (resumeFrom) {
    console.log(`Resuming from checkpoint: ${resumeFrom}`);
    const checkpoint = await checkpointStore.get(runId, resumeFrom);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${resumeFrom}`);
    }

    if (!validateCheckpoint(checkpoint)) {
      throw new Error(`Invalid checkpoint: ${resumeFrom}`);
    }

    // Restore state
    outputs = checkpoint.state.outputs;
    executed = new Set(checkpoint.state.executed);
    metrics.costUsd = checkpoint.state.metrics.costUsd;
    metrics.elapsedSec = checkpoint.state.metrics.elapsedSec;

    // Restore ledger
    for (const entry of checkpoint.state.ledger) {
      ledger.append(entry.type, entry.details);
    }

    console.log(`Restored ${executed.size} completed tasks`);
    startTime = Date.now() - metrics.elapsedSec * 1000;
  } else {
    // Log plan selection for new execution
    ledger.append('PLAN_SELECTED', {
      planId: plan.id,
      contextRef: plan.contextRef,
      capabilityMapVersion: plan.capabilityMapVersion,
    });
  }

  // Helper to create checkpoint
  const saveCheckpoint = async () => {
    const state: CheckpointState = {
      goal,
      context,
      plan,
      outputs,
      executed: Array.from(executed),
      ledger: ledger.getEntries() as any[],
      metrics: { ...metrics },
    };

    const checkpoint = createCheckpoint(runId, state);
    await checkpointStore.put(runId, checkpoint);
    
    if (stream) {
      stream.emit('checkpoint', {
        checkpointId: checkpoint.id,
        tasksCompleted: executed.size,
      });
    }

    return checkpoint;
  };

  // Build execution order based on edges
  const pending = plan.tasks.filter(t => !executed.has(t.id));

  while (pending.length > 0) {
    const readyTasks = pending.filter(taskSpec => {
      // Skip already executed tasks
      if (executed.has(taskSpec.id)) {
        return false;
      }

      // Check if all dependencies are satisfied
      const incomingEdges = plan.edges.filter(e => e.to === taskSpec.id);
      if (incomingEdges.length === 0) {
        return true; // No dependencies
      }

      return incomingEdges.every(edge => {
        if (!executed.has(edge.from)) {
          return false;
        }

        // Evaluate guard if present
        if (edge.guard) {
          const guardResult = evaluateGuard(edge.guard, {
            context,
            outputs,
            policy: policyContext,
          });

          ledger.append('GUARD_EVAL', {
            edge: `${edge.from}->${edge.to}`,
            guard: edge.guard,
            result: guardResult,
          });

          return guardResult;
        }

        return true;
      });
    });

    if (readyTasks.length === 0) {
      break; // No more tasks can be executed
    }

    // Execute ready tasks
    for (const taskSpec of readyTasks) {
      pending.splice(pending.indexOf(taskSpec), 1);

      const task = capabilityRegistry.resolve(taskSpec.capability);
      if (!task) {
        throw new Error(`Task not found for capability: ${taskSpec.capability}`);
      }

      // Build run context
      const runContext: RunContext = {
        goal,
        context,
        outputs,
        metrics,
        getTool: (name: string) => toolRegistry.get(name),
        getCapabilityRegistry: () => capabilityRegistry,
        stream,
      };

      // Policy pre-check
      if (policy) {
        const policyInput = task.policyInput?.(runContext, taskSpec.input) ?? {};
        const decision = await policy.evaluate('task.pre', {
          taskId: taskSpec.id,
          capability: taskSpec.capability,
          ...policyInput,
        });

        ledger.append('POLICY_PRE', {
          taskId: taskSpec.id,
          decision,
        });

        if (!decision.allow) {
          throw new Error(`Policy denied task ${taskSpec.id}: ${decision.reason}`);
        }

        policyContext[taskSpec.id] = decision;
      }

      // Execute task with retry
      ledger.append('TASK_START', {
        taskId: taskSpec.id,
        capability: taskSpec.capability,
        input: taskSpec.input,
      });

      stream?.emit('task', { taskId: taskSpec.id, status: 'running' });

      try {
        const executeTask = async () => {
          const result = await task.execute(runContext, taskSpec.input);
          return result;
        };

        const output = taskSpec.retry
          ? await withRetry(executeTask, taskSpec.retry)
          : await executeTask();

        outputs[taskSpec.id] = output;

        ledger.append('TASK_END', {
          taskId: taskSpec.id,
          output,
        });

        stream?.emit('task', { taskId: taskSpec.id, status: 'completed', output });

        // Policy post-check
        if (policy) {
          const decision = await policy.evaluate('task.post', {
            taskId: taskSpec.id,
            output,
          });

          ledger.append('POLICY_POST', {
            taskId: taskSpec.id,
            decision,
          });
        }

        // Verification
        if (verify && taskSpec.verification && taskSpec.verification.length > 0) {
          const verified = await verify(taskSpec.id, output, taskSpec.verification);

          ledger.append('VERIFICATION', {
            taskId: taskSpec.id,
            expressions: taskSpec.verification,
            result: verified,
          });

          if (!verified) {
            throw new Error(`Verification failed for task ${taskSpec.id}`);
          }
        }

        executed.add(taskSpec.id);
        tasksExecutedSinceCheckpoint++;

        // Create checkpoint if interval reached
        if (tasksExecutedSinceCheckpoint >= checkpointInterval) {
          await saveCheckpoint();
          tasksExecutedSinceCheckpoint = 0;
        }
      } catch (err) {
        const error = err as Error;
        ledger.append('ERROR', {
          taskId: taskSpec.id,
          error: error.message,
          stack: error.stack,
        });

        stream?.emit('task', { taskId: taskSpec.id, status: 'failed', error: error.message });

        // Save checkpoint before throwing to allow resume
        await saveCheckpoint();

        throw error;
      }
    }
  }

  // Final checkpoint
  if (tasksExecutedSinceCheckpoint > 0) {
    await saveCheckpoint();
  }

  metrics.elapsedSec = (Date.now() - startTime) / 1000;

  return {
    outputsByTask: outputs,
    ledger: ledger.getEntries(),
  };
}

/**
 * ResumableExecutor class for managing resumable executions
 */
export class ResumableExecutor {
  constructor(
    private checkpointStore: CheckpointStore = new MemoryCheckpointStore()
  ) {}

  /**
   * Execute a plan with checkpointing enabled
   */
  async execute(options: ResumableExecutePlanOptions): Promise<ExecutePlanResult> {
    return executeResumablePlan({
      ...options,
      checkpointStore: options.checkpointStore ?? this.checkpointStore,
    });
  }

  /**
   * List available checkpoints for a run
   */
  async listCheckpoints(runId: string) {
    return this.checkpointStore.list(runId);
  }

  /**
   * Get a specific checkpoint
   */
  async getCheckpoint(runId: string, checkpointId?: string): Promise<Checkpoint | null> {
    return this.checkpointStore.get(runId, checkpointId);
  }

  /**
   * Prune old checkpoints
   */
  async pruneCheckpoints(runId: string, keepLast: number = 5): Promise<void> {
    return this.checkpointStore.prune(runId, keepLast);
  }
}
