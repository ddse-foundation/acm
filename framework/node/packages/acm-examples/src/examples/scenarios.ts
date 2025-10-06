import type { Goal, Context, Plan } from '@ddse/acm-sdk';
import type { ExecutePlanResult } from '@ddse/acm-runtime';
import { SimpleCapabilityRegistry, SimpleToolRegistry } from '../registries.js';
import {
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
} from '../tools/index.js';
import { RetrieveCustomerProfileTask, EvaluateEntitlementTask, SupervisorNotificationTask } from '../tasks/entitlement.js';
import { SearchKnowledgeTask, SummarizeSnippetTask, SuggestFollowupsTask } from '../tasks/knowledge.js';
import { FetchIncidentTask, ClassifySeverityTask, SelectQueueTask, EscalateIncidentTask as EscalateIncidentTaskClass } from '../tasks/incidents.js';
import { FetchInvoiceTask, FetchPurchaseOrderTask, CompareLineItemsTask, RecordFindingsTask } from '../tasks/invoices.js';
import { AnalyzeTranscriptTask, GenerateFeedbackTask, LogCoachingNoteTask } from '../tasks/coaching.js';
import { getTranscript } from '../data/coaching.js';

const capabilityMapVersion = 'v0.5-example-map';

export type ScenarioKey = 'entitlement' | 'knowledge' | 'incidents' | 'invoices' | 'coaching';

export type ScenarioReference = {
  plan: Plan;
  expectedOutputs: Record<string, any>;
};

export type ScenarioDefinition = {
  key: ScenarioKey;
  name: string;
  description: string;
  goal: Goal;
  context: Context;
  registerTools(registry: SimpleToolRegistry): void;
  registerCapabilities(registry: SimpleCapabilityRegistry): void;
  buildReferencePlan(): Promise<ScenarioReference>;
  assertExecution(result: ExecutePlanResult): void;
};

function extractOutputs(execution: ExecutePlanResult): Record<string, any> {
  const outputs: Record<string, any> = {};
  for (const [taskId, record] of Object.entries(execution.outputsByTask ?? {})) {
    outputs[taskId] = record?.output;
  }
  return outputs;
}

const entitlementTools = {
  fetch: new FetchCustomerProfileTool(),
  evaluate: new EvaluateEntitlementTool(),
  notify: new EntitlementNotifySupervisorTool(),
};

const entitlementTasks = {
  fetch: new RetrieveCustomerProfileTask(),
  evaluate: new EvaluateEntitlementTask(),
  notify: new SupervisorNotificationTask(),
};

const entitlementGoal: Goal = {
  id: 'goal-entitlement-1',
  intent: 'Determine if the customer qualifies for the Analytics Labs benefit and alert the supervisor if action is needed.',
  constraints: {
    responseTimeMinutes: 30,
    notifySupervisorOnDecision: true,
  },
};

const entitlementContext: Context = {
  id: 'ctx-entitlement-1',
  version: '1.0',
  facts: {
    customerId: 'CUST-104233',
    benefitCode: 'BEN-ANALYTICS-LABS',
    channel: 'email',
  },
};

async function buildEntitlementReferencePlan(): Promise<ScenarioReference> {
  const { customerId, benefitCode, channel } = entitlementContext.facts as {
    customerId: string;
    benefitCode: string;
    channel: 'email' | 'slack';
  };

  const fetchInput = { customerId };
  const fetchOutput = await entitlementTools.fetch.call(fetchInput);

  const evaluateInput = { customerId, benefitCode };
  const evaluateOutput = await entitlementTools.evaluate.call(evaluateInput);

  const decisionMessage = evaluateOutput.decision === 'allow'
    ? `Approved benefit ${benefitCode} for ${customerId}. SLA ${evaluateOutput.slaMinutes} minutes.`
    : `Denied benefit ${benefitCode} for ${customerId}. Violations: ${evaluateOutput.violations.map(v => v.code).join(', ')}`;

  const notifyInput = {
    customerId,
    decision: evaluateOutput.decision,
    channel,
    message: decisionMessage,
  };
  const notifyOutput = await entitlementTools.notify.call(notifyInput);

  const plan: Plan = {
    id: 'plan-entitlement-demo',
    contextRef: entitlementContext.id,
    capabilityMapVersion,
    tasks: [
      {
        id: entitlementTasks.fetch.id,
        capability: entitlementTasks.fetch.capability,
        input: fetchInput,
        verification: entitlementTasks.fetch.verification?.(),
      },
      {
        id: entitlementTasks.evaluate.id,
        capability: entitlementTasks.evaluate.capability,
        input: evaluateInput,
        verification: entitlementTasks.evaluate.verification?.(),
      },
      {
        id: entitlementTasks.notify.id,
        capability: entitlementTasks.notify.capability,
        input: notifyInput,
        verification: entitlementTasks.notify.verification?.(),
      },
    ],
    edges: [
      { from: entitlementTasks.fetch.id, to: entitlementTasks.evaluate.id },
      { from: entitlementTasks.evaluate.id, to: entitlementTasks.notify.id },
    ],
  };

  return {
    plan,
    expectedOutputs: {
      [entitlementTasks.fetch.id]: fetchOutput,
      [entitlementTasks.evaluate.id]: evaluateOutput,
      [entitlementTasks.notify.id]: notifyOutput,
    },
  };
}

