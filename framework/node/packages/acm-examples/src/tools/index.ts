// Sample tools
import { Tool } from '@acm/sdk';

export class SearchTool extends Tool<{ query: string }, { results: string[] }> {
  name(): string {
    return 'search';
  }

  async call(input: { query: string }): Promise<{ results: string[] }> {
    // Simulate search
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      results: [`Result for: ${input.query}`, 'Additional context found'],
    };
  }
}

export class ExtractEntitiesTool extends Tool<{ text: string }, { entities: string[] }> {
  name(): string {
    return 'extract_entities';
  }

  async call(input: { text: string }): Promise<{ entities: string[] }> {
    // Simulate entity extraction
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      entities: ['order_id:O123', 'region:EU', 'customer:C456'],
    };
  }
}

export class AssessRiskTool extends Tool<{ context: any }, { riskTier: string; score: number }> {
  name(): string {
    return 'assess_risk';
  }

  async call(input: { context: any }): Promise<{ riskTier: string; score: number }> {
    // Simulate risk assessment
    await new Promise(resolve => setTimeout(resolve, 400));
    const score = Math.random() * 100;
    return {
      riskTier: score > 70 ? 'HIGH' : score > 40 ? 'MEDIUM' : 'LOW',
      score,
    };
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
    // Simulate transaction creation
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      transactionId: `TXN-${Date.now()}`,
      status: 'COMPLETED',
    };
  }
}

export class NotifySupervisorTool extends Tool<
  { message: string; channel: string },
  { sent: boolean; messageId: string }
> {
  name(): string {
    return 'notify_supervisor';
  }

  async call(input: { message: string; channel: string }): Promise<{ sent: boolean; messageId: string }> {
    // Simulate notification
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      sent: true,
      messageId: `MSG-${Date.now()}`,
    };
  }
}
