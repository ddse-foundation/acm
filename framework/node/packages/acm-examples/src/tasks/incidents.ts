import { Task, type RunContext } from '@acm/sdk';
import type { IncidentRecord, IncidentSeverity } from '../data/incidents.js';
import {
  type FetchIncidentInput,
  type FetchIncidentOutput,
  type ClassifySeverityOutput,
  type SelectQueueOutput,
  type EscalateIncidentInput,
  type EscalateIncidentOutput,
} from '../tools/incidents/index.js';

export class FetchIncidentTask extends Task<FetchIncidentInput, FetchIncidentOutput> {
  constructor() {
    super('task-incident-fetch', 'incident.fetch');
  }

  idemKey(_ctx: RunContext, input: FetchIncidentInput): string | undefined {
    return input?.incidentId ? `incident:${input.incidentId}` : undefined;
  }

  policyInput(_ctx: RunContext, input: FetchIncidentInput): Record<string, unknown> {
    return {
      action: 'fetch_incident',
      incidentId: input.incidentId,
    };
  }

  verification(): string[] {
    return ['output.incident !== undefined'];
  }

  async execute(
    ctx: RunContext,
    input: FetchIncidentInput
  ): Promise<FetchIncidentOutput> {
    const tool = ctx.getTool('fetch_incident');
    if (!tool) {
      throw new Error('fetch_incident tool is not registered');
    }

    const result = (await tool.call(input)) as FetchIncidentOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'incident_loaded',
      incidentId: input.incidentId,
    });
    return result;
  }
}

export interface ClassifySeverityTaskInput {
  incident?: IncidentRecord;
  incidentId?: string;
}

export class ClassifySeverityTask extends Task<
  ClassifySeverityTaskInput,
  ClassifySeverityOutput
> {
  constructor() {
    super('task-incident-classify', 'incident.classify_severity');
  }

  policyInput(_ctx: RunContext, input: ClassifySeverityTaskInput): Record<string, unknown> {
    const incident = this.resolveIncident(_ctx, input);
    return {
      action: 'classify_severity',
      incidentId: incident?.id ?? input.incidentId,
    };
  }

  verification(): string[] {
    return ['output.severity !== undefined', 'typeof output.score === "number"'];
  }

  async execute(
    ctx: RunContext,
    input: ClassifySeverityTaskInput
  ): Promise<ClassifySeverityOutput> {
    const tool = ctx.getTool('classify_severity');
    if (!tool) {
      throw new Error('classify_severity tool is not registered');
    }

    const incident = this.resolveIncident(ctx, input);
    if (!incident) {
      throw new Error('incident is required');
    }

    const result = (await tool.call({ incident })) as ClassifySeverityOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'incident_severity_classified',
      incidentId: incident.id,
      severity: result.severity,
      score: result.score,
    });
    return result;
  }

  private resolveIncident(
    ctx: RunContext,
    input: ClassifySeverityTaskInput
  ): IncidentRecord | undefined {
    if (input?.incident) {
      return input.incident;
    }

    const fetchOutput = ctx.outputs?.['task-incident-fetch'] as FetchIncidentOutput | undefined;
    const incident = fetchOutput?.incident;
    if (!incident) {
      return undefined;
    }

    if (!input?.incidentId || incident.id === input.incidentId) {
      return incident;
    }

    return undefined;
  }
}

export interface SelectQueueTaskInput {
  incident?: IncidentRecord;
  incidentId?: string;
  severityOverride?: IncidentSeverity;
}

export class SelectQueueTask extends Task<SelectQueueTaskInput, SelectQueueOutput> {
  constructor() {
    super('task-incident-route', 'incident.select_queue');
  }

  policyInput(_ctx: RunContext, input: SelectQueueTaskInput): Record<string, unknown> {
    const incident = this.resolveIncident(_ctx, input);
    const severityOverride = this.resolveSeverityOverride(_ctx, input);
    return {
      action: 'select_queue',
      incidentId: incident?.id ?? input.incidentId,
      severityOverride,
    };
  }