const knowledgeTools = {
  search: new SearchKnowledgeTool(),
  summarize: new SummarizeSnippetTool(),
  followups: new SuggestFollowupsTool(),
};

const knowledgeTasks = {
  search: new SearchKnowledgeTask(),
  summarize: new SummarizeSnippetTask(),
  followups: new SuggestFollowupsTask(),
};

const knowledgeGoal: Goal = {
  id: 'goal-knowledge-1',
  intent: 'Surface relevant mitigation guidance for the API latency regression and propose follow-up actions.',
  constraints: {
    maxSnippets: 3,
    urgency: 'high',
  },
};

const knowledgeContext: Context = {
  id: 'ctx-knowledge-1',
  version: '1.0',
  facts: {
    query: 'latency regression mitigation',
    docId: 'KB-003',
  },
};

async function buildKnowledgeReferencePlan(): Promise<ScenarioReference> {
  const { query, docId } = knowledgeContext.facts as { query: string; docId: string };

  const searchInput = { query, limit: 3 };
  const searchOutput = await knowledgeTools.search.call(searchInput);

  const summarizeInput = { docId, maxSentences: 3, focus: 'stabilization steps' };
  const summarizeOutput = await knowledgeTools.summarize.call(summarizeInput);

  const followupInput = { docId, context: { channel: 'slack', urgency: 'high' as const } };
  const followupOutput = await knowledgeTools.followups.call(followupInput);

  const plan: Plan = {
    id: 'plan-knowledge-demo',
    contextRef: knowledgeContext.id,
    capabilityMapVersion,
    tasks: [
      {
        id: knowledgeTasks.search.id,
        capability: knowledgeTasks.search.capability,
        input: searchInput,
        verification: knowledgeTasks.search.verification?.(),
      },
      {
        id: knowledgeTasks.summarize.id,
        capability: knowledgeTasks.summarize.capability,
        input: summarizeInput,
        verification: knowledgeTasks.summarize.verification?.(),
      },
      {
        id: knowledgeTasks.followups.id,
        capability: knowledgeTasks.followups.capability,
        input: followupInput,
        verification: knowledgeTasks.followups.verification?.(),
      },
    ],
    edges: [
      { from: knowledgeTasks.search.id, to: knowledgeTasks.summarize.id },
      { from: knowledgeTasks.summarize.id, to: knowledgeTasks.followups.id },
    ],
  };

  return {
    plan,
    expectedOutputs: {
      [knowledgeTasks.search.id]: searchOutput,
      [knowledgeTasks.summarize.id]: summarizeOutput,
      [knowledgeTasks.followups.id]: followupOutput,
    },
  };
}

const incidentTools = {
  fetch: new FetchIncidentTool(),
  classify: new ClassifySeverityTool(),
  selectQueue: new SelectQueueTool(),
  escalate: new EscalateIncidentTool(),
};

const incidentTasks = {
  fetch: new FetchIncidentTask(),
  classify: new ClassifySeverityTask(),
  select: new SelectQueueTask(),
  escalate: new EscalateIncidentTaskClass(),
};

const incidentGoal: Goal = {
  id: 'goal-incident-1',
  intent: 'Triage the critical checkout outage and trigger the appropriate escalation path.',
  constraints: {
    routeWithinMinutes: 15,
    requireEscalationForCritical: true,
  },
};

