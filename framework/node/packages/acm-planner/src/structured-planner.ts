// Structured tool-call based planner (Phase 4)
import type { Goal, Context, Plan, Capability, StreamSink, ToolCallEnvelope } from '@acm/sdk';
import type { LLM, ToolDefinition } from '@acm/llm';
import { ContextBuilder } from '@acm/sdk';
import { createHash } from 'crypto';

export type PlannerOptions = {
  goal: Goal;
  context: Context;
  capabilities: Capability[];
  llm: LLM;
  stream?: StreamSink;
  capabilityMapVersion?: string;
  planCount?: 1 | 2;
};

export type PlannerResult = {
  plans: Plan[];
  contextRef: string;
  rationale?: string;
};

// Define planner tools
const PLANNER_TOOLS: ToolDefinition[] = [
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
    const { goal, context, capabilities, llm, stream, capabilityMapVersion = 'v1' } = options;
    const planCount: 1 | 2 = options.planCount ?? 1;

    // Compute context reference using proper hashing
    const contextRef = ContextBuilder.computeContextRef(context);

    // Build prompt for structured tool calls
    const prompt = this.buildPrompt(goal, context, capabilities, planCount);

    // Check if LLM supports tool calls
    if (!llm.generateWithTools) {
      console.warn('LLM does not support tool calls, falling back to legacy planner');
      return this.fallbackPlan(contextRef, capabilityMapVersion, capabilities, planCount);
    }

    try {
      // Generate with tools
      const response = await llm.generateWithTools(
        [{ role: 'user', content: prompt }],
        PLANNER_TOOLS,
        { temperature: 0.7, seed: Date.now() }
      );

      // Convert tool calls to plans
      const plans: Plan[] = [];
      let rationale: string | undefined;

      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          if (toolCall.name === 'emit_plan') {
            const args = toolCall.arguments;
            plans.push({
              id: args.planId || `plan-${plans.length + 1}`,
              contextRef,
              capabilityMapVersion,
              tasks: (args.tasks || []).map((t: any) => ({
                id: t.id,
                capability: t.capability,
                capabilityRef: t.capability, // Use same value for both
                input: t.input || {},
              })),
              edges: args.edges || [],
            });

            if (args.rationale && !rationale) {
              rationale = args.rationale;
            }
          }
        }
      }

      // If we got plans from tool calls, return them
      if (plans.length > 0) {
        if (stream) {
          stream.emit('planner', { 
            done: true, 
            plans: plans.length,
            rationale 
          });
        }

        return {
          plans,
          contextRef,
          rationale: rationale || response.text,
        };
      }

      // No tool calls, try to extract from text (legacy fallback)
      console.warn('No tool calls received, attempting text parsing fallback');
      return this.parseTextResponse(response.text || '', contextRef, capabilityMapVersion, capabilities);

    } catch (err) {
      console.error('Structured planner failed:', err);
      return this.fallbackPlan(contextRef, capabilityMapVersion, capabilities, planCount);
    }
  }

  private buildPrompt(goal: Goal, context: Context, capabilities: Capability[], planCount: 1 | 2): string {
    const capList = capabilities.map(c => `- ${c.name}`).join('\n');

    return `You are an expert task planner. Given a goal and context, create ${planCount === 2 ? 'two alternative' : 'one'} execution plan${planCount === 2 ? 's' : ''}.

**Goal:**
${goal.intent}
${goal.constraints ? `\n**Constraints:**\n${JSON.stringify(goal.constraints, null, 2)}` : ''}

**Context Facts:**
${JSON.stringify(context.facts, null, 2)}

**Available Capabilities:**
${capList}

**Instructions:**
${planCount === 2 
  ? '1. Create TWO different plans (plan-a and plan-b) by calling emit_plan twice\n2. Each plan should take a different approach to achieve the goal'
  : '1. Create ONE plan (plan-a) by calling emit_plan'
}
${planCount === 2 ? '3' : '2'}. Each task must reference a capability from the available list
${planCount === 2 ? '4' : '3'}. Define edges to show task dependencies
${planCount === 2 ? '5' : '4'}. Include a rationale explaining your planning decisions

Call the emit_plan tool ${planCount === 2 ? 'twice (once for each plan)' : 'once'} with the plan structure.`;
  }

  private parseTextResponse(
    response: string,
    contextRef: string,
    capabilityMapVersion: string,
    capabilities: Capability[]
  ): PlannerResult {
    // Legacy JSON parsing fallback
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const plans: Plan[] = [];

      if (parsed.planA) {
        plans.push({
          id: 'plan-a',
          contextRef,
          capabilityMapVersion,
          tasks: (parsed.planA.tasks || []).map((t: any) => ({
            ...t,
            capabilityRef: t.capability,
          })),
          edges: parsed.planA.edges || [],
        });
      }

      if (parsed.planB) {
        plans.push({
          id: 'plan-b',
          contextRef,
          capabilityMapVersion,
          tasks: (parsed.planB.tasks || []).map((t: any) => ({
            ...t,
            capabilityRef: t.capability,
          })),
          edges: parsed.planB.edges || [],
        });
      }

      if (plans.length > 0) {
        return {
          plans,
          contextRef,
          rationale: parsed.rationale,
        };
      }
    } catch (err) {
      console.error('Failed to parse text response:', err);
    }

    // If all else fails, use fallback
    return this.fallbackPlan(contextRef, capabilityMapVersion, capabilities, 1);
  }

  private fallbackPlan(
    contextRef: string,
    capabilityMapVersion: string,
    capabilities: Capability[],
    planCount: 1 | 2
  ): PlannerResult {
    const selectedCapabilities = capabilities.slice(0, Math.min(capabilities.length, 3));

    const tasks = selectedCapabilities.map((capability, index) => ({
      id: `t${index + 1}`,
      capability: capability.name,
      capabilityRef: capability.name,
      input: {},
    }));

    const edges = tasks
      .slice(0, -1)
      .map((task, index) => ({ from: task.id, to: tasks[index + 1].id }));

    const planA: Plan = {
      id: 'plan-fallback',
      contextRef,
      capabilityMapVersion,
      tasks,
      edges,
    };

    const plans = [planA];

    // If 2 plans requested, create a variant
    if (planCount === 2 && tasks.length > 1) {
      const reversedTasks = [...tasks].reverse().map((t, i) => ({
        ...t,
        id: `t${i + 1}`,
      }));
      const reversedEdges = reversedTasks
        .slice(0, -1)
        .map((task, index) => ({ from: task.id, to: reversedTasks[index + 1].id }));

      plans.push({
        id: 'plan-fallback-alt',
        contextRef,
        capabilityMapVersion,
        tasks: reversedTasks,
        edges: reversedEdges,
      });
    }

    return {
      plans,
      contextRef,
      rationale: 'Fallback plan: Unable to generate structured plan',
    };
  }
}
