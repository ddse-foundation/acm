// LangGraph Adapter for ACM
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
} from '@ddse/acm-sdk';
import { createInstrumentedToolGetter } from '@ddse/acm-runtime';
import type { MemoryLedger } from '@ddse/acm-runtime';

/**
 * LangGraph adapter options
 */
export interface LangGraphAdapterOptions {
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
 * LangGraph node state
 */
export interface GraphState {
  taskId: string;
  input: any;
  output?: any;
  error?: Error;
  context: Context;
  outputs: Map<string, any>;
}

/**
 * Convert ACM Plan to LangGraph-compatible structure
 * 
 * This adapter converts ACM tasks and edges into LangGraph nodes and edges.
 * Each ACM task becomes a LangGraph node, and guards become conditional edges.
 */
export class LangGraphAdapter {
  constructor(private options: LangGraphAdapterOptions) {
    // Warn if resume options are provided but not supported
    if (options.resumeFrom || options.checkpointStore) {
      console.warn(
        '⚠️  LangGraph adapter does not support resume functionality. ' +
        'Use the runtime engine (--engine runtime) for resumable executions.'
      );
    }
  }

  /**
   * Create a LangGraph-compatible node function from an ACM task
   */
  private createNodeFunction(taskId: string) {
    return async (state: GraphState): Promise<Partial<GraphState>> => {
      const { plan, capabilityRegistry, toolRegistry, policy, stream, ledger } = this.options;
      
      // Find task spec in plan
      const taskSpec = plan.tasks.find((t) => t.id === taskId);
      if (!taskSpec) {
        throw new Error(`Task ${taskId} not found in plan`);
      }

      try {
        // Get task implementation
        const capabilityName = taskSpec.capabilityRef || taskSpec.capability;
        if (!capabilityName) {
          throw new Error(`Task ${taskId} missing capability reference`);
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
          goalIntent: this.options.goal.intent,
          planId: plan.id,
          taskId,
          contextRef: plan.contextRef,
          context: state.context,
          llmCall: this.options.nucleusConfig.llmCall,
          hooks: this.options.nucleusConfig.hooks,
          allowedTools: Array.from(allowedTools),
        });

        const internalScope = new InternalContextScopeImpl(entry => {
          this.options.ledger?.append(entry.type, entry.details);
        });
        nucleus.setInternalContext(internalScope);

        const getTool = createInstrumentedToolGetter({
          taskId,
          capability: capabilityName,
          toolRegistry,
          ledger: this.options.ledger,
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
            `Task ${taskId} requires additional context retrieval: ${preflight.retrievalDirectives.join(', ')}`
          );
        }

        // Policy pre-check
        if (policy) {
          const policyInput = task.policyInput?.(runContext, taskSpec.input || state.input) || {};
          
          const decision = await policy.evaluate('task.pre', {
            action: taskSpec.capability,
            input: policyInput,
            context: state.context,
          });

          if (!decision.allow) {
            throw new Error(`Policy denied execution of ${taskSpec.capability}`);
          }
        }

        // Execute task
        stream?.emit('task', { taskId, status: 'started' });

  const output = await task.execute(runContext, taskSpec.input || state.input);

        // Update outputs map
        const newOutputs = new Map(state.outputs);
        newOutputs.set(taskId, output);

        stream?.emit('task', { taskId, status: 'completed', output });

        // Log to ledger
        if (ledger) {
          ledger.append('TASK_END', { taskId, capability: taskSpec.capability });
        }

        const postcheck = await nucleus.postcheck(output);
        if (postcheck.status === 'NEEDS_COMPENSATION' || postcheck.status === 'ESCALATE') {
          throw new Error(`Task ${taskId} postcheck failed: ${postcheck.reason}`);
        }

        return {
          taskId,
          output,
          outputs: newOutputs,
        };
      } catch (error) {
        stream?.emit('task', { taskId, status: 'failed', error });

        if (ledger) {
          ledger.append('ERROR', { taskId, error: String(error) });
        }

        return {
          taskId,
          error: error as Error,
        };
      }
    };
  }

  /**
   * Create guard evaluator for conditional edges
   */
  private createGuardEvaluator(guard?: string) {
    if (!guard) {
      return () => true;
    }

    return (state: GraphState): boolean => {
      try {
        // Simple guard evaluation
        const func = new Function('state', 'outputs', `return ${guard}`);
        return func(state, Object.fromEntries(state.outputs));
      } catch {
        return false;
      }
    };
  }

  /**
   * Build LangGraph structure
   * 
   * Returns a configuration object that can be used with LangGraph's StateGraph
   */
  buildGraph(): {
    nodes: Map<string, (state: GraphState) => Promise<Partial<GraphState>>>;
    edges: Array<{ from: string; to: string; condition?: (state: GraphState) => boolean }>;
    entryPoint: string;
  } {
    const { plan } = this.options;
    const nodes = new Map<string, (state: GraphState) => Promise<Partial<GraphState>>>();
    const edges: Array<{ from: string; to: string; condition?: (state: GraphState) => boolean }> = [];

    // Create nodes for each task
    for (const task of plan.tasks) {
      nodes.set(task.id, this.createNodeFunction(task.id));
    }

    // Create edges
    for (const edge of plan.edges) {
      edges.push({
        from: edge.from,
        to: edge.to,
        condition: edge.guard ? this.createGuardEvaluator(edge.guard) : undefined,
      });
    }

    // Find entry point (task with no incoming edges)
    const hasIncoming = new Set(plan.edges.map((e) => e.to));
    const entryPoint = plan.tasks.find((t) => !hasIncoming.has(t.id))?.id || plan.tasks[0]?.id;

    if (!entryPoint) {
      throw new Error('No entry point found in plan');
    }

    return { nodes, edges, entryPoint };
  }

  /**
   * Execute the plan using LangGraph (if available)
   * 
   * Note: This is a simplified implementation. In practice, you would use
   * LangGraph's StateGraph API directly with the graph structure.
   */
  async execute(): Promise<{ outputsByTask: Record<string, any>; ledger: readonly any[] }> {
    const { nodes, edges, entryPoint } = this.buildGraph();
    
    // Initialize state
    const state: GraphState = {
      taskId: entryPoint,
      input: {},
      context: this.options.context,
      outputs: new Map(),
    };

    // Simple sequential execution based on edges
    // In a real implementation, this would use LangGraph's execution engine
    let currentTaskId: string | null = entryPoint;
    const visited = new Set<string>();

    while (currentTaskId && !visited.has(currentTaskId)) {
      visited.add(currentTaskId);
      
      const nodeFunc = nodes.get(currentTaskId);
      if (!nodeFunc) break;

      const result = await nodeFunc(state);
      Object.assign(state, result);

      // Find next task
      const outgoingEdges = edges.filter((e) => e.from === currentTaskId);
      currentTaskId = null;

      for (const edge of outgoingEdges) {
        if (!edge.condition || edge.condition(state)) {
          currentTaskId = edge.to;
          break;
        }
      }
    }

    return {
      outputsByTask: Object.fromEntries(state.outputs),
      ledger: this.options.ledger?.getEntries() || [],
    };
  }
}

/**
 * Helper function to create a LangGraph adapter
 */
export function asLangGraph(options: LangGraphAdapterOptions): LangGraphAdapter {
  return new LangGraphAdapter(options);
}