const incidentContext: Context = {
  id: 'ctx-incident-1',
  version: '1.0',
  facts: {
    incidentId: 'INC-2045',
  },
};

async function buildIncidentReferencePlan(): Promise<ScenarioReference> {
  const { incidentId } = incidentContext.facts as { incidentId: string };

  const fetchInput = { incidentId };
  const fetchOutput = await incidentTools.fetch.call(fetchInput);

  const classifyInput = { incident: fetchOutput.incident };
  const classifyOutput = await incidentTools.classify.call(classifyInput);

  const selectInput = {
    incident: fetchOutput.incident,
    severityOverride: classifyOutput.severity,
  };
  const selectOutput = await incidentTools.selectQueue.call(selectInput);

  const escalateInput = {
    incidentId,
    target: selectOutput.rule.escalatesTo ?? 'incident-manager@northwind.example',
    reason: selectOutput.rationale.join(' '),
  };
  const escalateOutput = selectOutput.escalationRequired
    ? await incidentTools.escalate.call(escalateInput)
    : {
        escalated: false,
        ticketId: '',
        target: escalateInput.target,
        reason: escalateInput.reason,
        timestamp: new Date().toISOString(),
      };

  const plan: Plan = {
    id: 'plan-incident-demo',
    contextRef: incidentContext.id,
    capabilityMapVersion,
    tasks: [
      {
        id: incidentTasks.fetch.id,
        capability: incidentTasks.fetch.capability,
        input: fetchInput,
        verification: incidentTasks.fetch.verification?.(),
      },
      {
        id: incidentTasks.classify.id,
        capability: incidentTasks.classify.capability,
        input: classifyInput,
        verification: incidentTasks.classify.verification?.(),
      },
      {
        id: incidentTasks.select.id,
        capability: incidentTasks.select.capability,
        input: selectInput,
        verification: incidentTasks.select.verification?.(),
      },
      {
        id: incidentTasks.escalate.id,
        capability: incidentTasks.escalate.capability,
        input: escalateInput,
        verification: incidentTasks.escalate.verification?.(),
      },
    ],
    edges: [
      { from: incidentTasks.fetch.id, to: incidentTasks.classify.id },
      { from: incidentTasks.classify.id, to: incidentTasks.select.id },
      { from: incidentTasks.select.id, to: incidentTasks.escalate.id },
    ],
  };

  return {
    plan,
    expectedOutputs: {
      [incidentTasks.fetch.id]: fetchOutput,
      [incidentTasks.classify.id]: classifyOutput,
      [incidentTasks.select.id]: selectOutput,
      [incidentTasks.escalate.id]: escalateOutput,
    },
  };
}

const invoiceTools = {
  fetchInvoice: new FetchInvoiceTool(),
  fetchPO: new FetchPurchaseOrderTool(),
  compare: new CompareLineItemsTool(),
  record: new RecordFindingsTool(),
};

const invoiceTasks = {
  fetchInvoice: new FetchInvoiceTask(),
  fetchPO: new FetchPurchaseOrderTask(),
  compare: new CompareLineItemsTask(),
  record: new RecordFindingsTask(),
};

const invoiceGoal: Goal = {
  id: 'goal-invoice-1',
  intent: 'Reconcile the Skyline Components invoice against the approved purchase order and log findings.',
  constraints: {
    varianceToleranceUsd: 500,
  },
};

const invoiceContext: Context = {
  id: 'ctx-invoice-1',
  version: '1.0',
  facts: {
    invoiceId: 'INV-84721',
    purchaseOrderId: 'PO-99231',
  },
};

