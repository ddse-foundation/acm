import { Task, type RunContext } from '@acm/sdk';
import type { CustomerProfile } from '../data/entitlement.js';
import {
  type FetchCustomerProfileInput,
  type FetchCustomerProfileOutput,
  type EvaluateEntitlementInput,
  type EvaluateEntitlementOutput,
  type NotifySupervisorInput as EntitlementNotifySupervisorInput,
  type NotifySupervisorOutput as EntitlementNotifySupervisorOutput,
} from '../tools/entitlement/index.js';

export class RetrieveCustomerProfileTask extends Task<
  FetchCustomerProfileInput,
  FetchCustomerProfileOutput
> {
  constructor() {
    super('task-entitlement-fetch-customer', 'entitlement.fetch_customer_profile');
  }

  idemKey(_ctx: RunContext, input: FetchCustomerProfileInput): string | undefined {
    return input?.customerId ? `entitlement:customer:${input.customerId}` : undefined;
  }

  policyInput(_ctx: RunContext, input: FetchCustomerProfileInput): Record<string, unknown> {
    return {
      action: 'fetch_customer_profile',
      customerId: input.customerId,
    };
  }

  verification(): string[] {
    return ['output.customer !== undefined'];
  }

  async execute(
    ctx: RunContext,
    input: FetchCustomerProfileInput
  ): Promise<FetchCustomerProfileOutput> {
    const tool = ctx.getTool('fetch_customer_profile');
    if (!tool) {
      throw new Error('fetch_customer_profile tool is not registered');
    }

    const result = (await tool.call(input)) as FetchCustomerProfileOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'customer_profile_loaded',
      customerId: input.customerId,
    });
    return result;
  }
}

export interface EvaluateEntitlementTaskInput extends EvaluateEntitlementInput {
  customer?: CustomerProfile;
}

export class EvaluateEntitlementTask extends Task<
  EvaluateEntitlementTaskInput,
  EvaluateEntitlementOutput
> {
  constructor() {
    super('task-entitlement-evaluate', 'entitlement.evaluate');
  }

  policyInput(_ctx: RunContext, input: EvaluateEntitlementTaskInput): Record<string, unknown> {
    return {
      action: 'evaluate_entitlement',
      customerId: input.customerId,
      benefitCode: input.benefitCode,
    };
  }

  verification(): string[] {
    return [
      "output.decision === 'allow' || output.decision === 'deny'",
      'output.policy !== undefined',
      'Array.isArray(output.rationale)',
    ];
  }

  async execute(
    ctx: RunContext,
    input: EvaluateEntitlementTaskInput
  ): Promise<EvaluateEntitlementOutput> {
    const tool = ctx.getTool('evaluate_entitlement');
    if (!tool) {
      throw new Error('evaluate_entitlement tool is not registered');
    }

    const result = (await tool.call(input)) as EvaluateEntitlementOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'entitlement_evaluated',
      customerId: input.customerId,
      benefitCode: input.benefitCode,
      decision: result.decision,
      violations: result.violations,
    });
    return result;
  }
}

export type SupervisorNotificationTaskInput = EntitlementNotifySupervisorInput & {
  decision: 'allow' | 'deny';
};

export class SupervisorNotificationTask extends Task<
  SupervisorNotificationTaskInput,
  EntitlementNotifySupervisorOutput
> {
  constructor() {
    super('task-entitlement-notify-supervisor', 'entitlement.notify_supervisor');
  }

  policyInput(_ctx: RunContext, input: SupervisorNotificationTaskInput): Record<string, unknown> {
    return {
      action: 'notify_supervisor',
      customerId: input.customerId,
      channel: input.channel ?? 'email',
      decision: input.decision,
    };
  }

  verification(): string[] {
    return ['output.notified === true', 'typeof output.messageId === "string"'];
  }

  async execute(
    ctx: RunContext,
    input: SupervisorNotificationTaskInput
  ): Promise<EntitlementNotifySupervisorOutput> {
    const tool = ctx.getTool('notify_supervisor');
    if (!tool) {
      throw new Error('notify_supervisor tool is not registered');
    }

    const normalizedInput: SupervisorNotificationTaskInput = {
      ...input,
    };

    const evaluationOutput = ctx.outputs?.['task-entitlement-evaluate'] ?? {};
    const customerProfile = ctx.outputs?.['task-entitlement-fetch-customer']?.customer ?? {};

    const normalizeString = (value: unknown): string | undefined => {
      if (typeof value !== 'string') {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const customerId =
      normalizeString(normalizedInput.customerId) ??
      normalizeString(evaluationOutput?.customer?.id) ??
      normalizeString(customerProfile?.id) ??
      normalizeString(ctx.context?.facts?.customerId);
    if (customerId) {
      normalizedInput.customerId = customerId.toUpperCase();
    }

    const benefitCode =
      normalizeString(evaluationOutput?.policy?.benefitCode) ??
      normalizeString(ctx.context?.facts?.benefitCode);
    const benefitCodeUpper = benefitCode ? benefitCode.toUpperCase() : undefined;

    if (!normalizeString(normalizedInput.channel)) {
      normalizedInput.channel = 'email';
    }

    const decision =
      (normalizeString(normalizedInput.decision)?.toLowerCase() as 'allow' | 'deny' | undefined) ??
      evaluationOutput?.decision ??
      'allow';
    normalizedInput.decision = decision;

    if (!normalizeString(normalizedInput.message)) {
      const customerName =
        normalizeString(customerProfile?.name) ??
        normalizeString(evaluationOutput?.customer?.name) ??
        'customer';
  const renderedBenefit = benefitCodeUpper ?? 'benefit';
      const renderedCustomer = normalizedInput.customerId ?? 'UNKNOWN-ID';
      normalizedInput.message = `Entitlement decision ${decision} for ${customerName} (${renderedCustomer}) regarding ${renderedBenefit}.`;
    }

    const result = (await tool.call(normalizedInput)) as EntitlementNotifySupervisorOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'supervisor_notified',
      customerId: normalizedInput.customerId,
      decision: normalizedInput.decision,
      channel: result.channel,
    });
    return result;
  }
}
