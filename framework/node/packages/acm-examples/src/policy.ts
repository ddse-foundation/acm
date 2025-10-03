// Simple policy engine implementation
import { PolicyEngine, type PolicyDecision } from '@acm/sdk';

export class SimplePolicyEngine implements PolicyEngine {
  async evaluate(
    action: 'plan.admit' | 'task.pre' | 'task.post',
    payload: any
  ): Promise<PolicyDecision> {
    // Simple rule: deny high-risk refunds
    if (action === 'task.pre' && payload.action === 'create_refund') {
      // In a real implementation, we'd check risk from context
      // For demo, randomly allow/deny based on amount
      if (payload.amount && payload.amount > 100) {
        return {
          allow: false,
          reason: 'Refund amount exceeds policy limit',
        };
      }
    }

    // Default: allow
    return {
      allow: true,
      limits: {
        timeoutMs: 30000,
        retries: 3,
      },
    };
  }
}