async function buildInvoiceReferencePlan(): Promise<ScenarioReference> {
  const { invoiceId, purchaseOrderId } = invoiceContext.facts as {
    invoiceId: string;
    purchaseOrderId: string;
  };

  const fetchInvoiceInput = { invoiceId };
  const fetchInvoiceOutput = await invoiceTools.fetchInvoice.call(fetchInvoiceInput);

  const fetchPOInput = { purchaseOrderId };
  const fetchPOOutput = await invoiceTools.fetchPO.call(fetchPOInput);

  const compareInput = { invoice: fetchInvoiceOutput.invoice, purchaseOrder: fetchPOOutput.purchaseOrder };
  const compareOutput = await invoiceTools.compare.call(compareInput);

  const recordInput = {
    invoice: fetchInvoiceOutput.invoice,
    purchaseOrder: fetchPOOutput.purchaseOrder,
    discrepancies: compareOutput.discrepancies,
    variance: compareOutput.variance,
  };
  const recordOutput = await invoiceTools.record.call(recordInput);

  const plan: Plan = {
    id: 'plan-invoice-demo',
    contextRef: invoiceContext.id,
    capabilityMapVersion,
    tasks: [
      {
        id: invoiceTasks.fetchInvoice.id,
        capability: invoiceTasks.fetchInvoice.capability,
        input: fetchInvoiceInput,
        verification: invoiceTasks.fetchInvoice.verification?.(),
      },
      {
        id: invoiceTasks.fetchPO.id,
        capability: invoiceTasks.fetchPO.capability,
        input: fetchPOInput,
        verification: invoiceTasks.fetchPO.verification?.(),
      },
      {
        id: invoiceTasks.compare.id,
        capability: invoiceTasks.compare.capability,
        input: compareInput,
        verification: invoiceTasks.compare.verification?.(),
      },
      {
        id: invoiceTasks.record.id,
        capability: invoiceTasks.record.capability,
        input: recordInput,
        verification: invoiceTasks.record.verification?.(),
      },
    ],
    edges: [
      { from: invoiceTasks.fetchInvoice.id, to: invoiceTasks.fetchPO.id },
      { from: invoiceTasks.fetchPO.id, to: invoiceTasks.compare.id },
      { from: invoiceTasks.compare.id, to: invoiceTasks.record.id },
    ],
  };

  return {
    plan,
    expectedOutputs: {
      [invoiceTasks.fetchInvoice.id]: fetchInvoiceOutput,
      [invoiceTasks.fetchPO.id]: fetchPOOutput,
      [invoiceTasks.compare.id]: compareOutput,
      [invoiceTasks.record.id]: recordOutput,
    },
  };
}

const coachingTools = {
  analyze: new AnalyzeTranscriptTool(),
  generate: new GenerateFeedbackTool(),
  log: new LogCoachingNoteTool(),
};

const coachingTasks = {
  analyze: new AnalyzeTranscriptTask(),
  generate: new GenerateFeedbackTask(),
  log: new LogCoachingNoteTask(),
};

const coachingGoal: Goal = {
  id: 'goal-coaching-1',
  intent: 'Review the escalated transcript, craft coaching feedback, and log the session for the agent manager.',
  constraints: {
    completionMinutes: 20,
  },
};

const coachingContext: Context = {
  id: 'ctx-coaching-1',
  version: '1.0',
  facts: {
    transcriptId: 'TRANS-5540',
  },
};

async function buildCoachingReferencePlan(): Promise<ScenarioReference> {
  const { transcriptId } = coachingContext.facts as { transcriptId: string };

  const transcript = await getTranscript(transcriptId);
  if (!transcript) {
    throw new Error(`Transcript ${transcriptId} not found for scenario setup`);
  }

  const analyzeInput = { transcriptId };
  const analyzeOutput = await coachingTools.analyze.call(analyzeInput);

  const generateInput = {
    transcriptId,
    metrics: {
      sentimentScore: analyzeOutput.sentimentScore,
      complianceScore: analyzeOutput.complianceScore,
      complianceBreaches: analyzeOutput.complianceBreaches,
      highlights: analyzeOutput.highlights,
      summary: analyzeOutput.summary,
    },
  };
  const generateOutput = await coachingTools.generate.call(generateInput);

  const logInput = {
    agentId: transcript.agentId,
    feedbackSummary: generateOutput.feedbackSummary,
    actionItems: generateOutput.actionItems,
    escalationRequired: generateOutput.escalationRequired,
  };
  const logOutput = await coachingTools.log.call(logInput);

  const plan: Plan = {
    id: 'plan-coaching-demo',
    contextRef: coachingContext.id,
    capabilityMapVersion,
    tasks: [
      {
        id: coachingTasks.analyze.id,
        capability: coachingTasks.analyze.capability,
        input: analyzeInput,
        verification: coachingTasks.analyze.verification?.(),
      },
      {
        id: coachingTasks.generate.id,
        capability: coachingTasks.generate.capability,
        input: generateInput,
        verification: coachingTasks.generate.verification?.(),
      },
      {
        id: coachingTasks.log.id,
        capability: coachingTasks.log.capability,
        input: logInput,
        verification: coachingTasks.log.verification?.(),
      },
    ],
    edges: [
      { from: coachingTasks.analyze.id, to: coachingTasks.generate.id },
      { from: coachingTasks.generate.id, to: coachingTasks.log.id },
    ],
  };

  return {
    plan,
    expectedOutputs: {
      [coachingTasks.analyze.id]: analyzeOutput,
      [coachingTasks.generate.id]: generateOutput,
      [coachingTasks.log.id]: logOutput,
    },
  };
}

