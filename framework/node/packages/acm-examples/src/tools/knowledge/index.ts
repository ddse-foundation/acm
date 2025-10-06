import { Tool } from '@ddse/acm-sdk';
import {
  searchSnippets,
  loadSnippetContent,
  getSnippetMeta,
  type KnowledgeSnippetMeta,
} from '../../data/knowledge.js';

export type KnowledgeSearchInput = {
  query: string;
  limit?: number;
};

export type KnowledgeSearchHit = KnowledgeSnippetMeta & {
  score: number;
};

export type KnowledgeSearchOutput = {
  hits: KnowledgeSearchHit[];
};

export class SearchKnowledgeTool extends Tool<KnowledgeSearchInput, KnowledgeSearchOutput> {
  name(): string {
    return 'search_knowledge';
  }

  async call(input: KnowledgeSearchInput): Promise<KnowledgeSearchOutput> {
    const query = input?.query?.trim();
    if (!query) {
      throw new Error('query is required');
    }

    const limit = Math.max(1, Math.min(input.limit ?? 5, 10));
    const snippets = await searchSnippets(query);

    const hits: KnowledgeSearchHit[] = snippets.slice(0, limit).map((snippet, index) => ({
      ...snippet,
      score: Math.max(1, snippets.length - index),
    }));

    return { hits };
  }
}

export type SummarizeSnippetInput = {
  docId: string;
  maxSentences?: number;
  focus?: string;
};

export type SummarizeSnippetOutput = {
  docId: string;
  title: string;
  summary: string;
  highlights: string[];
  followups: string[];
};

function summarizeContent(content: string, maxSentences: number): string {
  const sentences = content
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .filter(Boolean);

  if (sentences.length === 0) {
    return content.trim();
  }

  return sentences.slice(0, maxSentences).join(' ');
}

function extractHighlights(content: string, maxHighlights = 3): string[] {
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const bulletLines = lines.filter(line => /^[-*]/.test(line));
  const highlights: string[] = [];

  for (const line of bulletLines) {
    highlights.push(line.replace(/^[-*]\s*/, ''));
    if (highlights.length >= maxHighlights) {
      break;
    }
  }

  if (highlights.length === 0) {
    highlights.push(...lines.slice(0, maxHighlights));
  }

  return highlights.slice(0, maxHighlights);
}

function deriveFollowups(meta: KnowledgeSnippetMeta, focus?: string): string[] {
  const followups = new Set<string>();

  for (const tag of meta.tags) {
    if (tag.toLowerCase().includes('escalation')) {
      followups.add('Confirm escalation steps with runbook owner');
    }
    if (tag.toLowerCase().includes('training')) {
      followups.add('Share summary with enablement channel for awareness');
    }
    if (tag.toLowerCase().includes('automation')) {
      followups.add('Evaluate automation opportunity with platform team');
    }
  }

  if (focus) {
    followups.add(`Identify additional knowledge gaps related to "${focus}"`);
  }

  if (followups.size === 0) {
    followups.add('Log follow-up tasks in support queue');
  }

  return Array.from(followups);
}

export class SummarizeSnippetTool extends Tool<
  SummarizeSnippetInput,
  SummarizeSnippetOutput
> {
  name(): string {
    return 'summarize_snippet';
  }

  async call(input: SummarizeSnippetInput): Promise<SummarizeSnippetOutput> {
    if (!input?.docId) {
      throw new Error('docId is required');
    }

    const [meta, content] = await Promise.all([
      getSnippetMeta(input.docId),
      loadSnippetContent(input.docId),
    ]);

    if (!meta || !content) {
      throw new Error(`Snippet ${input.docId} not found`);
    }

    const maxSentences = Math.max(1, Math.min(input.maxSentences ?? 3, 6));
    const summary = summarizeContent(content, maxSentences);
    const highlights = extractHighlights(content);
    const followups = deriveFollowups(meta, input.focus);

    return {
      docId: input.docId,
      title: meta.title,
      summary,
      highlights,
      followups,
    };
  }
}

export type SuggestFollowupsInput = {
  docId: string;
  context?: {
    channel?: string;
    urgency?: 'low' | 'normal' | 'high';
  };
};

export type SuggestFollowupsOutput = {
  docId: string;
  suggestions: Array<{
    action: string;
    owner: string;
    dueInHours: number;
  }>;
};

export class SuggestFollowupsTool extends Tool<
  SuggestFollowupsInput,
  SuggestFollowupsOutput
> {
  name(): string {
    return 'suggest_followups';
  }

  async call(input: SuggestFollowupsInput): Promise<SuggestFollowupsOutput> {
    if (!input?.docId) {
      throw new Error('docId is required');
    }

    const meta = await getSnippetMeta(input.docId);
    if (!meta) {
      throw new Error(`Snippet ${input.docId} not found`);
    }

    const baseDue = input.context?.urgency === 'high' ? 4 : input.context?.urgency === 'low' ? 24 : 8;

    const suggestions = deriveFollowups(meta)
      .map((action, index) => ({
        action,
        owner: index === 0 ? 'support.enablement' : 'support.lead',
        dueInHours: baseDue + index * 4,
      }));

    return {
      docId: input.docId,
      suggestions,
    };
  }
}
