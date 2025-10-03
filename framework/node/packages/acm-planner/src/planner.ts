// LLM-based planner
import type { Goal, Context, Plan, Capability, StreamSink } from '@acm/sdk';
import type { LLM } from '@acm/llm';
import { createHash } from 'crypto';

export type PlannerOptions = {
  goal: Goal;
  context: Context;
  capabilities: Capability[];
  llm: LLM;
  stream?: StreamSink;
  capabilityMapVersion?: string;
};

export type PlannerResult = {
  plans: Plan[];
  contextRef: string;
  rationale?: string;
};

export class LLMPlanner {
  async plan(options: PlannerOptions): Promise<PlannerResult> {
    const { goal, context, capabilities, llm, stream, capabilityMapVersion = 'v1' } = options;

    // Compute context reference (hash)
    const contextRef = this.computeContextRef(context);

    // Build prompt
    const prompt = this.buildPrompt(goal, context, capabilities);

    // Stream to callback if provided
    if (stream && llm.generateStream) {
      let fullResponse = '';
      
      for await (const chunk of llm.generateStream(
        [{ role: 'user', content: prompt }],
        { temperature: 0.7 }
      )) {
        if (!chunk.done && chunk.delta) {
          fullResponse += chunk.delta;
          stream.emit('planner', { delta: chunk.delta });
        }
      }

      stream.emit('planner', { done: true });

      // Parse response
      return this.parseResponse(fullResponse, contextRef, capabilityMapVersion);
    } else {
      // Non-streaming
      const response = await llm.generate(
        [{ role: 'user', content: prompt }],
        { temperature: 0.7 }
      );

      return this.parseResponse(response.text, contextRef, capabilityMapVersion);
    }
  }

  private buildPrompt(goal: Goal, context: Context, capabilities: Capability[]): string {
    const capList = capabilities.map(c => c.name).join(', ');
    
    return `You are a task planner. Given a goal and context, generate two alternative execution plans (Plan-A and Plan-B).

Goal: ${goal.intent}
${goal.constraints ? `Constraints: ${JSON.stringify(goal.constraints)}` : ''}

Context facts: ${JSON.stringify(context.facts)}

Available capabilities: ${capList}

Generate two plans in the following JSON format:
{
  "planA": {
    "tasks": [
      { "id": "t1", "capability": "capability_name", "input": {} }
    ],
    "edges": [
      { "from": "t1", "to": "t2" }
    ]
  },
  "planB": {
    "tasks": [
      { "id": "t1", "capability": "capability_name", "input": {} }
    ],
    "edges": [
      { "from": "t1", "to": "t2" }
    ]
  },
  "rationale": "Brief explanation of the plans"
}

Respond with valid JSON only.`;
  }

  private parseResponse(
    response: string,
    contextRef: string,
    capabilityMapVersion: string
  ): PlannerResult {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const plans: Plan[] = [];

      // Plan A
      if (parsed.planA) {
        plans.push({
          id: 'plan-a',
          contextRef,
          capabilityMapVersion,
          tasks: parsed.planA.tasks || [],
          edges: parsed.planA.edges || [],
        });
      }

      // Plan B
      if (parsed.planB) {
        plans.push({
          id: 'plan-b',
          contextRef,
          capabilityMapVersion,
          tasks: parsed.planB.tasks || [],
          edges: parsed.planB.edges || [],
        });
      }

      if (plans.length === 0) {
        throw new Error('No valid plans in response');
      }

      return {
        plans,
        contextRef,
        rationale: parsed.rationale,
      };
    } catch (err) {
      console.error('Failed to parse LLM response, using fallback plan:', err);
      return this.createFallbackPlan(contextRef, capabilityMapVersion);
    }
  }

  private createFallbackPlan(contextRef: string, capabilityMapVersion: string): PlannerResult {
    // Simple linear fallback plan
    const plan: Plan = {
      id: 'plan-fallback',
      contextRef,
      capabilityMapVersion,
      tasks: [
        {
          id: 't1',
          capability: 'search',
          input: {},
        },
      ],
      edges: [],
    };

    return {
      plans: [plan],
      contextRef,
      rationale: 'Fallback plan: LLM parsing failed',
    };
  }

  private computeContextRef(context: Context): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(context));
    return hash.digest('hex').substring(0, 16);
  }
}
