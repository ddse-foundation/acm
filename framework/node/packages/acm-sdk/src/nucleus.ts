// Nucleus contract for LLM-native task and planner execution
import { createHash } from 'crypto';
import type { Context, InternalContextScope, LedgerEntry, ToolCallEnvelope } from './types.js';

export type NucleusToolDefinition = {
  name: string;
  description?: string;
  inputSchema?: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
};

export type StructuredToolCall = {
  id?: string;
  name: string;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: {
    code: string;
    message: string;
  };
};

export type NucleusInvokeRequest = {
  prompt?: string;
  input?: any;
  tools?: NucleusToolDefinition[];
};

export type NucleusInvokeResult = {
  reasoning?: string;
  toolCalls: StructuredToolCall[];
  raw?: any;
};

// Nucleus configuration
export type NucleusConfig = {
  goalId: string;
  goalIntent: string;
  planId?: string;
  taskId?: string;
  contextRef: string;
  context?: Context;
  llmCall: {
    provider: string;
    model: string;
    temperature?: number;
    seed?: number;
    maxTokens?: number;
  };
  allowedTools?: string[];
  hooks?: {
    preflight?: boolean;
    postcheck?: boolean;
  };
  promptTemplate?: string;
  promptDigest?: string;
};

export type PreflightResult =
  | { status: 'OK' }
  | { status: 'NEEDS_CONTEXT'; retrievalDirectives: string[] };

export type PostcheckResult =
  | { status: 'COMPLETE' }
  | { status: 'NEEDS_COMPENSATION'; reason: string }
  | { status: 'ESCALATE'; reason: string };

export type LLMCallFn = (
  prompt: string,
  tools: NucleusToolDefinition[],
  config: NucleusConfig['llmCall']
) => Promise<{
  reasoning?: string;
  toolCalls: StructuredToolCall[];
  raw?: any;
}>;

export abstract class Nucleus {
  constructor(protected config: NucleusConfig) {}

  abstract preflight(): Promise<PreflightResult>;
  abstract invoke(request: NucleusInvokeRequest): Promise<NucleusInvokeResult>;
  abstract postcheck(output: any): Promise<PostcheckResult>;

  abstract recordInference(
    promptDigest: string,
    toolCalls: StructuredToolCall[],
    reasoning?: string
  ): LedgerEntry;

  abstract getInternalContext(): InternalContextScope | undefined;
  abstract setInternalContext(scope: InternalContextScope): void;

  getConfig(): NucleusConfig {
    return this.config;
  }
}

export class DeterministicNucleus extends Nucleus {
  private internalContext?: InternalContextScope;
  private ledger: LedgerEntry[] = [];

  constructor(
    config: NucleusConfig,
    private llmCall: LLMCallFn,
    private ledgerAppend: (entry: LedgerEntry) => void
  ) {
    super(config);
    if (!config.goalIntent || config.goalIntent.trim().length === 0) {
      throw new Error('NucleusConfig.goalIntent is required for nucleus execution.');
    }
  }

  async preflight(): Promise<PreflightResult> {
    if (!this.config.hooks?.preflight) {
      return { status: 'OK' };
    }

    const prompt = this.buildPreflightPrompt();
    const result = await this.callLLM(prompt);

    const needsContext = result.toolCalls.some(
      tc => tc.name === 'request_context_retrieval'
    );

    if (needsContext) {
      const directives = result.toolCalls
        .filter(tc => tc.name === 'request_context_retrieval')
        .map(tc => tc.input?.directive as string)
        .filter(Boolean);
      return {
        status: 'NEEDS_CONTEXT',
        retrievalDirectives: directives,
      };
    }

    return { status: 'OK' };
  }

  async invoke(request: NucleusInvokeRequest): Promise<NucleusInvokeResult> {
    const prompt = request.prompt ?? this.buildInvokePrompt(request.input);
    return this.callLLM(prompt, request.tools);
  }

  async postcheck(output: any): Promise<PostcheckResult> {
    if (!this.config.hooks?.postcheck) {
      return { status: 'COMPLETE' };
    }

    const prompt = this.buildPostcheckPrompt(output);
    const result = await this.callLLM(prompt);

    const compensation = result.toolCalls.find(tc => tc.name === 'request_compensation');
    if (compensation) {
      return {
        status: 'NEEDS_COMPENSATION',
        reason: (compensation.input?.reason as string) || 'Unknown',
      };
    }

    const escalation = result.toolCalls.find(tc => tc.name === 'escalate_issue');
    if (escalation) {
      return {
        status: 'ESCALATE',
        reason: (escalation.input?.reason as string) || 'Unknown',
      };
    }

    return { status: 'COMPLETE' };
  }