function registerEntitlementTools(registry: SimpleToolRegistry): void {
  registry.register(entitlementTools.fetch);
  registry.register(entitlementTools.evaluate);
  registry.register(entitlementTools.notify);
}

function registerEntitlementCapabilities(registry: SimpleCapabilityRegistry): void {
  registry.register({ name: entitlementTasks.fetch.capability, sideEffects: false }, entitlementTasks.fetch);
  registry.register({ name: entitlementTasks.evaluate.capability, sideEffects: false }, entitlementTasks.evaluate);
  registry.register({ name: entitlementTasks.notify.capability, sideEffects: true }, entitlementTasks.notify);
}

function registerKnowledgeTools(registry: SimpleToolRegistry): void {
  registry.register(knowledgeTools.search);
  registry.register(knowledgeTools.summarize);
  registry.register(knowledgeTools.followups);
}

function registerKnowledgeCapabilities(registry: SimpleCapabilityRegistry): void {
  registry.register({ name: knowledgeTasks.search.capability, sideEffects: false }, knowledgeTasks.search);
  registry.register({ name: knowledgeTasks.summarize.capability, sideEffects: false }, knowledgeTasks.summarize);
  registry.register({ name: knowledgeTasks.followups.capability, sideEffects: false }, knowledgeTasks.followups);
}

function registerIncidentTools(registry: SimpleToolRegistry): void {
  registry.register(incidentTools.fetch);
  registry.register(incidentTools.classify);
  registry.register(incidentTools.selectQueue);
  registry.register(incidentTools.escalate);
}

function registerIncidentCapabilities(registry: SimpleCapabilityRegistry): void {
  registry.register({ name: incidentTasks.fetch.capability, sideEffects: false }, incidentTasks.fetch);
  registry.register({ name: incidentTasks.classify.capability, sideEffects: false }, incidentTasks.classify);
  registry.register({ name: incidentTasks.select.capability, sideEffects: false }, incidentTasks.select);
  registry.register({ name: incidentTasks.escalate.capability, sideEffects: true }, incidentTasks.escalate);
}

function registerInvoiceTools(registry: SimpleToolRegistry): void {
  registry.register(invoiceTools.fetchInvoice);
  registry.register(invoiceTools.fetchPO);
  registry.register(invoiceTools.compare);
  registry.register(invoiceTools.record);
}

function registerInvoiceCapabilities(registry: SimpleCapabilityRegistry): void {
  registry.register({ name: invoiceTasks.fetchInvoice.capability, sideEffects: false }, invoiceTasks.fetchInvoice);
  registry.register({ name: invoiceTasks.fetchPO.capability, sideEffects: false }, invoiceTasks.fetchPO);
  registry.register({ name: invoiceTasks.compare.capability, sideEffects: false }, invoiceTasks.compare);
  registry.register({ name: invoiceTasks.record.capability, sideEffects: true }, invoiceTasks.record);
}

function registerCoachingTools(registry: SimpleToolRegistry): void {
  registry.register(coachingTools.analyze);
  registry.register(coachingTools.generate);
  registry.register(coachingTools.log);
}

function registerCoachingCapabilities(registry: SimpleCapabilityRegistry): void {
  registry.register({ name: coachingTasks.analyze.capability, sideEffects: false }, coachingTasks.analyze);
  registry.register({ name: coachingTasks.generate.capability, sideEffects: false }, coachingTasks.generate);
  registry.register({ name: coachingTasks.log.capability, sideEffects: true }, coachingTasks.log);
}

