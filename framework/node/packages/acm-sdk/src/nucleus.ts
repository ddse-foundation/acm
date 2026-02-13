// Nucleus contract for LLM-native task and planner execution
import type { Context, InternalContextScope, LedgerEntry, ToolCallEnvelope } from './types.js';
import type { ExternalContextProviderAdapter } from './context-provider.js';
import { universalDigest } from './hash.js';

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
  /** Token usage metrics from the callLLM loop */
  metrics?: {
    /** Total rounds executed (including query_context/retrieval rounds) */
    rounds: number;
    /** Estimated cumulative prompt tokens across all rounds */
    estimatedPromptTokens: number;
    /** Whether the loop was terminated early due to token budget */
    budgetExhausted: boolean;
  };
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
  /** Max callLLM rounds the nucleus may execute before forced to answer. Default 3. */
  maxQueryRounds?: number;
  /**
   * Max times request_context_retrieval may be fulfilled per invoke/preflight.
   * After this many fulfillments, the retrieval tool is removed so the LLM
   * must produce a final answer with whatever context it has.  Default 1.
   *
   * NOTE: Each fulfillment itself may run multiple inner iterations
   * (e.g. IterativePhasedRetrievalExecution with 6 rounds).  This cap
   * prevents the *outer* nucleus loop from re-triggering retrieval.
   */
  maxRetrievalRounds?: number;
  /** External context provider for mid-invoke retrieval. When set, request_context_retrieval calls are fulfilled inline. */
  contextProvider?: ExternalContextProviderAdapter;
  /**
   * Maximum context window tokens the underlying model supports.
   * When set, the callLLM loop estimates cumulative prompt tokens per round
   * and forces a final answer when usage exceeds 85% of this budget.
   * Passed from infrastructure (e.g. LlmConfig.maxContext via BudgetManager).
   */
  maxContextTokens?: number;
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

/**
 * Estimate token count from a text string using char/token ratio heuristics.
 * Aligned with BudgetManager.estimateTokens from aiagent infrastructure.
 * Code and structured text use lower ratios (higher token density).
 */
export function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  const s = String(text);
  let ratio = 4.0;
  const looksLikeCode = /\b(function|class|interface|type|const|let|var|import|export)\b|=>\s*\{|\{[\s\S]*\}|\[[\s\S]*\]/.test(s);
  const looksStructured = /(^\s*\{|^\s*\[|"\w+"\s*:)|\n\s*\w+\s*:\s*.+/m.test(s);
  const looksSymbolDense = /[{}()[\];,]/.test(s);
  if (looksLikeCode) ratio = 3.0;
  if (looksStructured) ratio = Math.min(ratio, 3.2);
  if (looksSymbolDense) ratio = Math.min(ratio, 3.1);
  const padding = s.length > 4000 ? 1.12 : 1.05;
  return Math.ceil((s.length / ratio) * padding);
}

/** Token budget safety threshold — force final round when estimated tokens exceed this fraction of maxContextTokens. */
const TOKEN_BUDGET_THRESHOLD = 0.85;

/**
 * Describe a JS value's type concisely for catalog display.
 * Examples: "string", "number", "Array(5)", "object(3 keys)", "boolean", "null"
 */
function describeType(val: any): string {
  if (val === null || val === undefined) return 'null';
  if (Array.isArray(val)) return `Array(${val.length})`;
  if (typeof val === 'object') return `object(${Object.keys(val).length} keys)`;
  return typeof val;  // string, number, boolean
}

/**
 * Built-in tool that lets the Nucleus selectively read from context and internal artifacts
 * instead of receiving the entire context dump in the prompt.
 */
const QUERY_CONTEXT_TOOL: NucleusToolDefinition = {
  name: 'query_context',
  description:
    'Read data that is ALREADY in your context scope. Use "list" to see available keys, then read specific items. Use this FIRST before requesting external retrieval.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description:
          'One of: list, read_fact, read_augmentation, read_assumptions, read_artifact',
      },
      key: {
        type: 'string',
        description: 'Fact key (for read_fact)',
      },
      index: {
        type: 'number',
        description: 'Augmentation index (for read_augmentation)',
      },
      artifactId: {
        type: 'string',
        description: 'Artifact ID (for read_artifact)',
      },
    },
    required: ['action'],
  },
};

