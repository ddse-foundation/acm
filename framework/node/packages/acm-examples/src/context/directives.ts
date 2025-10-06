import { ExternalContextProviderAdapter, Tool, type ContextRetrievalArtifact } from '@ddse/acm-sdk';
import { getCustomerProfile, getPolicy } from '../data/entitlement.js';
import { getSnippetMeta, loadSnippetContent } from '../data/knowledge.js';
import { getIncident, findRoutingRule } from '../data/incidents.js';
import { getInvoice, getPurchaseOrder } from '../data/invoices.js';
import { getTranscript, getAgent } from '../data/coaching.js';

function extractPayload(directive: string): string | Record<string, any> | undefined {
  const separator = directive.indexOf(':');
  if (separator < 0) {
    return undefined;
  }

  const raw = directive.slice(separator + 1).trim();
  if (!raw) {
    return undefined;
  }

  if (raw.startsWith('{')) {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  return raw;
}

abstract class ContextTool<I> extends Tool<I, ContextRetrievalArtifact[]> {
  async call(input: I): Promise<ContextRetrievalArtifact[]> {
    const artifacts = await this.produceArtifacts(input);
    return Array.isArray(artifacts) ? artifacts : [artifacts];
  }

  protected abstract produceArtifacts(input: I): Promise<ContextRetrievalArtifact | ContextRetrievalArtifact[]>;
}

class CustomerContextTool extends ContextTool<{ customerId: string }> {
  name(): string {
    return 'crm';
  }

  protected async produceArtifacts(input: { customerId: string }): Promise<ContextRetrievalArtifact> {
    const customer = await getCustomerProfile(input.customerId);
    if (!customer) {
      throw new Error(`Customer ${input.customerId} not found`);
    }

    return {
      type: 'crm.customer',
      content: customer,
      promote: true,
      provenance: {
        tool: this.name(),
        customerId: input.customerId,
      },
    };
  }
}

class PolicyContextTool extends ContextTool<{ benefitCode: string }> {
  name(): string {
    return 'policy';
  }

  protected async produceArtifacts(input: { benefitCode: string }): Promise<ContextRetrievalArtifact> {
    const policy = await getPolicy(input.benefitCode);
    if (!policy) {
      throw new Error(`Policy ${input.benefitCode} not found`);
    }

    return {
      type: 'crm.policy',
      content: policy,
      promote: true,
      provenance: {
        tool: this.name(),
        benefitCode: input.benefitCode,
      },
    };
  }
}

class KnowledgeContextTool extends ContextTool<{ docId: string }> {
  name(): string {
    return 'kb';
  }

  protected async produceArtifacts(input: { docId: string }): Promise<ContextRetrievalArtifact[]> {
    const [meta, content] = await Promise.all([
      getSnippetMeta(input.docId),
      loadSnippetContent(input.docId),
    ]);

    if (!meta || !content) {
      throw new Error(`Knowledge doc ${input.docId} not found`);
    }

    return [
      {
        type: 'kb.meta',
        content: meta,
        promote: true,
        provenance: {
          tool: this.name(),
          docId: input.docId,
          stage: 'metadata',
        },
      },
      {
        type: 'kb.content',
        content: content,
        promote: false,
        provenance: {
          tool: this.name(),
          docId: input.docId,
          stage: 'content',
        },
      },
    ];
  }
}

class IncidentContextTool extends ContextTool<{ incidentId: string }> {
  name(): string {
    return 'inc';
  }

  protected async produceArtifacts(input: { incidentId: string }): Promise<ContextRetrievalArtifact> {
    const incident = await getIncident(input.incidentId);
    if (!incident) {
      throw new Error(`Incident ${input.incidentId} not found`);
    }

    return {
      type: 'incident.record',
      content: incident,
      promote: true,
      provenance: {
        tool: this.name(),
        incidentId: input.incidentId,
      },
    };
  }
}

class RoutingContextTool extends ContextTool<{ incidentId: string; severity?: string }> {
  name(): string {
    return 'routing';
  }

  protected async produceArtifacts(input: { incidentId: string; severity?: string }): Promise<ContextRetrievalArtifact> {
    const incident = await getIncident(input.incidentId);
    if (!incident) {
      throw new Error(`Incident ${input.incidentId} not found for routing lookup`);
    }

    const rule = await findRoutingRule(incident, input.severity as any);
    if (!rule) {
      throw new Error(`Routing rule not found for incident ${input.incidentId}`);
    }

    return {
      type: 'incident.routing_rule',
      content: rule,
      promote: true,
      provenance: {
        tool: this.name(),
        incidentId: input.incidentId,
        severity: input.severity,
      },
    };
  }
}

class InvoiceContextTool extends ContextTool<{ invoiceId: string }> {
  name(): string {
    return 'erp';
  }

  protected async produceArtifacts(input: { invoiceId: string }): Promise<ContextRetrievalArtifact[]> {
    const invoice = await getInvoice(input.invoiceId);
    if (!invoice) {
      throw new Error(`Invoice ${input.invoiceId} not found`);
    }

    const purchaseOrder = invoice.purchaseOrderId
      ? await getPurchaseOrder(invoice.purchaseOrderId)
      : undefined;

    const artifacts: ContextRetrievalArtifact[] = [
      {
        type: 'erp.invoice',
        content: invoice,
        promote: true,
        provenance: {
          tool: this.name(),
          stage: 'invoice',
          invoiceId: input.invoiceId,
        },
      },
    ];

    if (purchaseOrder) {
      artifacts.push({
        type: 'erp.purchase_order',
        content: purchaseOrder,
        promote: true,
        provenance: {
          tool: this.name(),
          stage: 'purchase-order',
          invoiceId: input.invoiceId,
          purchaseOrderId: purchaseOrder.id,
        },
      });
    }

    return artifacts;
  }
}

class TranscriptContextTool extends ContextTool<{ transcriptId: string }> {
  name(): string {
    return 'transcript';
  }

  protected async produceArtifacts(input: { transcriptId: string }): Promise<ContextRetrievalArtifact[]> {
    const transcript = await getTranscript(input.transcriptId);
    if (!transcript) {
      throw new Error(`Transcript ${input.transcriptId} not found`);
    }

    const agent = await getAgent(transcript.agentId);

    const artifacts: ContextRetrievalArtifact[] = [
      {
        type: 'coaching.transcript',
        content: transcript,
        promote: true,
        provenance: {
          tool: this.name(),
          transcriptId: input.transcriptId,
        },
      },
    ];

    if (agent) {
      artifacts.push({
        type: 'coaching.agent',
        content: agent,
        promote: true,
        provenance: {
          tool: this.name(),
          transcriptId: input.transcriptId,
          stage: 'agent-profile',
        },
      });
    }

    return artifacts;
  }
}

export function registerExampleContextProviders(adapter: ExternalContextProviderAdapter): void {
  const customerTool = new CustomerContextTool();
  adapter.register(customerTool, {
    match: directive => directive.startsWith('crm:'),
    buildInput: directive => {
      const payload = extractPayload(directive);
      if (typeof payload !== 'string') {
        throw new Error(`crm directive expects customer id payload, got ${JSON.stringify(payload)}`);
      }
      return { customerId: payload };
    },
    describe: 'CRM customer profile loader',
  });

  const policyTool = new PolicyContextTool();
  adapter.register(policyTool, {
    match: directive => directive.startsWith('policy:'),
    buildInput: directive => {
      const payload = extractPayload(directive);
      if (typeof payload !== 'string') {
        throw new Error(`policy directive expects benefit code payload`);
      }
      return { benefitCode: payload };
    },
    describe: 'Entitlement policy lookup',
  });

  const knowledgeTool = new KnowledgeContextTool();
  adapter.register(knowledgeTool, {
    match: directive => directive.startsWith('kb:'),
    buildInput: directive => {
      const payload = extractPayload(directive);
      if (typeof payload !== 'string') {
        throw new Error(`kb directive expects document id payload`);
      }
      return { docId: payload };
    },
    autoPromote: false,
    describe: 'Knowledge base snippet fetcher',
  });

  const incidentTool = new IncidentContextTool();
  adapter.register(incidentTool, {
    match: directive => directive.startsWith('inc:'),
    buildInput: directive => {
      const payload = extractPayload(directive);
      if (typeof payload !== 'string') {
        throw new Error('inc directive expects incident id payload');
      }
      return { incidentId: payload };
    },
    describe: 'Incident record retrieval',
  });

  const routingTool = new RoutingContextTool();
  adapter.register(routingTool, {
    match: directive => directive.startsWith('routing:'),
    buildInput: directive => {
      const payload = extractPayload(directive);
      if (typeof payload === 'string') {
        return { incidentId: payload };
      }
      if (payload && typeof payload === 'object' && typeof payload.incidentId === 'string') {
        return {
          incidentId: payload.incidentId,
          severity: typeof payload.severity === 'string' ? payload.severity : undefined,
        };
      }
      throw new Error('routing directive expects incident id payload');
    },
    describe: 'Routing rule lookup',
  });

  const invoiceTool = new InvoiceContextTool();
  adapter.register(invoiceTool, {
    match: directive => directive.startsWith('erp:'),
    buildInput: directive => {
      const payload = extractPayload(directive);
      if (typeof payload === 'string') {
        return { invoiceId: payload };
      }
      if (payload && typeof payload === 'object' && typeof payload.invoiceId === 'string') {
        return { invoiceId: payload.invoiceId };
      }
      throw new Error('erp directive expects invoice id payload');
    },
    describe: 'ERP invoice + purchase order fetcher',
  });

  const transcriptTool = new TranscriptContextTool();
  adapter.register(transcriptTool, {
    match: directive => directive.startsWith('transcript:'),
    buildInput: directive => {
      const payload = extractPayload(directive);
      if (typeof payload !== 'string') {
        throw new Error('transcript directive expects transcript id payload');
      }
      return { transcriptId: payload };
    },
    describe: 'Contact center transcript loader',
  });
}
