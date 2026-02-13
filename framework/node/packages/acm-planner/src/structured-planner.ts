// Structured tool-call based planner (Phase 4)
import {
  ContextBuilder,
  InternalContextScopeImpl,
  ExternalContextProviderAdapter,
  type Capability,
  type Context,
  type Goal,
  type NucleusConfig,
  type NucleusFactory,
  type NucleusInvokeResult,
  type NucleusToolDefinition,
  type Plan,
  type StreamSink,
} from '@ddse/acm-sdk';

export type PlannerOptions = {
  goal: Goal;
  context: Context;
  capabilities: Capability[];
  nucleusFactory: NucleusFactory;
  nucleusConfig: {
    llmCall: NucleusConfig['llmCall'];
    hooks?: NucleusConfig['hooks'];
    allowedTools?: string[];
  };
  contextProvider?: ExternalContextProviderAdapter;
  stream?: StreamSink;
  capabilityMapVersion?: string;
  planCount?: 1 | 2;
  planId?: string;
};

export type PlannerResult = {
  plans: Plan[];
  contextRef: string;
  rationale?: string;
};

const PLANNER_TOOLS: NucleusToolDefinition[] = [
  {
    name: 'emit_plan',
    description: 'Emit a plan with tasks and edges',
    inputSchema: {
      type: 'object',
      properties: {
        planId: { type: 'string', description: 'Plan identifier (plan-a, plan-b, etc.)' },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string', description: 'Human-friendly task label' },
              objective: { type: 'string', description: 'Task objective, authored by the Nucleus' },
              successCriteria: {
                type: 'array',
                items: { type: 'string' },
                description: 'Observable success criteria for the task',
              },
              capability: { type: 'string' },
              input: { type: 'object' },
            },
            required: ['id', 'capability'],
          },
        },
        edges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              guard: { type: 'string' },
            },
            required: ['from', 'to'],
          },
        },
        rationale: { type: 'string', description: 'Explanation for this plan' },
      },
      required: ['planId', 'tasks', 'edges'],
    },
  },
];

export class StructuredLLMPlanner {
  async plan(options: PlannerOptions): Promise<PlannerResult> {
    const {
      goal,
      context,
      capabilities,
      nucleusFactory,
      nucleusConfig,
      stream,
      capabilityMapVersion = 'v1',
    } = options;
    const planCount: 1 | 2 = options.planCount ?? 1;

    const contextRef = ContextBuilder.computeContextRef(context);
    const nucleus = nucleusFactory({
      goalId: goal.id,
      goalIntent: goal.intent,
      planId: options.planId ?? `planner-${Date.now()}`,
      contextRef,
      context,
      llmCall: nucleusConfig.llmCall,
      hooks: nucleusConfig.hooks,
      allowedTools: Array.from(new Set([...(nucleusConfig.allowedTools ?? []), 'emit_plan'])),
    });

    let preflight = await nucleus.preflight();
    if (preflight.status === 'NEEDS_CONTEXT') {
      const requestedDirectives = preflight.retrievalDirectives;

      if (!options.contextProvider) {
        throw new Error(
          `Planner requires additional context retrieval but no contextProvider configured: ${requestedDirectives.join(', ')}`
        );
      }

      const internalScope = new InternalContextScopeImpl();
      nucleus.setInternalContext(internalScope);

      await options.contextProvider.fulfill({
        directives: requestedDirectives,
        scope: internalScope,
        nucleus,
      });

      preflight = await nucleus.preflight();
      if (preflight.status === 'NEEDS_CONTEXT') {
        throw new Error(
          `Planner still requires additional context after retrieval: ${preflight.retrievalDirectives.join(', ')}`
        );
      }
    }

    // ── Stage 1: Think — analyze goal and plan decomposition (no tools) ──
    const thinkingPrompt = this.buildThinkingPrompt(goal, context, capabilities, planCount);
    if (stream) {
      stream.emit('planner', { phase: 'thinking', done: false });
    }
    const thinkResult = await nucleus.invoke({ prompt: thinkingPrompt, tools: [] });
    const analysis = thinkResult.reasoning?.trim() ?? '';

    if (stream) {
      stream.emit('planner', {
        phase: 'thinking',
        done: true,
        analysis: analysis.slice(0, 500),
      });
    }

    // ── Stage 2: Emit — produce structured plan using analysis ───────────
    const emitPrompt = this.buildEmitPrompt(goal, context, capabilities, planCount, analysis);
    if (stream) {
      stream.emit('planner', { phase: 'structuring', done: false });
    }
    const result = await nucleus.invoke({ prompt: emitPrompt, tools: PLANNER_TOOLS });
    const plans = this.convertToolCalls(result, contextRef, capabilityMapVersion);

    if (plans.length === 0) {
      throw new Error('Nucleus did not emit any structured plans.');
    }

    await nucleus.postcheck({ plans: plans.map(plan => ({ id: plan.id, tasks: plan.tasks.length })) });

    const rationale = result.reasoning ?? analysis ?? plans.map(p => p.rationale).find(Boolean);

    if (stream) {
      stream.emit('planner', {
        done: true,
        plans: plans.length,
        rationale,
      });
    }

    return {
      plans,
      contextRef,
      rationale,
    };
  }