/**
 * Built-in tool that lets the Nucleus request external context retrieval
 * when the information it needs is NOT present in the current context scope.
 */
const REQUEST_CONTEXT_RETRIEVAL_TOOL: NucleusToolDefinition = {
  name: 'request_context_retrieval',
  description:
    'Request retrieval of EXTERNAL context that is NOT in your current scope. Only use this after checking the available context with query_context(action="list") and confirming the data you need is missing. Provide a directive describing what information is needed.',
  inputSchema: {
    type: 'object',
    properties: {
      directive: {
        type: 'string',
        description: 'A description of what information is needed, e.g. "retrieve source code for ChatService" or "search for API documentation about /api/users endpoint"',
      },
    },
    required: ['directive'],
  },
};

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
    // Auto-inject built-in tools based on available context
    const hasQueryableContext =
      this.internalContext || (this.config.context && Object.keys(this.config.context.facts ?? {}).length > 0);
    const builtInTools: NucleusToolDefinition[] = [];
    if (hasQueryableContext) builtInTools.push(QUERY_CONTEXT_TOOL);
    builtInTools.push(REQUEST_CONTEXT_RETRIEVAL_TOOL); // always available
    let effectiveTools = [...tools, ...builtInTools];
    // Tools without retrieval built-ins (for last-round fallback)
    const toolsWithoutBuiltins = tools;

    let currentPrompt = prompt;
    let finalResult: NucleusInvokeResult | undefined;
    const maxRounds = this.config.maxQueryRounds ?? 3;

    // Retrieval round cap — prevents outer loop from re-triggering
    // the inner IterativePhasedRetrievalExecution engine repeatedly.
    const maxRetrievalRounds = this.config.maxRetrievalRounds ?? 1;
    let retrievalFulfillments = 0;

    // Token budget tracking
    const maxContextTokens = this.config.maxContextTokens;
    const budgetLimit = maxContextTokens ? Math.floor(maxContextTokens * TOKEN_BUDGET_THRESHOLD) : undefined;
    let cumulativePromptTokens = 0;
    let budgetExhausted = false;
    let roundsExecuted = 0;

    for (let round = 0; round < maxRounds; round++) {
      // Estimate tokens for this round's prompt
      const roundTokens = estimateTokens(currentPrompt);
      cumulativePromptTokens += roundTokens;
      roundsExecuted = round + 1;

      // Check token budget — if exceeded, force final round (no built-in tools)
      const isLastRound = round >= maxRounds - 1;
      const overBudget = budgetLimit !== undefined && cumulativePromptTokens >= budgetLimit;
      if (overBudget && !isLastRound) {
        budgetExhausted = true;
      }
      const useBuiltins = !isLastRound && !budgetExhausted;

      const result = await this.llmCall(
        currentPrompt,
        useBuiltins ? effectiveTools : toolsWithoutBuiltins,
        this.config.llmCall
      );

      const normalizedCalls = (result.toolCalls ?? []).map((tc, idx) => ({
        id: tc.id ?? `tool-call-${Date.now()}-${idx}`,
        name: tc.name,
        input: tc.input ?? {},
        output: tc.output,
        error: tc.error,
      }));

      // Separate built-in calls from other tool calls
      const queryCalls = normalizedCalls.filter(tc => tc.name === 'query_context');
      const retrievalCalls = normalizedCalls.filter(tc => tc.name === 'request_context_retrieval');
      const otherCalls = normalizedCalls.filter(tc => tc.name !== 'query_context' && tc.name !== 'request_context_retrieval');

      // If built-in tools were not offered (budget exhausted or last round),
      // ignore any built-in calls the LLM returned — treat as final answer.
      if (!useBuiltins && (queryCalls.length > 0 || retrievalCalls.length > 0)) {
        this.recordInference(this.computePromptDigest(currentPrompt), otherCalls.length > 0 ? otherCalls : normalizedCalls, result.reasoning);
        finalResult = {
          reasoning: result.reasoning,
          toolCalls: otherCalls.length > 0 ? otherCalls : normalizedCalls,
          raw: result.raw,
          metrics: { rounds: roundsExecuted, estimatedPromptTokens: cumulativePromptTokens, budgetExhausted },
        };
        break;
      }

      // If no built-in calls at all, we're done
      if (queryCalls.length === 0 && retrievalCalls.length === 0) {
        // No query_context or retrieval calls — record and return
        this.recordInference(this.computePromptDigest(currentPrompt), normalizedCalls, result.reasoning);
        finalResult = {
          reasoning: result.reasoning,
          toolCalls: normalizedCalls,
          raw: result.raw,
          metrics: { rounds: roundsExecuted, estimatedPromptTokens: cumulativePromptTokens, budgetExhausted },
        };
        break;
      }
      // Handle request_context_retrieval calls
      if (retrievalCalls.length > 0) {
        const directives = retrievalCalls
          .map(tc => tc.input?.directive as string)
          .filter(Boolean);

        if (this.config.contextProvider && this.internalContext) {
          // Fulfill externally inline and continue the loop
          await this.config.contextProvider.fulfill({
            directives,
            scope: this.internalContext,
          });

          retrievalFulfillments++;
          this.recordInference(this.computePromptDigest(currentPrompt), retrievalCalls, result.reasoning);

          // If we've hit the retrieval cap, remove the retrieval tool
          // so the LLM must produce a final answer with current context.
          if (retrievalFulfillments >= maxRetrievalRounds) {
            effectiveTools = effectiveTools.filter(
              t => t.name !== 'request_context_retrieval'
            );
          }

          // Re-render context snapshot since new artifacts were added
          currentPrompt = `${currentPrompt}\n\n--- External Context Retrieved ---\nNew artifacts have been added to your internal context scope for directives: ${directives.join(', ')}\nUse query_context(action="list") to see updated available data, then read what you need.\n--- End ---\n\nContinue with the original task.`;

          // Also handle any query_context calls from the same round
          if (queryCalls.length > 0) {
            const queryResults = this.resolveQueryCalls(queryCalls);
            currentPrompt = `${currentPrompt}\n\n--- Context Query Results ---\n${queryResults.join('\n\n')}\n--- End Results ---`;
            this.recordInference(this.computePromptDigest(currentPrompt), queryCalls, result.reasoning);
          }

          // If there were other tool calls alongside, return them
          if (otherCalls.length > 0) {
            this.recordInference(this.computePromptDigest(currentPrompt), otherCalls, result.reasoning);
            finalResult = { reasoning: result.reasoning, toolCalls: otherCalls, raw: result.raw, metrics: { rounds: roundsExecuted, estimatedPromptTokens: cumulativePromptTokens, budgetExhausted } };
            break;
          }
          continue; // next round
        } else {
          // No contextProvider — return retrieval calls as unhandled (executor or caller handles NEEDS_CONTEXT)
          this.recordInference(this.computePromptDigest(currentPrompt), normalizedCalls, result.reasoning);
          finalResult = { reasoning: result.reasoning, toolCalls: normalizedCalls, raw: result.raw, metrics: { rounds: roundsExecuted, estimatedPromptTokens: cumulativePromptTokens, budgetExhausted } };
          break;
        }
      }

      // Execute query_context calls and append results to prompt
      const queryResults = this.resolveQueryCalls(queryCalls);

      // Record this intermediate round
      this.recordInference(this.computePromptDigest(currentPrompt), queryCalls, result.reasoning);

      // Build follow-up prompt with query results
      currentPrompt = `${currentPrompt}\n\n--- Context Query Results ---\n${queryResults.join('\n\n')}\n--- End Results ---\n\nUsing the context above, continue with the original task.`;

      // If there were other tool calls alongside query_context, return them now
      if (otherCalls.length > 0) {
        this.recordInference(this.computePromptDigest(currentPrompt), otherCalls, result.reasoning);
        finalResult = {
          reasoning: result.reasoning,
          toolCalls: otherCalls,
          raw: result.raw,
          metrics: { rounds: roundsExecuted, estimatedPromptTokens: cumulativePromptTokens, budgetExhausted },
        };
        break;
      }
    }

    if (!finalResult) {
      // Exhausted rounds (maxQueryRounds or budget) — do a final call without built-in tools
      roundsExecuted++;
      cumulativePromptTokens += estimateTokens(currentPrompt);
      const result = await this.llmCall(currentPrompt, toolsWithoutBuiltins, this.config.llmCall);
      const normalizedCalls = (result.toolCalls ?? []).map((tc, idx) => ({
        id: tc.id ?? `tool-call-${Date.now()}-${idx}`,
        name: tc.name,
        input: tc.input ?? {},
        output: tc.output,
        error: tc.error,
      }));
      this.recordInference(this.computePromptDigest(currentPrompt), normalizedCalls, result.reasoning);
      finalResult = {
        reasoning: result.reasoning,
        toolCalls: normalizedCalls,
        raw: result.raw,
        metrics: { rounds: roundsExecuted, estimatedPromptTokens: cumulativePromptTokens, budgetExhausted: budgetExhausted || !budgetLimit ? budgetExhausted : cumulativePromptTokens >= budgetLimit },
      };
    }

    return finalResult;
  }

  /**
   * Resolve an array of query_context tool calls, returning formatted result strings.
   */
  private resolveQueryCalls(queryCalls: StructuredToolCall[]): string[] {
    const results: string[] = [];
    for (const qc of queryCalls) {
      const qResult = this.executeQueryContext(qc.input);
      results.push(
        `query_context(action="${qc.input.action}"${qc.input.key ? `, key="${qc.input.key}"` : ''}${qc.input.index !== undefined ? `, index=${qc.input.index}` : ''}${qc.input.artifactId ? `, artifactId="${qc.input.artifactId}"` : ''}): ${JSON.stringify(qResult, null, 2)}`
      );
    }
    return results;
  }

  /**
   * Execute a query_context tool call against this.config.context and this.internalContext
   */
  private executeQueryContext(input: Record<string, any>): any {
    const action = input.action as string;
    const context = this.config.context;

    switch (action) {
      case 'list': {
        const catalog: Record<string, any> = {};
        const factKeys = Object.keys(context?.facts ?? {});
        catalog.facts = factKeys.map(key => {
          const val = context!.facts[key];
          const size = typeof val === 'string' ? val.length : JSON.stringify(val).length;
          return { key, type: describeType(val), sizeChars: size };
        });
        catalog.assumptions = context?.assumptions?.length ?? 0;
        catalog.augmentations = (context?.augmentations ?? []).map((a, i) => ({
          index: i,
          type: a.type,
        }));
        if (this.internalContext) {
          catalog.artifacts = this.internalContext.artifacts.map(a => ({
            id: a.id,
            type: a.type,
            sizeBytes: a.sizeBytes ?? null,
          }));
        }
        return catalog;
      }

      case 'read_fact': {
        const key = input.key as string;
        if (!context?.facts || !(key in context.facts)) {
          return { error: `Fact key "${key}" not found` };
        }
        return context.facts[key];
      }

      case 'read_augmentation': {
        const idx = input.index as number;
        const augs = context?.augmentations ?? [];
        if (idx < 0 || idx >= augs.length) {
          return { error: `Augmentation index ${idx} out of range (0..${augs.length - 1})` };
        }
        return augs[idx];
      }

      case 'read_assumptions': {
        return context?.assumptions ?? [];
      }

      case 'read_artifact': {
        const artifactId = input.artifactId as string;
        if (!this.internalContext) {
          return { error: 'No internal context available' };
        }
        const content = this.internalContext.getArtifact(artifactId);
        if (content === undefined) {
          return { error: `Artifact "${artifactId}" not found` };
        }
        return content;
      }

      default:
        return { error: `Unknown action "${action}". Use: list, read_fact, read_augmentation, read_assumptions, read_artifact` };
    }
  }

  private buildPreflightPrompt(): string {
    return `Assess whether the current context is sufficient for the task.
Goal: ${this.config.goalId}
Goal Intent: ${this.config.goalIntent}
Task: ${this.config.taskId || 'planner'}
Context Ref: ${this.config.contextRef}

Context Snapshot:
${this.renderContextSnapshot()}

## CONTEXT TOOLS
You have two context tools available:
1. **query_context** — Read data that is ALREADY in your scope. Use query_context(action="list") first to see what is available.
2. **request_context_retrieval** — Fetch EXTERNAL data that is NOT in your scope. Only use this after confirming via query_context(action="list") that the data you need is missing.

IMPORTANT: If the context above does not contain the information needed to complete the task WITHOUT fabricating data, you MUST call request_context_retrieval with a directive describing what is missing. Never proceed with insufficient context — hallucinating information violates the core ACM contract.`;
  }

  private buildInvokePrompt(input: any): string {
    return `Execute the task with the following input:
${JSON.stringify(input, null, 2)}

Goal: ${this.config.goalId}
Goal Intent: ${this.config.goalIntent}
Task: ${this.config.taskId || 'planner'}

Relevant Context:
${this.renderContextSnapshot()}

## CONTEXT TOOLS
You have two context tools available:
1. **query_context** — Read data ALREADY in your scope. Start with query_context(action="list") to see available facts, augmentations, and artifacts, then read specific items.
2. **request_context_retrieval** — Fetch EXTERNAL data NOT in your scope. Only call this after confirming via query_context(action="list") that the information you need is missing.

## GROUNDING RULES
- You MUST base your response on the context provided above. Use query_context to read specific facts, augmentations, or artifacts before generating output.
- Do NOT fabricate information that is not present in the context. If the context is insufficient, say so explicitly rather than inventing data.
- When referencing context data, cite which fact key, augmentation index, or artifact ID you used.
- If your task requires information not available in the context, call request_context_retrieval with a directive describing what you need. New artifacts will be added to your scope and you can then read them with query_context.`;
  }

  private buildPostcheckPrompt(output: any): string {
    return `Validate the output and determine if any follow-up is needed:
${JSON.stringify(output, null, 2)}

Goal: ${this.config.goalId}
Goal Intent: ${this.config.goalIntent}
Task: ${this.config.taskId || 'planner'}

Context Reference: ${this.config.contextRef}

## VALIDATION RULES
- Verify that the output is grounded in the provided context. Any claims, references, or data in the output must trace back to context facts, augmentations, or internal artifacts.
- Flag any output that contains fabricated information not present in the context.
- If the output references files, APIs, or structures not evidenced in the context, call request_compensation with a reason.

If compensation is needed, call request_compensation.
If escalation is needed, call escalate_issue.`;
  }

  private computePromptDigest(prompt: string): string {
    return universalDigest(prompt).substring(0, 16);
  }

  private computeDigest(content: string): string {
    return universalDigest(content).substring(0, 16);
  }

  private renderContextSnapshot(): string {
    const context = this.config.context;
    if (!context) {
      return '(No context payload provided; consider supplying context.facts to the nucleus.)';
    }

    const pieces: string[] = [];

    // Facts: catalog of keys with approximate sizes — NOT full content
    const factKeys = Object.keys(context.facts ?? {});
    if (factKeys.length > 0) {
      const catalog = factKeys.map(key => {
        const val = context.facts[key];
        const size = typeof val === 'string' ? val.length : JSON.stringify(val).length;
        return `  - ${key} [${describeType(val)}] (${size} chars)`;
      });
      pieces.push(`Facts (${factKeys.length} keys):\n${catalog.join('\n')}`);
    } else {
      pieces.push('Facts: (none)');
    }

    if (context.assumptions && context.assumptions.length > 0) {
      pieces.push(`Assumptions: ${context.assumptions.length} items`);
    }

    if (context.constraints_inherited && Object.keys(context.constraints_inherited).length > 0) {
      pieces.push(
        `Inherited Constraints: ${Object.keys(context.constraints_inherited).length} keys`
      );
    }

    if (context.augmentations && context.augmentations.length > 0) {
      const typeCounts: Record<string, number> = {};
      for (const aug of context.augmentations) {
        typeCounts[aug.type] = (typeCounts[aug.type] ?? 0) + 1;
      }
      const summary = Object.entries(typeCounts)
        .map(([type, count]) => `${type}(${count})`)
        .join(', ');
      pieces.push(`Augmentations: ${context.augmentations.length} — ${summary}`);
    }

    // Internal context artifacts catalog
    if (this.internalContext && this.internalContext.artifacts.length > 0) {
      const artifacts = this.internalContext.artifacts.map(a => {
        const size = a.sizeBytes ?? '?';
        return `  - ${a.id} [${a.type}] (${size} bytes)`;
      });
      pieces.push(
        `Internal Artifacts (${this.internalContext.artifacts.length}):\n${artifacts.join('\n')}`
      );
    }

    pieces.push(
      '\n⚠️ GROUNDING CONSTRAINT: You MUST use the query_context tool to read specific facts, augmentations, assumptions, or artifacts before generating any output. Do NOT invent or assume data that is not in the context. Cite which keys/IDs you read.'
    );

    return pieces.join('\n\n');
  }
}

export type NucleusFactory = (config: NucleusConfig) => Nucleus;
