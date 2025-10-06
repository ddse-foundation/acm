// Structured tool-call based planner (Phase 4)
import {
  ContextBuilder,
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

    const preflight = await nucleus.preflight();
    if (preflight.status === 'NEEDS_CONTEXT') {
      throw new Error(
        `Planner requires additional context retrieval before proceeding: ${preflight.retrievalDirectives.join(', ')}`
      );
    }

    const prompt = this.buildPrompt(goal, context, capabilities, planCount);
    const result = await nucleus.invoke({ prompt, tools: PLANNER_TOOLS });
    const plans = this.convertToolCalls(result, contextRef, capabilityMapVersion);

    if (plans.length === 0) {
      throw new Error('Nucleus did not emit any structured plans.');
    }

    await nucleus.postcheck({ plans: plans.map(plan => ({ id: plan.id, tasks: plan.tasks.length })) });

    const rationale = result.reasoning ?? plans.map(p => p.rationale).find(Boolean);

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

  private buildPrompt(goal: Goal, context: Context, capabilities: Capability[], planCount: 1 | 2): string {
    const capList = capabilities.map(c => `- ${c.name}`).join('\n');

    return `You are an expert task planner. Given a goal and context, create ${
      planCount === 2 ? 'two alternative' : 'one'
    } execution plan${planCount === 2 ? 's' : ''}.

**Goal:**
${goal.intent}
${goal.constraints ? `\n**Constraints:**\n${JSON.stringify(goal.constraints, null, 2)}` : ''}

**Context Facts:**
${JSON.stringify(context.facts, null, 2)}

**Available Capabilities:**
${capList}

**Instructions:**
${
  planCount === 2
    ? '1. Create TWO different plans (plan-a and plan-b) by calling emit_plan twice\n2. Each plan should take a different approach to achieve the goal'
    : '1. Create ONE plan (plan-a) by calling emit_plan'
}
${planCount === 2 ? '3' : '2'}. Each task must reference a capability from the available list
${planCount === 2 ? '4' : '3'}. Define edges to show task dependencies
${planCount === 2 ? '5' : '4'}. Include a rationale explaining your planning decisions

Call the emit_plan tool ${planCount === 2 ? 'twice (once for each plan)' : 'once'} with the plan structure.`;
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
