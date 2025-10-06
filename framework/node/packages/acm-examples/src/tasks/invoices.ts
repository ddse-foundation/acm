import { Task, type RunContext } from '@acm/sdk';
import type { InvoiceRecord, PurchaseOrderRecord } from '../data/invoices.js';
import {
  type FetchInvoiceInput,
  type FetchInvoiceOutput,
  type FetchPurchaseOrderInput,
  type FetchPurchaseOrderOutput,
  type CompareLineItemsInput,
  type CompareLineItemsOutput,
  type RecordFindingsInput,
  type RecordFindingsOutput,
} from '../tools/invoices/index.js';

export class FetchInvoiceTask extends Task<FetchInvoiceInput, FetchInvoiceOutput> {
  constructor() {
    super('task-invoice-fetch', 'invoice.fetch');
  }

  idemKey(_ctx: RunContext, input: FetchInvoiceInput): string | undefined {
    return input?.invoiceId ? `invoice:${input.invoiceId}` : undefined;
  }

  policyInput(_ctx: RunContext, input: FetchInvoiceInput): Record<string, unknown> {
    return {
      action: 'fetch_invoice',
      invoiceId: input.invoiceId,
    };
  }

  verification(): string[] {
    return ['output.invoice !== undefined'];
  }

  async execute(
    ctx: RunContext,
    input: FetchInvoiceInput
  ): Promise<FetchInvoiceOutput> {
    const tool = ctx.getTool('fetch_invoice');
    if (!tool) {
      throw new Error('fetch_invoice tool is not registered');
    }

    const result = (await tool.call(input)) as FetchInvoiceOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'invoice_loaded',
      invoiceId: input.invoiceId,
    });
    return result;
  }
}

export class FetchPurchaseOrderTask extends Task<
  FetchPurchaseOrderInput,
  FetchPurchaseOrderOutput
> {
  constructor() {
    super('task-invoice-fetch-po', 'invoice.fetch_purchase_order');
  }

  idemKey(_ctx: RunContext, input: FetchPurchaseOrderInput): string | undefined {
    return input?.purchaseOrderId ? `purchase-order:${input.purchaseOrderId}` : undefined;
  }

  policyInput(_ctx: RunContext, input: FetchPurchaseOrderInput): Record<string, unknown> {
    return {
      action: 'fetch_purchase_order',
      purchaseOrderId: input.purchaseOrderId,
    };
  }

  verification(): string[] {
    return ['output.purchaseOrder !== undefined'];
  }

  async execute(
    ctx: RunContext,
    input: FetchPurchaseOrderInput
  ): Promise<FetchPurchaseOrderOutput> {
    const tool = ctx.getTool('fetch_purchase_order');
    if (!tool) {
      throw new Error('fetch_purchase_order tool is not registered');
    }

    const result = (await tool.call(input)) as FetchPurchaseOrderOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'purchase_order_loaded',
      purchaseOrderId: input.purchaseOrderId,
    });
    return result;
  }
}

export interface CompareLineItemsTaskInput extends Partial<CompareLineItemsInput> {
  invoiceId?: string;
  purchaseOrderId?: string;
}

export class CompareLineItemsTask extends Task<
  CompareLineItemsTaskInput,
  CompareLineItemsOutput