export const scenarios: Record<ScenarioKey, ScenarioDefinition> = {
  entitlement: {
    key: 'entitlement',
    name: 'Entitlement Decisioning',
    description: 'Evaluate a premium benefit entitlement and notify the supervisor with the decision.',
    goal: entitlementGoal,
    context: entitlementContext,
    registerTools: registerEntitlementTools,
  registerCapabilities: registerEntitlementCapabilities,
  buildReferencePlan: buildEntitlementReferencePlan,
    assertExecution(result) {
      const outputs = extractOutputs(result);
      const notify = outputs[entitlementTasks.notify.id];
      if (!notify?.notified) {
        throw new Error('Entitlement scenario: supervisor notification not sent');
      }
      if (notify.decision && notify.decision !== 'allow' && notify.decision !== 'deny') {
        throw new Error('Entitlement scenario: invalid decision flag');
      }
    },
  },
  knowledge: {
    key: 'knowledge',
    name: 'Knowledge Acceleration',
    description: 'Retrieve and summarize knowledge for an urgent latency regression and produce follow-up actions.',
    goal: knowledgeGoal,
    context: knowledgeContext,
    registerTools: registerKnowledgeTools,
  registerCapabilities: registerKnowledgeCapabilities,
  buildReferencePlan: buildKnowledgeReferencePlan,
    assertExecution(result) {
      const outputs = extractOutputs(result);
      const summary = outputs[knowledgeTasks.summarize.id];
      if (!summary?.summary) {
        throw new Error('Knowledge scenario: summary missing');
      }
      const followups = outputs[knowledgeTasks.followups.id];
      if (!Array.isArray(followups?.suggestions) || followups.suggestions.length === 0) {
        throw new Error('Knowledge scenario: follow-up suggestions missing');
      }
    },
  },
  incidents: {
    key: 'incidents',
    name: 'Incident Triage',
    description: 'Classify a critical incident, route it to the correct queue, and escalate if required.',
    goal: incidentGoal,
    context: incidentContext,
    registerTools: registerIncidentTools,
  registerCapabilities: registerIncidentCapabilities,
  buildReferencePlan: buildIncidentReferencePlan,
    assertExecution(result) {
      const outputs = extractOutputs(result);
      const classify = outputs[incidentTasks.classify.id];
      if (!classify?.severity) {
        throw new Error('Incident scenario: severity missing');
      }
      const select = outputs[incidentTasks.select.id];
      if (!select?.queue) {
        throw new Error('Incident scenario: queue not selected');
      }
    },
  },
  invoices: {
    key: 'invoices',
    name: 'Invoice Reconciliation',
    description: 'Compare invoice line-items against a purchase order and archive the findings report.',
    goal: invoiceGoal,
    context: invoiceContext,
    registerTools: registerInvoiceTools,
  registerCapabilities: registerInvoiceCapabilities,
  buildReferencePlan: buildInvoiceReferencePlan,
    assertExecution(result) {
      const outputs = extractOutputs(result);
      const compare = outputs[invoiceTasks.compare.id];
      if (!compare || typeof compare.variance !== 'number') {
        throw new Error('Invoice scenario: variance missing');
      }
      const record = outputs[invoiceTasks.record.id];
      if (!record?.reportId) {
        throw new Error('Invoice scenario: findings report not produced');
      }
    },
  },
  coaching: {
    key: 'coaching',
    name: 'Agent Coaching',
    description: 'Analyze a transcript for sentiment, generate coaching feedback, and log the coaching note.',
    goal: coachingGoal,
    context: coachingContext,
    registerTools: registerCoachingTools,
  registerCapabilities: registerCoachingCapabilities,
  buildReferencePlan: buildCoachingReferencePlan,
    assertExecution(result) {
      const outputs = extractOutputs(result);
      const feedback = outputs[coachingTasks.generate.id];
      if (!feedback?.feedbackSummary) {
        throw new Error('Coaching scenario: feedback summary missing');
      }
      const log = outputs[coachingTasks.log.id];
      if (!log?.stored) {
        throw new Error('Coaching scenario: coaching note not stored');
      }
    },
  },
};

export function listScenarioKeys(): ScenarioKey[] {
  return Object.keys(scenarios) as ScenarioKey[];
}

export function getScenario(key: string): ScenarioDefinition | undefined {
  return scenarios[key as ScenarioKey];
}
