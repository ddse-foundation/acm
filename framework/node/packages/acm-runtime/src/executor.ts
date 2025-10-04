// Main execution engine
import type {
  Goal,
  Context,
  Plan,
  CapabilityRegistry,
  ToolRegistry,
  PolicyEngine,
  StreamSink,
  RunContext,
  LedgerEntry,
} from '@acm/sdk';
import { evaluateGuard } from './guards.js';
import { MemoryLedger } from './ledger.js';
import { withRetry } from './retry.js';

export type ExecutePlanOptions = {
  goal: Goal;
  context: Context;
  plan: Plan;
  capabilityRegistry: CapabilityRegistry;
  toolRegistry: ToolRegistry;
  policy?: PolicyEngine;
  verify?: (taskId: string, output: any, expressions: string[]) => Promise<boolean>;
  stream?: StreamSink;
  ledger?: MemoryLedger;
};

export type ExecutePlanResult = {
  outputsByTask: Record<string, any>;
  ledger: readonly LedgerEntry[];
};

export async function executePlan(options: ExecutePlanOptions): Promise<ExecutePlanResult> {
  const {
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
    policy,
    verify,
    stream,
  } = options;

  const ledger = options.ledger ?? new MemoryLedger();
  const outputs: Record<string, any> = {};
  const policyContext: Record<string, any> = {};
  const metrics = { costUsd: 0, elapsedSec: 0 };
  const startTime = Date.now();

  // Log plan selection
  ledger.append('PLAN_SELECTED', {
    planId: plan.id,
    contextRef: plan.contextRef,
    capabilityMapVersion: plan.capabilityMapVersion,
  });

  // Build execution order based on edges
  const executed = new Set<string>();
  const pending = [...plan.tasks];

  while (pending.length > 0) {
    const readyTasks = pending.filter(taskSpec => {
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

      const capabilityName = taskSpec.capabilityRef || taskSpec.capability;
      if (!capabilityName) {
        throw new Error(`Task ${taskSpec.id} missing capability reference`);
      }
      
      const task = capabilityRegistry.resolve(capabilityName);
      if (!task) {
        throw new Error(`Task not found for capability: ${capabilityName}`);
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
        capability: capabilityName,
        input: taskSpec.input,
      });

      stream?.emit('task', { taskId: taskSpec.id, status: 'running' });

      try {
        const executeTask = async () => {
          const result = await task.execute(runContext, taskSpec.input);
          return result;
        };

        const retryConfig = taskSpec.retry || (taskSpec.retryPolicy ? {
          attempts: taskSpec.retryPolicy.maxAttempts || 3,
          backoff: 'exp' as const,
        } : undefined);

        const output = retryConfig
          ? await withRetry(executeTask, retryConfig)
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
      } catch (err) {
        const error = err as Error;
        ledger.append('ERROR', {
          taskId: taskSpec.id,
          error: error.message,
          stack: error.stack,
        });

        stream?.emit('task', { taskId: taskSpec.id, status: 'failed', error: error.message });

        throw error;
      }
    }
  }

  metrics.elapsedSec = (Date.now() - startTime) / 1000;

  return {
    outputsByTask: outputs,
    ledger: ledger.getEntries(),
  };
}
