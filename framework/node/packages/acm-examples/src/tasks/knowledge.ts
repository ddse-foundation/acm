import { Task, type RunContext } from '@acm/sdk';
import {
  type KnowledgeSearchInput,
  type KnowledgeSearchOutput,
  type SummarizeSnippetInput,
  type SummarizeSnippetOutput,
  type SuggestFollowupsInput,
  type SuggestFollowupsOutput,
} from '../tools/knowledge/index.js';

export class SearchKnowledgeTask extends Task<
  KnowledgeSearchInput,
  KnowledgeSearchOutput
> {
  constructor() {
    super('task-knowledge-search', 'knowledge.search');
  }

  idemKey(_ctx: RunContext, input: KnowledgeSearchInput): string | undefined {
    const query = input?.query?.trim();
    return query ? `knowledge:search:${query.toLowerCase()}` : undefined;
  }

  policyInput(_ctx: RunContext, input: KnowledgeSearchInput): Record<string, unknown> {
    return {
      action: 'search_knowledge',
      query: input.query,
      limit: input.limit,
    };
  }

  verification(): string[] {
    return ['Array.isArray(output.hits)', 'output.hits.length >= 0'];
  }

  async execute(
    ctx: RunContext,
    input: KnowledgeSearchInput
  ): Promise<KnowledgeSearchOutput> {
    const tool = ctx.getTool('search_knowledge');
    if (!tool) {
      throw new Error('search_knowledge tool is not registered');
    }

    const result = (await tool.call(input)) as KnowledgeSearchOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'knowledge_hits_found',
      hits: result.hits?.map(hit => ({ docId: hit.id, score: hit.score })),
    });
    return result;
  }
}

export class SummarizeSnippetTask extends Task<
  SummarizeSnippetInput,
  SummarizeSnippetOutput
> {
  constructor() {
    super('task-knowledge-summarize', 'knowledge.summarize');
  }

  policyInput(_ctx: RunContext, input: SummarizeSnippetInput): Record<string, unknown> {
    return {
      action: 'summarize_snippet',
      docId: input.docId,
      maxSentences: input.maxSentences,
      focus: input.focus,
    };
  }

  verification(): string[] {
    return ['typeof output.summary === "string"', 'Array.isArray(output.highlights)'];
  }

  async execute(
    ctx: RunContext,
    input: SummarizeSnippetInput
  ): Promise<SummarizeSnippetOutput> {
    const tool = ctx.getTool('summarize_snippet');
    if (!tool) {
      throw new Error('summarize_snippet tool is not registered');
    }

    const result = (await tool.call(input)) as SummarizeSnippetOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'knowledge_snippet_summarized',
      docId: input.docId,
      title: result.title,
    });
    return result;
  }
}

export class SuggestFollowupsTask extends Task<
  SuggestFollowupsInput,
  SuggestFollowupsOutput
> {
  constructor() {
    super('task-knowledge-followups', 'knowledge.followups');
  }

  private resolveDocId(
    ctx: RunContext,
    input: SuggestFollowupsInput
  ): string | undefined {
    const direct = input?.docId;
    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }

    const summary = ctx.outputs?.['task-knowledge-summarize'] as
      | SummarizeSnippetOutput
      | undefined;
    const summaryDocId = summary?.docId;
    if (typeof summaryDocId === 'string' && summaryDocId.trim()) {
      return summaryDocId.trim();
    }

    const search = ctx.outputs?.['task-knowledge-search'] as
      | KnowledgeSearchOutput
      | undefined;
    const firstHitId = search?.hits?.[0]?.id;
    if (typeof firstHitId === 'string' && firstHitId.trim()) {
      return firstHitId.trim();
    }

    return undefined;
  }

  policyInput(_ctx: RunContext, input: SuggestFollowupsInput): Record<string, unknown> {
    const docId = this.resolveDocId(_ctx, input);

    return {
      action: 'suggest_followups',
      docId,
      context: input.context,
    };
  }

  verification(): string[] {
    return ['Array.isArray(output.suggestions)', 'output.suggestions.length >= 0'];
  }

  async execute(
    ctx: RunContext,
    input: SuggestFollowupsInput
  ): Promise<SuggestFollowupsOutput> {
    const tool = ctx.getTool('suggest_followups');
    if (!tool) {
      throw new Error('suggest_followups tool is not registered');
    }

    const docId = this.resolveDocId(ctx, input);
    if (!docId) {
      throw new Error('docId is required');
    }

    const result = (await tool.call({ ...input, docId })) as SuggestFollowupsOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'knowledge_followups_suggested',
      docId,
      suggestionCount: result.suggestions.length,
    });
    return result;
  }
}