  recordInference(
    promptDigest: string,
    toolCalls: StructuredToolCall[],
    reasoning?: string
  ): LedgerEntry {
    const envelopes: ToolCallEnvelope[] = toolCalls.map((tc, idx) => ({
      id: tc.id ?? `tool-call-${Date.now()}-${idx}`,
      name: tc.name,
      input: tc.input ?? {},
      output: tc.output,
      error: tc.error,
      metadata: {
        timestamp: Date.now(),
        digest: this.computeDigest(JSON.stringify(tc.input ?? {})),
      },
    }));

    const entry: LedgerEntry = {
      id: `nucleus-inference-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      ts: Date.now(),
      type: 'NUCLEUS_INFERENCE',
      details: {
        nucleus: {
          goalId: this.config.goalId,
          planId: this.config.planId,
          taskId: this.config.taskId,
          contextRef: this.config.contextRef,
        },
        llmCall: {
          provider: this.config.llmCall.provider,
          model: this.config.llmCall.model,
          seed: this.config.llmCall.seed,
        },
        promptDigest,
        reasoning,
        toolCalls: envelopes.map(env => ({
          id: env.id,
          name: env.name,
          inputDigest: env.metadata?.digest,
          outputDigest: env.output ? this.computeDigest(JSON.stringify(env.output)) : undefined,
        })),
      },
    };

    entry.digest = this.computeDigest(JSON.stringify(entry.details));
    this.ledger.push(entry);
    this.ledgerAppend(entry);
    return entry;
  }

  getInternalContext(): InternalContextScope | undefined {
    return this.internalContext;
  }

  setInternalContext(scope: InternalContextScope): void {
    this.internalContext = scope;
  }

  private async callLLM(
    prompt: string,
    tools: NucleusToolDefinition[] = []
  ): Promise<NucleusInvokeResult> {
    const result = await this.llmCall(prompt, tools, this.config.llmCall);
    const normalizedCalls = (result.toolCalls ?? []).map((tc, idx) => ({
      id: tc.id ?? `tool-call-${Date.now()}-${idx}`,
      name: tc.name,
      input: tc.input ?? {},
      output: tc.output,
      error: tc.error,
    }));

    this.recordInference(this.computePromptDigest(prompt), normalizedCalls, result.reasoning);

    return {
      reasoning: result.reasoning,
      toolCalls: normalizedCalls,
      raw: result.raw,
    };
  }

  private buildPreflightPrompt(): string {
    return `Assess whether the current context is sufficient for the task.
Goal: ${this.config.goalId}
Goal Intent: ${this.config.goalIntent}
Task: ${this.config.taskId || 'planner'}
Context Ref: ${this.config.contextRef}

Context Snapshot:
${this.renderContextSnapshot()}

If additional context is needed, call request_context_retrieval with a directive.`;
  }

  private buildInvokePrompt(input: any): string {
    return `Execute the task with the following input:
${JSON.stringify(input, null, 2)}

Goal: ${this.config.goalId}
Goal Intent: ${this.config.goalIntent}
Task: ${this.config.taskId || 'planner'}

Relevant Context:
${this.renderContextSnapshot()}`;
  }

  private buildPostcheckPrompt(output: any): string {
    return `Validate the output and determine if any follow-up is needed:
${JSON.stringify(output, null, 2)}

Goal: ${this.config.goalId}
Goal Intent: ${this.config.goalIntent}
Task: ${this.config.taskId || 'planner'}

Context Reference: ${this.config.contextRef}

If compensation is needed, call request_compensation.
If escalation is needed, call escalate_issue.`;
  }

  private computePromptDigest(prompt: string): string {
    const hash = createHash('sha256');
    hash.update(prompt);
    return hash.digest('hex').substring(0, 16);
  }

  private computeDigest(content: string): string {
    const hash = createHash('sha256');
    hash.update(content);
    return hash.digest('hex').substring(0, 16);
  }

  private renderContextSnapshot(): string {
    const context = this.config.context;
    if (!context) {
      return '(No context payload provided; consider supplying context.facts to the nucleus.)';
    }

    const pieces: string[] = [];

    if (context.facts && Object.keys(context.facts).length > 0) {
      pieces.push(`Facts:\n${JSON.stringify(context.facts, null, 2)}`);
    } else {
      pieces.push('Facts: {}');
    }

    if (context.assumptions && context.assumptions.length > 0) {
      pieces.push(`Assumptions:\n- ${context.assumptions.join('\n- ')}`);
    }

    if (context.constraints_inherited && Object.keys(context.constraints_inherited).length > 0) {
      pieces.push(
        `Inherited Constraints:\n${JSON.stringify(context.constraints_inherited, null, 2)}`
      );
    }

    if (context.augmentations && context.augmentations.length > 0) {
      const augmentations = context.augmentations
        .map(aug => `- ${aug.type}: ${aug.artifact}`)
        .join('\n');
      pieces.push(`Augmentations:\n${augmentations}`);
    }

    return pieces.join('\n\n');
  }
}

export type NucleusFactory = (config: NucleusConfig) => Nucleus;
