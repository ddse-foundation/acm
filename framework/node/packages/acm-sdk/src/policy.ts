// PolicyEngine interface
import type { PolicyDecision } from './types.js';

export interface PolicyEngine {
  evaluate(
    action: 'plan.admit' | 'task.pre' | 'task.post',
    payload: any
  ): Promise<PolicyDecision>;
}
