import { Tool } from '@acm/sdk';
import {
  FetchCustomerProfileTool,
  EvaluateEntitlementTool,
  EntitlementNotifySupervisorTool,
} from './entitlement/index.js';
import {
  SearchKnowledgeTool,
  SummarizeSnippetTool,
  SuggestFollowupsTool,
} from './knowledge/index.js';
import {
  FetchIncidentTool,
  ClassifySeverityTool,
  SelectQueueTool,
  EscalateIncidentTool,
} from './incidents/index.js';
import {
  FetchInvoiceTool,
  FetchPurchaseOrderTool,
  CompareLineItemsTool,
  RecordFindingsTool,
} from './invoices/index.js';
import {
  AnalyzeTranscriptTool,
  GenerateFeedbackTool,
  LogCoachingNoteTool,
} from './coaching/index.js';
import { searchSnippets } from '../data/knowledge.js';

export {
  FetchCustomerProfileTool,
  EvaluateEntitlementTool,
  EntitlementNotifySupervisorTool,
  SearchKnowledgeTool,
  SummarizeSnippetTool,
  SuggestFollowupsTool,
  FetchIncidentTool,
  ClassifySeverityTool,
  SelectQueueTool,
  EscalateIncidentTool,
  FetchInvoiceTool,
  FetchPurchaseOrderTool,
  CompareLineItemsTool,
  RecordFindingsTool,
  AnalyzeTranscriptTool,
  GenerateFeedbackTool,
  LogCoachingNoteTool,
};

export type ExampleToolInstance = {
  tool: Tool<any, any>;
  category: 'entitlement' | 'knowledge' | 'incident' | 'invoice' | 'coaching';
};

export function createExampleTools(): ExampleToolInstance[] {
  return [
    { tool: new FetchCustomerProfileTool(), category: 'entitlement' },
    { tool: new EvaluateEntitlementTool(), category: 'entitlement' },
    { tool: new EntitlementNotifySupervisorTool(), category: 'entitlement' },
    { tool: new SearchKnowledgeTool(), category: 'knowledge' },
    { tool: new SummarizeSnippetTool(), category: 'knowledge' },
    { tool: new SuggestFollowupsTool(), category: 'knowledge' },
    { tool: new FetchIncidentTool(), category: 'incident' },
    { tool: new ClassifySeverityTool(), category: 'incident' },
    { tool: new SelectQueueTool(), category: 'incident' },
    { tool: new EscalateIncidentTool(), category: 'incident' },
    { tool: new FetchInvoiceTool(), category: 'invoice' },
    { tool: new FetchPurchaseOrderTool(), category: 'invoice' },
    { tool: new CompareLineItemsTool(), category: 'invoice' },
    { tool: new RecordFindingsTool(), category: 'invoice' },
    { tool: new AnalyzeTranscriptTool(), category: 'coaching' },
    { tool: new GenerateFeedbackTool(), category: 'coaching' },
    { tool: new LogCoachingNoteTool(), category: 'coaching' },
  ];
}

export type SearchToolInput = {
  query: string;
  limit?: number;
};

export type SearchToolOutput = {
  results: Array<{
    id: string;
    title: string;
    score: number;
    type: string;
    summary: string;
    tags: string[];
  }>;
};

export class SearchTool extends Tool<SearchToolInput, SearchToolOutput> {
  name(): string {
    return 'search';
  }

  async call(input: SearchToolInput): Promise<SearchToolOutput> {
    const query = input?.query?.trim();
    if (!query) {
      throw new Error('query is required');
    }

    const limit = Math.max(1, Math.min(input.limit ?? 5, 10));
    const snippets = await searchSnippets(query);
    const results = snippets.slice(0, limit).map((snippet, index) => ({
      id: snippet.id,
      title: snippet.title,
      summary: snippet.summary,
      tags: snippet.tags,
      type: 'knowledge',
      score: Math.max(1, snippets.length - index),
    }));

    return { results };
  }
}

export class ExtractEntitiesTool extends Tool<{ text: string }, { entities: string[] }> {
  name(): string {
    return 'extract_entities';
  }

  async call(input: { text: string }): Promise<{ entities: string[] }> {
    const text = input?.text ?? '';
    const entities = Array.from(new Set(text.match(/[A-Z]{2,}-\d+/g) ?? []));
    if (!entities.includes('ORDER-REF')) {
      entities.push('ORDER-REF');
    }
    return { entities };
  }
}

export class AssessRiskTool extends Tool<{ context: any }, { riskTier: string; score: number }> {
  name(): string {
    return 'assess_risk';
  }

  async call(input: { context: any }): Promise<{ riskTier: string; score: number }> {
    const serialized = JSON.stringify(input?.context ?? {});
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      hash = (hash + serialized.charCodeAt(i) * (i + 1)) % 101;
    }
    const score = hash;
    const riskTier = score > 70 ? 'HIGH' : score > 40 ? 'MEDIUM' : 'LOW';
    return { riskTier, score };
  }
}

export class CreateRefundTxnTool extends Tool<
  { orderId: string; amount: number },
  { transactionId: string; status: string }
> {
  name(): string {
    return 'create_refund_txn';
  }

  async call(input: { orderId: string; amount: number }): Promise<{ transactionId: string; status: string }> {
    if (!input?.orderId || typeof input.amount !== 'number') {
      throw new Error('orderId and amount are required');
    }

    return {
      transactionId: `TXN-${Date.now()}`,
      status: input.amount > 0 ? 'COMPLETED' : 'REJECTED',
    };
  }
}

export class NotifySupervisorToolLegacy extends Tool<
  { message: string; channel: string },
  { sent: boolean; messageId: string }
> {
  name(): string {
    return 'notify_supervisor_legacy';
  }

  async call(input: { message: string; channel: string }): Promise<{ sent: boolean; messageId: string }> {
    if (!input?.message) {
      throw new Error('message is required');
    }

    return {
      sent: true,
      messageId: `MSG-${Date.now()}`,
    };
  }
}

export { NotifySupervisorToolLegacy as NotifySupervisorTool };
