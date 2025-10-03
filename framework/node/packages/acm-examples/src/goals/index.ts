// Sample goals and contexts
import type { Goal, Context } from '@acm/sdk';

export const goals = {
  refund: {
    id: 'goal-refund-1',
    intent: 'Issue a refund for order O123 within 2 minutes, CC supervisor',
    constraints: {
      maxTimeSeconds: 120,
      requireSupervisorNotification: true,
    },
  } as Goal,

  issues: {
    id: 'goal-issues-1',
    intent: 'Find top issues and trigger mitigation',
    constraints: {
      maxIssues: 5,
      severityThreshold: 'HIGH',
    },
  } as Goal,
};

export const contexts = {
  refund: {
    id: 'ctx-refund-1',
    facts: {
      orderId: 'O123',
      region: 'EU',
      customerTier: 'GOLD',
      refundAmount: 49.99,
    },
    version: '1.0',
  } as Context,

  issues: {
    id: 'ctx-issues-1',
    facts: {
      product: 'ACME-X',
      region: 'EU',
      timeRange: 'last_24h',
    },
    version: '1.0',
  } as Context,
};
