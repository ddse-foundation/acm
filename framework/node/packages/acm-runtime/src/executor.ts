// Main execution engine
import {
  InternalContextScopeImpl,
  type CapabilityRegistry,
  type Context,
  type Goal,
  type LedgerEntry,
  ExternalContextProviderAdapter,
  type NucleusConfig,
  type NucleusFactory,
  type PostcheckResult,
  type Plan,
  type PolicyEngine,
  type RunContext,
  type StreamSink,
  type ToolRegistry,
} from '@ddse/acm-sdk';
import { evaluateGuard } from './guards.js';
import { MemoryLedger } from './ledger.js';
import { withRetry } from './retry.js';
import { createInstrumentedToolGetter } from './tool-envelope.js';

export type TaskNarrative = {
  reasoning?: string[];
  postcheck?: {
    status: PostcheckResult['status'];
    reason?: string;
  };
};

export type TaskExecutionRecord = {
  output: any;
  narrative?: TaskNarrative;
};

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
  nucleusFactory: NucleusFactory;
  nucleusConfig: {
    llmCall: NucleusConfig['llmCall'];
    hooks?: NucleusConfig['hooks'];
    allowedTools?: string[];
  };
  contextProvider?: ExternalContextProviderAdapter;
};

export type ExecutePlanResult = {
  outputsByTask: Record<string, TaskExecutionRecord>;
  ledger: readonly LedgerEntry[];
  goalSummary?: string;
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
    nucleusFactory,
    nucleusConfig,
    contextProvider,
  } = options;

  const ledger = options.ledger ?? new MemoryLedger();
  const outputs: Record<string, any> = {};
  const executionRecords: Record<string, TaskExecutionRecord> = {};
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

      const nucleusAllowedTools = new Set<string>(nucleusConfig.allowedTools ?? []);
      for (const tool of taskSpec.tools ?? []) {
        nucleusAllowedTools.add(tool.name);
      }

      const nucleus = nucleusFactory({
        goalId: goal.id,
        goalIntent: goal.intent,
        planId: plan.id,
        taskId: taskSpec.id,
        contextRef: plan.contextRef,
        context,
        llmCall: nucleusConfig.llmCall,
        hooks: nucleusConfig.hooks,
        allowedTools: Array.from(nucleusAllowedTools),
      });

      const internalScope = new InternalContextScopeImpl(entry => {
        ledger.append(entry.type, entry.details);
      });
      nucleus.setInternalContext(internalScope);

      const getTool = createInstrumentedToolGetter({
        taskId: taskSpec.id,
        capability: capabilityName,
        toolRegistry,
        ledger,
      });

      // Build run context
      const runContext: RunContext = {
        goal,
        context,
        outputs,
        metrics,
        getTool,
        getToolRegistry: () => toolRegistry,
        getCapabilityRegistry: () => capabilityRegistry,
        stream,
        nucleus,
        internalContext: internalScope,
      };

      let preflight = await nucleus.preflight();
      if (preflight.status === 'NEEDS_CONTEXT') {
        const requestedDirectives = preflight.retrievalDirectives;

        ledger.append('CONTEXT_INTERNALIZED', {
          taskId: taskSpec.id,
          directives: requestedDirectives,
          status: contextProvider ? 'requested' : 'unhandled',
        });

        if (!contextProvider) {
          throw new Error(
            `Task ${taskSpec.id} requires additional context retrieval: ${preflight.retrievalDirectives.join(', ')}`
          );
        }

        await contextProvider.fulfill({
          directives: requestedDirectives,
          scope: internalScope,
          runContext,
          nucleus,
        });

        preflight = await nucleus.preflight();
        if (preflight.status === 'NEEDS_CONTEXT') {
          throw new Error(
            `Task ${taskSpec.id} still requires additional context after adapter execution: ${preflight.retrievalDirectives.join(', ')}`
          );
        }

        ledger.append('CONTEXT_INTERNALIZED', {
          taskId: taskSpec.id,
          directives: requestedDirectives,
          status: 'resolved',
        });
      }

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
      const ledgerBaseline = ledger.getEntries().length;

      ledger.append('TASK_START', {
        taskId: taskSpec.id,
        capability: capabilityName,
        input: taskSpec.input,
      });

      stream?.emit('task', { taskId: taskSpec.id, status: 'running' });

      try {
        const executeTask = async () => task.execute(runContext, taskSpec.input);
        const retryConfig = taskSpec.retry || (taskSpec.retryPolicy
          ? {
              attempts: taskSpec.retryPolicy.maxAttempts || 3,
              backoff: 'exp' as const,
            }
          : undefined);

        const output = retryConfig ? await withRetry(executeTask, retryConfig) : await executeTask();
        outputs[taskSpec.id] = output;

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

  const postcheck = await nucleus.postcheck(output);
        if (postcheck.status === 'NEEDS_COMPENSATION') {
          ledger.append('ERROR', {
            taskId: taskSpec.id,
            stage: 'NUCLEUS_POSTCHECK',
            message: postcheck.reason,
          });
          throw new Error(`Task ${taskSpec.id} requires compensation: ${postcheck.reason}`);
        }
        if (postcheck.status === 'ESCALATE') {
          ledger.append('ERROR', {
            taskId: taskSpec.id,
            stage: 'NUCLEUS_POSTCHECK',
            message: postcheck.reason,
          });
          throw new Error(`Task ${taskSpec.id} escalated: ${postcheck.reason}`);
        }

        const narrative = buildTaskNarrative(ledger, ledgerBaseline, taskSpec.id, postcheck);
        executionRecords[taskSpec.id] = {
          output,
          narrative,
        };

        ledger.append('TASK_END', {
          taskId: taskSpec.id,
          output,
          narrative,
        });

        stream?.emit('task', { taskId: taskSpec.id, status: 'completed', output, narrative });

        executed.add(taskSpec.id);
      } catch (error: any) {
        ledger.append('ERROR', {
          taskId: taskSpec.id,
          capability: capabilityName,
          message: error.message || 'Unknown error',
        });

        stream?.emit('task', {
          taskId: taskSpec.id,
          status: 'failed',
          error: error.message || error.toString(),
        });

        throw error;
      }
    }
  }

  const goalSummary = await synthesizeGoalSummary({
    goal,
    plan,
    executionRecords,
    context,
    nucleusFactory,
    nucleusConfig,
    ledger,
    stream,
  });

  metrics.elapsedSec = (Date.now() - startTime) / 1000;

  return {
    outputsByTask: executionRecords,
    ledger: ledger.getEntries(),
    goalSummary,
  };
}

