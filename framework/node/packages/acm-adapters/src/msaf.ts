// Microsoft Agent Framework Adapter for ACM
import {
  InternalContextScopeImpl,
  type Goal,
  type Context,
  type Plan,
  type CapabilityRegistry,
  type ToolRegistry,
  type PolicyEngine,
  type StreamSink,
  type RunContext,
  type NucleusFactory,
  type NucleusConfig,
} from '@acm/sdk';
import { createInstrumentedToolGetter } from '@acm/runtime';
import type { MemoryLedger } from '@acm/runtime';

/**
 * MS Agent Framework adapter options
 */
export interface MSAgentFrameworkAdapterOptions {
  goal: Goal;
  context: Context;
  plan: Plan;
  capabilityRegistry: CapabilityRegistry;
  toolRegistry: ToolRegistry;
  policy?: PolicyEngine;
  stream?: StreamSink;
  ledger?: MemoryLedger;
  resumeFrom?: string; // Checkpoint ID to resume from (optional, may not be supported)
  checkpointStore?: any; // Checkpoint store (optional, may not be supported)
  nucleusFactory: NucleusFactory;
  nucleusConfig: {
    llmCall: NucleusConfig['llmCall'];
    hooks?: NucleusConfig['hooks'];
    allowedTools?: string[];
  };
}

/**
 * Agent activity state
 */
export interface ActivityState {
  taskId: string;
  input: any;
  output?: any;
  context: Context;
  outputs: Map<string, any>;
}

/**
 * Activity handler type
 */
export type ActivityHandler = (state: ActivityState) => Promise<any>;

/**
 * Microsoft Agent Framework Adapter for ACM
 * 
 * Converts ACM tasks into MS Agent Framework activities with proper
 * hooks for policy, verification, and streaming.
 */
export class MSAgentFrameworkAdapter {
  private activities: Map<string, ActivityHandler> = new Map();

  constructor(private options: MSAgentFrameworkAdapterOptions) {
    // Warn if resume options are provided but not supported
    if (options.resumeFrom || options.checkpointStore) {
      console.warn(
        '⚠️  MS Agent Framework adapter does not support resume functionality. ' +
        'Use the runtime engine (--engine runtime) for resumable executions.'
      );
    }
    this.buildActivities();
  }