> {
  constructor() {
    super('task-invoice-compare-lines', 'invoice.compare_line_items');
  }

  policyInput(_ctx: RunContext, input: CompareLineItemsTaskInput): Record<string, unknown> {
    const invoice = this.resolveInvoice(_ctx, input);
    const purchaseOrder = this.resolvePurchaseOrder(_ctx, input);
    return {
      action: 'compare_line_items',
      invoiceId: invoice?.id ?? input.invoiceId,
      purchaseOrderId: purchaseOrder?.id ?? input.purchaseOrderId,
    };
  }

  verification(): string[] {
    return ['Array.isArray(output.discrepancies)', 'typeof output.variance === "number"'];
  }

  async execute(
    ctx: RunContext,
    input: CompareLineItemsTaskInput
  ): Promise<CompareLineItemsOutput> {
    const tool = ctx.getTool('compare_line_items');
    if (!tool) {
      throw new Error('compare_line_items tool is not registered');
    }

    const invoice = this.resolveInvoice(ctx, input);
    const purchaseOrder = this.resolvePurchaseOrder(ctx, input);

    if (!invoice || !purchaseOrder) {
      throw new Error('invoice and purchaseOrder are required');
    }

    const result = (await tool.call({ invoice, purchaseOrder })) as CompareLineItemsOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'invoice_line_items_compared',
      invoiceId: invoice.id,
      purchaseOrderId: purchaseOrder.id,
      discrepancies: result.discrepancies.length,
      variance: result.variance,
    });
    return result;
  }

  private resolveInvoice(
    ctx: RunContext,
    input: CompareLineItemsTaskInput
  ): InvoiceRecord | undefined {
    if (input?.invoice) {
      return input.invoice;
    }

    const fetchOutput = ctx.outputs?.['task-invoice-fetch'] as FetchInvoiceOutput | undefined;
    const invoice = fetchOutput?.invoice;
    if (!invoice) {
      return undefined;
    }

    if (!input?.invoiceId || invoice.id === input.invoiceId) {
      return invoice;
    }

    return undefined;
  }

  private resolvePurchaseOrder(
    ctx: RunContext,
    input: CompareLineItemsTaskInput
  ): PurchaseOrderRecord | undefined {
    if (input?.purchaseOrder) {
      return input.purchaseOrder;
    }

    const fetchOutput = ctx.outputs?.['task-invoice-fetch-po'] as FetchPurchaseOrderOutput | undefined;
    const purchaseOrder = fetchOutput?.purchaseOrder;
    if (!purchaseOrder) {
      return undefined;
    }

    if (!input?.purchaseOrderId || purchaseOrder.id === input.purchaseOrderId) {
      return purchaseOrder;
    }

    return undefined;
  }
}

export interface RecordFindingsTaskInput extends Partial<RecordFindingsInput> {
  invoiceId?: string;
  purchaseOrderId?: string;
}

export class RecordFindingsTask extends Task<
  RecordFindingsTaskInput,
  RecordFindingsOutput
> {
  constructor() {
    super('task-invoice-record-findings', 'invoice.record_findings');
  }

  policyInput(_ctx: RunContext, input: RecordFindingsTaskInput): Record<string, unknown> {
    const resolved = this.resolveInput(_ctx, input);
    return {
      action: 'record_findings',
      invoiceId: resolved.invoice.id,
      purchaseOrderId: resolved.purchaseOrder.id,
      discrepancyCount: resolved.discrepancies.length,
    };
  }

  verification(): string[] {
    return ['typeof output.reportId === "string"', 'Array.isArray(output.nextSteps)'];
  }

  async execute(
    ctx: RunContext,
    input: RecordFindingsTaskInput
  ): Promise<RecordFindingsOutput> {
    const tool = ctx.getTool('record_findings');
    if (!tool) {
      throw new Error('record_findings tool is not registered');
    }

    const resolved = this.resolveInput(ctx, input);

    const result = (await tool.call(resolved)) as RecordFindingsOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'invoice_findings_recorded',
      invoiceId: resolved.invoice.id,
      purchaseOrderId: resolved.purchaseOrder.id,
      status: result.status,
    });
    return result;
  }

  private resolveInput(
    ctx: RunContext,
    input: RecordFindingsTaskInput
  ): RecordFindingsInput {
    const invoice = input.invoice ?? (ctx.outputs?.['task-invoice-fetch'] as FetchInvoiceOutput | undefined)?.invoice;
    const purchaseOrder =
      input.purchaseOrder ?? (ctx.outputs?.['task-invoice-fetch-po'] as FetchPurchaseOrderOutput | undefined)?.purchaseOrder;
    const compareOutput = ctx.outputs?.['task-invoice-compare-lines'] as CompareLineItemsOutput | undefined;

    if (!invoice) {
      throw new Error('invoice is required for recording findings');
    }

    if (!purchaseOrder) {
      throw new Error('purchaseOrder is required for recording findings');
    }

    const discrepancies = input.discrepancies ?? compareOutput?.discrepancies ?? [];
    const variance = input.variance ?? compareOutput?.variance ?? 0;

    return {
      invoice,
      purchaseOrder,
      discrepancies,
      variance,
    };
  }
}
