// Sample tasks
import { Task, type RunContext } from '@acm/sdk';

export class SearchTask extends Task<{ query: string }, { results: string[] }> {
  constructor() {
    super('search-task', 'search');
  }

  async execute(ctx: RunContext, input: { query: string }): Promise<{ results: string[] }> {
    const tool = ctx.getTool('search');
    if (!tool) {
      throw new Error('Search tool not found');
    }

    const result = await tool.call(input);
    ctx.stream?.emit('task', { taskId: this.id, step: 'search_complete', results: result });
    return result;
  }
}

export class EnrichAndActTask extends Task<
  { searchQuery: string; orderId: string },
  { action: string; details: any }
> {
  constructor() {
    super('enrich-and-act-task', 'enrich_and_act');
  }

  async execute(
    ctx: RunContext,
    input: { searchQuery: string; orderId: string }
  ): Promise<{ action: string; details: any }> {
    // Step 1: Search
    const searchTool = ctx.getTool('search');
    if (!searchTool) throw new Error('Search tool not found');
    
    const searchResult = await searchTool.call({ query: input.searchQuery });
    ctx.stream?.emit('task', { taskId: this.id, step: 'search_done' });

    // Step 2: Extract entities
    const extractTool = ctx.getTool('extract_entities');
    if (!extractTool) throw new Error('Extract entities tool not found');
    
    const entities = await extractTool.call({ text: JSON.stringify(searchResult) });
    ctx.stream?.emit('task', { taskId: this.id, step: 'entities_extracted' });

    // Step 3: Assess risk
    const riskTool = ctx.getTool('assess_risk');
    if (!riskTool) throw new Error('Risk assessment tool not found');
    
    const risk = await riskTool.call({ context: { entities, orderId: input.orderId } });
    ctx.stream?.emit('task', { taskId: this.id, step: 'risk_assessed', risk });

    return {
      action: risk.riskTier === 'HIGH' ? 'ESCALATE' : 'PROCEED',
      details: { searchResult, entities, risk },
    };
  }

  policyInput(ctx: RunContext, input: any): Record<string, unknown> {
    return {
      orderId: input.orderId,
      action: 'enrich_and_assess',
    };
  }

  verification(): string[] {
    return ['output.action !== undefined', 'output.details !== undefined'];
  }
}

export class RefundFlowTask extends Task<
  { orderId: string; amount: number },
  { transactionId: string; notified: boolean }
> {
  constructor() {
    super('refund-flow-task', 'refund_flow');
  }

  async execute(
    ctx: RunContext,
    input: { orderId: string; amount: number }
  ): Promise<{ transactionId: string; notified: boolean }> {
    // Step 1: Create refund transaction
    const refundTool = ctx.getTool('create_refund_txn');
    if (!refundTool) throw new Error('Refund tool not found');
    
    const txn = await refundTool.call(input);
    ctx.stream?.emit('task', { taskId: this.id, step: 'refund_created', txn });

    // Step 2: Notify supervisor
    const notifyTool = ctx.getTool('notify_supervisor');
    if (!notifyTool) throw new Error('Notify tool not found');
    
    const notification = await notifyTool.call({
      message: `Refund ${txn.transactionId} created for order ${input.orderId}`,
      channel: 'email',
    });
    ctx.stream?.emit('task', { taskId: this.id, step: 'notification_sent' });

    return {
      transactionId: txn.transactionId,
      notified: notification.sent,
    };
  }

  policyInput(ctx: RunContext, input: any): Record<string, unknown> {
    return {
      orderId: input.orderId,
      amount: input.amount,
      action: 'create_refund',
    };
  }

  verification(): string[] {
    return ['output.transactionId !== undefined', 'output.notified === true'];
  }
}
