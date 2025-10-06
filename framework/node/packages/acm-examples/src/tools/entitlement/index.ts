import { Tool } from '@ddse/acm-sdk';
import {
  getCustomerProfile,
  getPolicy,
  type CustomerProfile,
  type EntitlementPolicy,
} from '../../data/entitlement.js';

export type FetchCustomerProfileInput = {
  customerId: string;
};

export type FetchCustomerProfileOutput = {
  customer: CustomerProfile;
};

export class FetchCustomerProfileTool extends Tool<
  FetchCustomerProfileInput,
  FetchCustomerProfileOutput
> {
  name(): string {
    return 'fetch_customer_profile';
  }

  async call(input: FetchCustomerProfileInput): Promise<FetchCustomerProfileOutput> {
    if (!input?.customerId) {
      throw new Error('customerId is required');
    }

    const customer = await getCustomerProfile(input.customerId);
    if (!customer) {
      throw new Error(`Customer ${input.customerId} not found`);
    }

    return { customer };
  }
}

export type EvaluateEntitlementInput = {
  customerId: string;
  benefitCode: string;
};

export type EvaluateEntitlementViolation = {
  code: 'tier_mismatch' | 'account_age' | 'compliance_hold' | 'customer_missing' | 'policy_missing';
  message: string;
};

export type EvaluateEntitlementOutput = {
  decision: 'allow' | 'deny';
  policy: EntitlementPolicy;
  customer: CustomerProfile;
  slaMinutes: number;
  rationale: string[];
  violations: EvaluateEntitlementViolation[];
};

const tierRank: Record<CustomerProfile['tier'], number> = {
  STANDARD: 1,
  GOLD: 2,
  PLATINUM: 3,
};

export class EvaluateEntitlementTool extends Tool<
  EvaluateEntitlementInput,
  EvaluateEntitlementOutput
> {
  name(): string {
    return 'evaluate_entitlement';
  }

  async call(input: EvaluateEntitlementInput): Promise<EvaluateEntitlementOutput> {
    if (!input?.customerId || !input?.benefitCode) {
      throw new Error('customerId and benefitCode are required');
    }

    const [customer, policy] = await Promise.all([
      getCustomerProfile(input.customerId),
      getPolicy(input.benefitCode),
    ]);

    const violations: EvaluateEntitlementViolation[] = [];
    const rationale: string[] = [];

    if (!customer) {
      violations.push({
        code: 'customer_missing',
        message: `Customer ${input.customerId} was not found in CRM snapshot`,
      });
    }

    if (!policy) {
      violations.push({
        code: 'policy_missing',
        message: `Policy ${input.benefitCode} was not found in entitlement catalog`,
      });
    }

    if (!customer || !policy) {
      throw new Error(
        `Unable to evaluate entitlement: ${violations.map(v => v.message).join('; ')}`,
      );
    }

    if (tierRank[customer.tier] < tierRank[policy.requiredTier]) {
      violations.push({
        code: 'tier_mismatch',
        message: `Customer tier ${customer.tier} does not meet required tier ${policy.requiredTier}`,
      });
    } else {
      rationale.push(`Customer tier ${customer.tier} satisfies required tier ${policy.requiredTier}`);
    }

    if (customer.accountAgeDays < policy.minAccountAgeDays) {
      violations.push({
        code: 'account_age',
        message: `Account age ${customer.accountAgeDays} days is below minimum ${policy.minAccountAgeDays} days`,
      });
    } else {
      rationale.push(
        `Account age ${customer.accountAgeDays} days exceeds minimum ${policy.minAccountAgeDays} days`,
      );
    }

    const hasComplianceHold = customer.complianceFlags.length > 0;
    if (policy.requiresComplianceClearance && hasComplianceHold) {
      violations.push({
        code: 'compliance_hold',
        message: `Compliance flags present: ${customer.complianceFlags.join(', ')}`,
      });
    } else if (policy.requiresComplianceClearance) {
      rationale.push('No compliance holds found for customer');
    }

    const decision = violations.length === 0 ? 'allow' : 'deny';
    if (decision === 'deny') {
      rationale.push('Entitlement denied due to policy violations');
    } else {
      rationale.push('Entitlement approved according to policy requirements');
    }

    return {
      decision,
      policy,
      customer,
      slaMinutes: policy.slaMinutes,
      rationale,
      violations,
    };
  }
}

export type NotifySupervisorInput = {
  customerId: string;
  message: string;
  channel?: 'email' | 'slack';
};

export type NotifySupervisorOutput = {
  notified: boolean;
  channel: string;
  supervisor: {
    name: string;
    email: string;
  };
  messageId: string;
  timestamp: string;
};

export class EntitlementNotifySupervisorTool extends Tool<
  NotifySupervisorInput,
  NotifySupervisorOutput
> {
  name(): string {
    return 'notify_supervisor';
  }

  async call(input: NotifySupervisorInput): Promise<NotifySupervisorOutput> {
    if (!input?.customerId || !input?.message) {
      throw new Error('customerId and message are required');
    }

    const customer = await getCustomerProfile(input.customerId);
    if (!customer) {
      throw new Error(`Customer ${input.customerId} not found`);
    }

    const channel = input.channel ?? 'email';
    const messageId = `notif-${Date.now()}`;

    return {
      notified: true,
      channel,
      supervisor: customer.supervisor,
      messageId,
      timestamp: new Date().toISOString(),
    };
  }
}