export function buildTaskNarrative(
  ledger: MemoryLedger,
  baselineIndex: number,
  taskId: string,
  postcheck: PostcheckResult
): TaskNarrative | undefined {
  const entries = ledger.getEntries().slice(baselineIndex);
  const reasonings = entries
    .filter(entry => entry.type === 'NUCLEUS_INFERENCE')
    .filter(entry => entry.details?.nucleus?.taskId === taskId)
    .map(entry => (typeof entry.details?.reasoning === 'string' ? entry.details.reasoning.trim() : undefined))
    .filter((text): text is string => Boolean(text && text.length > 0));

  const narrative: TaskNarrative = {};
  if (reasonings.length > 0) {
    narrative.reasoning = reasonings;
  }

  narrative.postcheck = {
    status: postcheck.status,
    ...(postcheck.status !== 'COMPLETE' && 'reason' in postcheck
      ? { reason: (postcheck as Extract<PostcheckResult, { reason: string }>).reason }
      : {}),
  } as TaskNarrative['postcheck'];

  if (!narrative.reasoning && !narrative.postcheck?.reason && narrative.postcheck?.status === 'COMPLETE') {
    // Return undefined if narrative is completely empty beyond a routine COMPLETE status
    return undefined;
  }

  return narrative;
}

export async function synthesizeGoalSummary(options: {
  goal: Goal;
  plan: Plan;
  executionRecords: Record<string, TaskExecutionRecord>;
  context: Context;
  nucleusFactory: NucleusFactory;
  nucleusConfig: ExecutePlanOptions['nucleusConfig'];
  ledger: MemoryLedger;
  stream?: StreamSink;
}): Promise<string | undefined> {
  const { goal, plan, executionRecords, context, nucleusFactory, nucleusConfig, ledger, stream } = options;

  if (plan.tasks.length === 0 || Object.keys(executionRecords).length === 0) {
    return undefined;
  }

  try {
    const allowedTools = Array.from(new Set(nucleusConfig.allowedTools ?? []));
    const nucleus = nucleusFactory({
      goalId: goal.id,
      goalIntent: goal.intent,
      planId: plan.id,
      taskId: 'goal-summary',
      contextRef: plan.contextRef,
      context,
      llmCall: nucleusConfig.llmCall,
      hooks: nucleusConfig.hooks,
      allowedTools,
    });

    const prompt = buildGoalSummaryPrompt(goal, plan, executionRecords, context);
    const result = await nucleus.invoke({ prompt, tools: [] });
    const summary = result.reasoning?.trim() ?? '';
    const normalizedSummary = summary.length > 0 ? summary : undefined;

    ledger.append('GOAL_SUMMARY', {
      goalId: goal.id,
      planId: plan.id,
      summary: normalizedSummary,
      tasks: plan.tasks.map(task => {
        const record = executionRecords[task.id];
        return {
          id: task.id,
          title: task.title,
          objective: task.objective,
          successCriteria: task.successCriteria,
          outputPreview: record ? previewForSummary(record.output) : undefined,
          postcheck: record?.narrative?.postcheck,
        };
      }),
    });

    if (normalizedSummary) {
      stream?.emit('summary', {
        goalId: goal.id,
        planId: plan.id,
        summary: normalizedSummary,
      });
    }

    return normalizedSummary;
  } catch (error: any) {
    ledger.append('ERROR', {
      stage: 'GOAL_SUMMARY',
      message: error?.message ?? 'Failed to synthesize goal summary',
    });
    return undefined;
  }
}