  /**
   * Build activity handlers from ACM tasks
   */
  private buildActivities(): void {
    const { plan, capabilityRegistry, toolRegistry, policy, stream, ledger } = this.options;

    for (const taskSpec of plan.tasks) {
      const handler = async (state: ActivityState): Promise<any> => {
        try {
          // Get task implementation
          const capabilityName = taskSpec.capabilityRef || taskSpec.capability;
          if (!capabilityName) {
            throw new Error(`Task ${taskSpec.id} missing capability reference`);
          }

          const task = capabilityRegistry.resolve(capabilityName);
          if (!task) {
            throw new Error(`Capability ${capabilityName} not found`);
          }

          // Build run context
          const allowedTools = new Set<string>(this.options.nucleusConfig.allowedTools ?? []);
          for (const tool of taskSpec.tools ?? []) {
            allowedTools.add(tool.name);
          }

          const nucleus = this.options.nucleusFactory({
            goalId: this.options.goal.id,
            planId: this.options.plan.id,
            taskId: taskSpec.id,
            contextRef: this.options.plan.contextRef,
            llmCall: this.options.nucleusConfig.llmCall,
            hooks: this.options.nucleusConfig.hooks,
            allowedTools: Array.from(allowedTools),
          });

          const internalScope = new InternalContextScopeImpl(entry => {
            this.options.ledger?.append(entry.type, entry.details);
          });
          nucleus.setInternalContext(internalScope);

          const getTool = createInstrumentedToolGetter({
            taskId: taskSpec.id,
            capability: capabilityName,
            toolRegistry,
            ledger,
          });

          const runContext: RunContext = {
            goal: this.options.goal,
            context: state.context,
            outputs: Object.fromEntries(state.outputs),
            metrics: { costUsd: 0, elapsedSec: 0 },
            getTool,
            getCapabilityRegistry: () => capabilityRegistry,
            stream,
            nucleus,
            internalContext: internalScope,
          };

          const preflight = await nucleus.preflight();
          if (preflight.status === 'NEEDS_CONTEXT') {
            throw new Error(
              `Task ${taskSpec.id} requires additional context retrieval: ${preflight.retrievalDirectives.join(', ')}`
            );
          }

          // Policy pre-check (PDP hook)
          if (policy) {
            const policyInput = task.policyInput?.(runContext, taskSpec.input || state.input) || {};

            const decision = await policy.evaluate('task.pre', {
              action: taskSpec.capability,
              input: policyInput,
              context: state.context,
            });

            if (!decision.allow) {
              if (ledger) {
                ledger.append('POLICY_PRE', {
                  taskId: taskSpec.id,
                  capability: taskSpec.capability,
                  allowed: false,
                });
              }
              throw new Error(`Policy denied execution of ${taskSpec.capability}`);
            }

            if (ledger) {
              ledger.append('POLICY_PRE', {
                taskId: taskSpec.id,
                capability: taskSpec.capability,
                allowed: true,
              });
            }
          }

          // Emit start event
          stream?.emit('task', { 
            taskId: taskSpec.id, 
            status: 'started',
            capability: taskSpec.capability,
          });

          // Execute task
          const output = await task.execute(runContext, taskSpec.input || state.input);

          // Verification (if provided)
          const verificationExprs = task.verification?.() || [];
          if (verificationExprs.length > 0) {
            for (const expr of verificationExprs) {
              try {
                const func = new Function('output', `return ${expr}`);
                const result = func(output);
                
                if (!result) {
                  throw new Error(`Verification failed: ${expr}`);
                }

                if (ledger) {
                  ledger.append('VERIFICATION', {
                    taskId: taskSpec.id,
                    expression: expr,
                    passed: true,
                  });
                }
              } catch (error) {
                if (ledger) {
                  ledger.append('VERIFICATION', {
                    taskId: taskSpec.id,
                    expression: expr,
                    error: String(error),
                    passed: false,
                  });
                }
                throw error;
              }
            }
          }

          // Emit completion event
          stream?.emit('task', { 
            taskId: taskSpec.id, 
            status: 'completed',
            output,
          });

          // Log completion
          if (ledger) {
            ledger.append('TASK_END', {
              taskId: taskSpec.id,
              capability: taskSpec.capability,
            });
          }

          const postcheck = await nucleus.postcheck(output);
          if (postcheck.status === 'NEEDS_COMPENSATION' || postcheck.status === 'ESCALATE') {
            throw new Error(`Task ${taskSpec.id} postcheck failed: ${postcheck.reason}`);
          }

          return output;
        } catch (error) {
          // Emit error event
          stream?.emit('task', { 
            taskId: taskSpec.id, 
            status: 'failed',
            error,
          });

          // Log error
          if (ledger) {
            ledger.append('ERROR', {
              taskId: taskSpec.id,
              error: String(error),
            });
          }

          throw error;
        }
      };

      this.activities.set(taskSpec.id, handler);
    }
  }

  /**
   * Get activity handler for a task
   */
  getActivity(taskId: string): ActivityHandler | undefined {
    return this.activities.get(taskId);
  }

  /**
   * Get all activities
   */
  getAllActivities(): Map<string, ActivityHandler> {
    return new Map(this.activities);
  }

  /**
   * Execute workflow using MS Agent Framework pattern
   */
  async execute(): Promise<{ outputsByTask: Record<string, any>; ledger: readonly any[] }> {
    const { plan, context } = this.options;
    const outputs = new Map<string, any>();

    // Build execution order based on edges
    const executionOrder = this.topologicalSort(plan);

    for (const taskId of executionOrder) {
      const handler = this.activities.get(taskId);
      if (!handler) continue;

      const taskSpec = plan.tasks.find((t) => t.id === taskId);
      if (!taskSpec) continue;

      const state: ActivityState = {
        taskId,
        input: taskSpec.input || {},
        context,
        outputs,
      };

      const result = await handler(state);
      outputs.set(taskId, result);
    }

    return {
      outputsByTask: Object.fromEntries(outputs),
      ledger: this.options.ledger?.getEntries() || [],
    };
  }

  /**
   * Topological sort of tasks based on edges
   */
  private topologicalSort(plan: Plan): string[] {
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();

    // Initialize
    for (const task of plan.tasks) {
      inDegree.set(task.id, 0);
      graph.set(task.id, []);
    }

    // Build graph
    for (const edge of plan.edges) {
      graph.get(edge.from)?.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    // Find nodes with no incoming edges
    const queue: string[] = [];
    for (const [taskId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(taskId);
      }
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const neighbor of graph.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }
}

/**
 * Helper function to create MS Agent Framework adapter
 */
export function wrapAgentNodes(options: MSAgentFrameworkAdapterOptions): MSAgentFrameworkAdapter {
  return new MSAgentFrameworkAdapter(options);
}
