// Nucleus contract for LLM-native task and planner execution

import type { ToolCallEnvelope, InternalContextScope, LedgerEntry } from './types.js';

// Nucleus configuration
export type NucleusConfig = {
  // Binding information
  goalId: string;
  planId?: string;
  taskId?: string;
  contextRef: string;

  // LLM call settings
  llmCall: {
    provider: string;
    model: string;
    temperature?: number;
    seed?: number;
    maxTokens?: number;
  };

  // Allowed tools for internal operations
  allowedTools?: string[];

  // Hook definitions
  hooks?: {
    preflight?: boolean;
    postcheck?: boolean;
  };

  // Prompt configuration
  promptTemplate?: string;
  promptDigest?: string;
};

// Nucleus hook results
export type PreflightResult = 
  | { status: 'OK' }
  | { status: 'NEEDS_CONTEXT'; retrievalDirectives: string[] };

export type PostcheckResult = 
  | { status: 'COMPLETE' }
  | { status: 'NEEDS_COMPENSATION'; reason: string }
  | { status: 'ESCALATE'; reason: string };

// LLM call interface using structured tool-call envelope
export type LLMCallFn = (
  prompt: string,
  tools: ToolCallEnvelope[],
  config: NucleusConfig['llmCall']
) => Promise<{
  reasoning?: string;
  toolCalls: ToolCallEnvelope[];
  raw?: any;
}>;

// Abstract Nucleus class
export abstract class Nucleus {
  constructor(protected config: NucleusConfig) {}

  // Lifecycle hooks
  abstract preflight(): Promise<PreflightResult>;
  abstract invoke(input: any): Promise<any>;
  abstract postcheck(output: any): Promise<PostcheckResult>;

  // Record inference to ledger
  abstract recordInference(
    promptDigest: string,
    toolCalls: ToolCallEnvelope[],
    reasoning?: string
  ): LedgerEntry;

  // Access internal context
  abstract getInternalContext(): InternalContextScope | undefined;

  // Get configuration
  getConfig(): NucleusConfig {
    return this.config;
  }
}

// Deterministic Nucleus base implementation
export class DeterministicNucleus extends Nucleus {
  private internalContext?: InternalContextScope;
  private ledger: LedgerEntry[] = [];

  constructor(
    config: NucleusConfig,
    private llmCall: LLMCallFn,
    private ledgerAppend: (entry: LedgerEntry) => void
  ) {
    super(config);
  }

  async preflight(): Promise<PreflightResult> {
    if (!this.config.hooks?.preflight) {
      return { status: 'OK' };
    }

    // Execute LLM call to assess context sufficiency
    const prompt = this.buildPreflightPrompt();
    const result = await this.llmCall(prompt, [], this.config.llmCall);

    // Record inference
    const entry = this.recordInference(
      this.computePromptDigest(prompt),
      result.toolCalls,
      result.reasoning
    );

    // Check if context retrieval is needed
    const needsContext = result.toolCalls.some(
      tc => tc.name === 'request_context_retrieval'
    );

    if (needsContext) {
      const directives = result.toolCalls
        .filter(tc => tc.name === 'request_context_retrieval')
        .map(tc => tc.input.directive as string);
      return { status: 'NEEDS_CONTEXT', retrievalDirectives: directives };
    }

    return { status: 'OK' };
  }

  async invoke(input: any): Promise<any> {
    const prompt = this.buildInvokePrompt(input);
    const result = await this.llmCall(prompt, [], this.config.llmCall);

    this.recordInference(
      this.computePromptDigest(prompt),
      result.toolCalls,
      result.reasoning
    );

    // Extract output from tool calls or reasoning
    return this.extractOutput(result);
  }

  async postcheck(output: any): Promise<PostcheckResult> {
    if (!this.config.hooks?.postcheck) {
      return { status: 'COMPLETE' };
    }

    const prompt = this.buildPostcheckPrompt(output);
    const result = await this.llmCall(prompt, [], this.config.llmCall);

    this.recordInference(
      this.computePromptDigest(prompt),
      result.toolCalls,
      result.reasoning
    );

    // Check for compensation or escalation requests
    const needsCompensation = result.toolCalls.some(
      tc => tc.name === 'request_compensation'
    );
    const needsEscalation = result.toolCalls.some(
      tc => tc.name === 'escalate_issue'
    );

    if (needsCompensation) {
      const reason = result.toolCalls.find(
        tc => tc.name === 'request_compensation'
      )?.input.reason as string;
      return { status: 'NEEDS_COMPENSATION', reason: reason || 'Unknown' };
    }

    if (needsEscalation) {
      const reason = result.toolCalls.find(
        tc => tc.name === 'escalate_issue'
      )?.input.reason as string;
      return { status: 'ESCALATE', reason: reason || 'Unknown' };
    }

    return { status: 'COMPLETE' };
  }

  recordInference(
    promptDigest: string,
    toolCalls: ToolCallEnvelope[],
    reasoning?: string
  ): LedgerEntry {
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
        toolCalls: toolCalls.map(tc => ({
          id: tc.id,
          name: tc.name,
          inputDigest: this.computeDigest(JSON.stringify(tc.input)),
          outputDigest: tc.output ? this.computeDigest(JSON.stringify(tc.output)) : undefined,
        })),
      },
    };

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

  private buildPreflightPrompt(): string {
    return `Assess whether the current context is sufficient for the task.
Goal: ${this.config.goalId}
Task: ${this.config.taskId || 'planner'}
Context Ref: ${this.config.contextRef}

If additional context is needed, call request_context_retrieval with a directive.`;
  }

  private buildInvokePrompt(input: any): string {
    return `Execute the task with the following input:
${JSON.stringify(input, null, 2)}

Goal: ${this.config.goalId}
Task: ${this.config.taskId || 'planner'}`;
  }

  private buildPostcheckPrompt(output: any): string {
    return `Validate the output and determine if any follow-up is needed:
${JSON.stringify(output, null, 2)}

If compensation is needed, call request_compensation.
If escalation is needed, call escalate_issue.`;
  }

  private extractOutput(result: { reasoning?: string; toolCalls: ToolCallEnvelope[] }): any {
    // If there are tool calls, extract outputs from them
    if (result.toolCalls.length > 0) {
      return result.toolCalls.map(tc => tc.output);
    }
    // Otherwise return reasoning as output
    return { reasoning: result.reasoning };
  }

  private computePromptDigest(prompt: string): string {
    // Simple hash for now (in production, use crypto)
    const hash = require('crypto').createHash('sha256');
    hash.update(prompt);
    return hash.digest('hex').substring(0, 16);
  }

  private computeDigest(content: string): string {
    const hash = require('crypto').createHash('sha256');
    hash.update(content);
    return hash.digest('hex').substring(0, 16);
  }
}

// Factory type for creating Nucleus instances
export type NucleusFactory = (config: NucleusConfig) => Nucleus;