  /**
   * Stage 1 prompt: Ask the LLM to analyze the goal WITHOUT calling any tool.
   * This gives the model a full reasoning pass before it has to produce structure.
   */
  private buildThinkingPrompt(
    goal: Goal,
    context: Context,
    capabilities: Capability[],
    planCount: 1 | 2
  ): string {
    const capList = capabilities.map(c => `- ${c.name}`).join('\n');
    const constraints = goal.constraints
      ? `\n**Constraints:**\n${JSON.stringify(goal.constraints, null, 2)}`
      : '';

    return `You are an expert task planner. Analyze the following goal and plan your decomposition strategy.
Do NOT produce a final plan yet — just think through the problem.

**Goal:**
${goal.intent}
${constraints}

**Context Facts:**
${JSON.stringify(context.facts, null, 2)}

**Available Capabilities:**
${capList}

**Your analysis MUST cover:**
1. What are the distinct modules, components, or concerns in this goal?
2. For each module, which artifact types are needed? (List them explicitly)
3. What is the dependency order? Which artifacts must be created before others?
4. How many tasks will you need? (One task per artifact instance — NOT per type)
5. What capability from the list above maps to each artifact?

Write your analysis as a structured breakdown. Be thorough — this analysis will guide the final plan.`;
  }

  /**
   * Stage 2 prompt: Given the analysis from Stage 1, produce the structured plan
   * by calling emit_plan.
   */
  private buildEmitPrompt(
    goal: Goal,
    context: Context,
    capabilities: Capability[],
    planCount: 1 | 2,
    analysis: string
  ): string {
    const capList = capabilities.map(c => `- ${c.name}`).join('\n');
    const constraints = goal.constraints
      ? `\n**Constraints:**\n${JSON.stringify(goal.constraints, null, 2)}`
      : '';

    return `You are an expert task planner. You have already analyzed the goal. Now produce the structured plan.

**Goal:**
${goal.intent}
${constraints}

**Your Prior Analysis:**
${analysis || '(No analysis available — decompose the goal directly.)'}

**Available Capabilities:**
${capList}

**Instructions:**
${
  planCount === 2
    ? '1. Create TWO different plans (plan-a and plan-b) by calling emit_plan twice\n2. Each plan should take a different approach to achieve the goal'
    : '1. Create ONE plan (plan-a) by calling emit_plan'
}
${planCount === 2 ? '3' : '2'}. Each task MUST reference a capability from the available list
${planCount === 2 ? '4' : '3'}. Each task MUST have a descriptive title and populate the input object with at minimum: artifactTypeId, title, description
${planCount === 2 ? '5' : '4'}. Define edges to show task dependencies (parent artifacts before children)
${planCount === 2 ? '6' : '5'}. Include a rationale explaining your planning decisions
${planCount === 2 ? '7' : '6'}. Follow your analysis above — create ALL the tasks you identified, not fewer

Call the emit_plan tool ${planCount === 2 ? 'twice (once for each plan)' : 'once'} with the complete plan structure.`;
  }

  private convertToolCalls(
    result: NucleusInvokeResult,
    contextRef: string,
    capabilityMapVersion: string
  ): Plan[] {
    const plans: Plan[] = [];

    for (const call of result.toolCalls) {
      if (call.name !== 'emit_plan') {
        continue;
      }

      const args = call.input ?? {};
      const planId = (args.planId as string) || `plan-${plans.length + 1}`;

      const tasks = Array.isArray(args.tasks)
        ? args.tasks.map((task: any, index: number) => ({
            id: task.id ?? `task-${index + 1}`,
            title: typeof task.title === 'string' ? task.title : undefined,
            objective: typeof task.objective === 'string' ? task.objective : undefined,
            successCriteria: Array.isArray(task.successCriteria)
              ? task.successCriteria.filter((item: any) => typeof item === 'string')
              : undefined,
            capability: task.capability,
            capabilityRef: task.capability,
            input: task.input ?? {},
          }))
        : [];

      const edges = Array.isArray(args.edges) ? args.edges : [];

      plans.push({
        id: planId,
        contextRef,
        capabilityMapVersion,
        tasks,
        edges,
        rationale: typeof args.rationale === 'string' ? args.rationale : undefined,
      });
    }

    return plans;
  }
}