  verification(): string[] {
    return ['typeof output.queue === "string"', 'output.rule !== undefined'];
  }

  async execute(
    ctx: RunContext,
    input: SelectQueueTaskInput
  ): Promise<SelectQueueOutput> {
    const tool = ctx.getTool('select_queue');
    if (!tool) {
      throw new Error('select_queue tool is not registered');
    }

    const incident = this.resolveIncident(ctx, input);
    if (!incident) {
      throw new Error('incident is required');
    }

    const severityOverride = this.resolveSeverityOverride(ctx, input);
    const result = (await tool.call({ incident, severityOverride })) as SelectQueueOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'incident_queue_selected',
      incidentId: incident.id,
      queue: result.queue,
      escalationRequired: result.escalationRequired,
    });
    return result;
  }

  private resolveIncident(
    ctx: RunContext,
    input: SelectQueueTaskInput
  ): IncidentRecord | undefined {
    if (input?.incident) {
      return input.incident;
    }

    const fetchOutput = ctx.outputs?.['task-incident-fetch'] as FetchIncidentOutput | undefined;
    const incident = fetchOutput?.incident;
    if (!incident) {
      return undefined;
    }

    if (!input?.incidentId || incident.id === input.incidentId) {
      return incident;
    }

    return undefined;
  }

  private resolveSeverityOverride(
    ctx: RunContext,
    input: SelectQueueTaskInput
  ): IncidentSeverity | undefined {
    if (input?.severityOverride) {
      return input.severityOverride;
    }

    const classifyOutput = ctx.outputs?.['task-incident-classify'] as ClassifySeverityOutput | undefined;
    return classifyOutput?.severity;
  }
}

export class EscalateIncidentTask extends Task<
  EscalateIncidentInput,
  EscalateIncidentOutput
> {
  constructor() {
    super('task-incident-escalate', 'incident.escalate');
  }

  policyInput(_ctx: RunContext, input: EscalateIncidentInput): Record<string, unknown> {
    const resolved = this.resolveEscalationInput(_ctx, input);
    return {
      action: 'escalate_incident',
      incidentId: resolved.incidentId,
      target: resolved.target,
    };
  }

  verification(): string[] {
    return ['output.escalated === true', 'typeof output.ticketId === "string"'];
  }

  async execute(
    ctx: RunContext,
    input: EscalateIncidentInput
  ): Promise<EscalateIncidentOutput> {
    const tool = ctx.getTool('escalate_incident');
    if (!tool) {
      throw new Error('escalate_incident tool is not registered');
    }

    const resolved = this.resolveEscalationInput(ctx, input);
    const result = (await tool.call(resolved)) as EscalateIncidentOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'incident_escalated',
      incidentId: resolved.incidentId,
      target: result.target,
      ticketId: result.ticketId,
    });
    return result;
  }

  private resolveEscalationInput(
    ctx: RunContext,
    input: EscalateIncidentInput
  ): EscalateIncidentInput {
    const fetchOutput = ctx.outputs?.['task-incident-fetch'] as FetchIncidentOutput | undefined;
    const selectOutput = ctx.outputs?.['task-incident-route'] as SelectQueueOutput | undefined;

    const incidentId = input?.incidentId ?? fetchOutput?.incident?.id;
    const target = input?.target ?? selectOutput?.rule?.escalatesTo ?? 'incident-manager@northwind.example';
    const reason =
      input?.reason ??
      (selectOutput?.rationale?.join(' ') || 'Escalation triggered by routing decision.');

    if (!incidentId) {
      throw new Error('incidentId is required for escalation');
    }

    if (!target) {
      throw new Error('Escalation target could not be determined');
    }

    return {
      incidentId,
      target,
      reason,
    };
  }
}
