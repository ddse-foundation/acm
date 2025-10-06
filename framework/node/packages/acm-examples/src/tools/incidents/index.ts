import { Tool } from '@ddse/acm-sdk';
import {
  getIncident,
  findRoutingRule,
  type IncidentRecord,
  type IncidentSeverity,
  type RoutingRule,
} from '../../data/incidents.js';

export type FetchIncidentInput = {
  incidentId: string;
};

export type FetchIncidentOutput = {
  incident: IncidentRecord;
};

export class FetchIncidentTool extends Tool<FetchIncidentInput, FetchIncidentOutput> {
  name(): string {
    return 'fetch_incident';
  }

  async call(input: FetchIncidentInput): Promise<FetchIncidentOutput> {
    if (!input?.incidentId) {
      throw new Error('incidentId is required');
    }

    const incident = await getIncident(input.incidentId);
    if (!incident) {
      throw new Error(`Incident ${input.incidentId} not found`);
    }

    return { incident };
  }
}

export type ClassifySeverityInput = {
  incident: IncidentRecord;
};

export type ClassifySeverityOutput = {
  severity: IncidentSeverity;
  score: number;
  rationale: string[];
};

function scoreSeverity(incident: IncidentRecord): { severity: IncidentSeverity; score: number; rationale: string[] } {
  const rationale: string[] = [];
  let score = 0;

  const declaredRank = rank(incident.declaredSeverity);
  score += declaredRank * 20;
  rationale.push(`Declared severity ${incident.declaredSeverity} provides base score ${declaredRank * 20}`);

  if (incident.customerImpact === 'MAJOR') {
    score += 30;
    rationale.push('Major customer impact adds 30 points');
  } else if (incident.customerImpact === 'MINOR') {
    score += 15;
    rationale.push('Minor customer impact adds 15 points');
  }

  score += Math.min(incident.signalScore, 40);
  rationale.push(`Signal score contribution: ${Math.min(incident.signalScore, 40)}`);

  if (incident.vipCustomer) {
    score += 10;
    rationale.push('VIP customer flag adds 10 points');
  }

  const severity = score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
  rationale.push(`Composite score ${score} maps to severity ${severity}`);
  return { severity, score, rationale };
}

function rank(severity: IncidentSeverity): number {
  switch (severity) {
    case 'LOW': return 1;
    case 'MEDIUM': return 2;
    case 'HIGH': return 3;
    case 'CRITICAL': return 4;
    default: return 0;
  }
}

export class ClassifySeverityTool extends Tool<
  ClassifySeverityInput,
  ClassifySeverityOutput
> {
  name(): string {
    return 'classify_severity';
  }

  async call(input: ClassifySeverityInput): Promise<ClassifySeverityOutput> {
    if (!input?.incident) {
      throw new Error('incident is required');
    }

    return scoreSeverity(input.incident);
  }
}

export type SelectQueueInput = {
  incident: IncidentRecord;
  severityOverride?: IncidentSeverity;
};

export type SelectQueueOutput = {
  queue: string;
  rule: RoutingRule;
  escalationRequired: boolean;
  rationale: string[];
};

export class SelectQueueTool extends Tool<SelectQueueInput, SelectQueueOutput> {
  name(): string {
    return 'select_queue';
  }

  async call(input: SelectQueueInput): Promise<SelectQueueOutput> {
    if (!input?.incident) {
      throw new Error('incident is required');
    }

    const rule = await findRoutingRule(input.incident, input.severityOverride);
    if (!rule) {
      throw new Error(`No routing rule found for incident ${input.incident.id}`);
    }

    const rationale = [
      `Matched routing rule ${rule.id} for service ${rule.service} category ${rule.category}`,
    ];
    if (rule.escalatesTo) {
      rationale.push(`Escalation target defined: ${rule.escalatesTo}`);
    }
    if (rule.notes) {
      rationale.push(`Routing notes: ${rule.notes}`);
    }

    return {
      queue: rule.queue,
      rule,
      escalationRequired: Boolean(rule.escalatesTo),
      rationale,
    };
  }
}

export type EscalateIncidentInput = {
  incidentId: string;
  target: string;
  reason: string;
};

export type EscalateIncidentOutput = {
  escalated: boolean;
  ticketId: string;
  target: string;
  reason: string;
  timestamp: string;
};

export class EscalateIncidentTool extends Tool<
  EscalateIncidentInput,
  EscalateIncidentOutput
> {
  name(): string {
    return 'escalate_incident';
  }

  async call(input: EscalateIncidentInput): Promise<EscalateIncidentOutput> {
    if (!input?.incidentId || !input?.target || !input?.reason) {
      throw new Error('incidentId, target, and reason are required');
    }

    const ticketId = `esc-${Date.now()}`;
    return {
      escalated: true,
      ticketId,
      target: input.target,
      reason: input.reason,
      timestamp: new Date().toISOString(),
    };
  }
}