function buildGoalSummaryPrompt(
  goal: Goal,
  plan: Plan,
  executionRecords: Record<string, TaskExecutionRecord>,
  context: Context
): string {
  const goalIntent = goal.intent ?? goal.id;
  const contextFacts = context?.facts ? JSON.stringify(context.facts, null, 2) : '{}';
  const contextAssumptions = context?.assumptions?.length
    ? `Assumptions:\n- ${context.assumptions.join('\n- ')}`
    : 'Assumptions: none provided';

  const taskSections = plan.tasks.map(task => {
    const record = executionRecords[task.id];
    const label = task.title || task.capabilityRef || task.capability || task.id;
    const pieces = [
      `Task ${task.id}: ${label}`,
      task.objective ? `Objective: ${task.objective}` : undefined,
      task.successCriteria && task.successCriteria.length > 0
        ? `Success Criteria: ${task.successCriteria.join('; ')}`
        : undefined,
      record ? `Outcome: ${previewForSummary(record.output)}` : 'Outcome: not captured.',
      record?.narrative?.reasoning?.length
        ? `Narrative: ${record.narrative.reasoning.join(' ')}`
        : undefined,
      record?.narrative?.postcheck
        ? `Postcheck: ${record.narrative.postcheck.status}${record.narrative.postcheck.reason ? ` (${record.narrative.postcheck.reason})` : ''}`
        : undefined,
    ].filter(Boolean);

    return pieces.join('\n');
  });

  return `You are composing the wrap-up for an ACM execution run.
Goal intent: ${goalIntent}
Context reference: ${plan.contextRef}

Context facts:
${contextFacts}
${contextAssumptions}

Summarize the outcome in 2-3 sentences for the operator. Highlight what happened, any remaining risks or follow-up, and reference task achievements when relevant.

Task outcomes:
${taskSections.join('\n\n')}`;
}

function previewForSummary(value: any, maxLength = 240): string {
  if (value === null || value === undefined) {
    return 'No output provided.';
  }

  let text: string;
  if (typeof value === 'string') {
    text = value.trim();
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    text = String(value);
  } else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }

  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}
