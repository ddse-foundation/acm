import { Tool } from '@acm/sdk';
import {
  getInvoice,
  getPurchaseOrder,
  compareLineItems,
  type InvoiceRecord,
  type PurchaseOrderRecord,
} from '../../data/invoices.js';

export type FetchInvoiceInput = {
  invoiceId: string;
};

export type FetchInvoiceOutput = {
  invoice: InvoiceRecord;
};

export class FetchInvoiceTool extends Tool<FetchInvoiceInput, FetchInvoiceOutput> {
  name(): string {
    return 'fetch_invoice';
  }

  async call(input: FetchInvoiceInput): Promise<FetchInvoiceOutput> {
    if (!input?.invoiceId) {
      throw new Error('invoiceId is required');
    }

    const invoice = await getInvoice(input.invoiceId);
    if (!invoice) {
      throw new Error(`Invoice ${input.invoiceId} not found`);
    }

    return { invoice };
  }
}

export type FetchPurchaseOrderInput = {
  purchaseOrderId: string;
};

export type FetchPurchaseOrderOutput = {
  purchaseOrder: PurchaseOrderRecord;
};

export class FetchPurchaseOrderTool extends Tool<
  FetchPurchaseOrderInput,
  FetchPurchaseOrderOutput
> {
  name(): string {
    return 'fetch_purchase_order';
  }

  async call(input: FetchPurchaseOrderInput): Promise<FetchPurchaseOrderOutput> {
    if (!input?.purchaseOrderId) {
      throw new Error('purchaseOrderId is required');
    }

    const purchaseOrder = await getPurchaseOrder(input.purchaseOrderId);
    if (!purchaseOrder) {
      throw new Error(`Purchase order ${input.purchaseOrderId} not found`);
    }

    return { purchaseOrder };
  }
}

export type CompareLineItemsInput = {
  invoice: InvoiceRecord;
  purchaseOrder: PurchaseOrderRecord;
};

export type Discrepancy = ReturnType<typeof compareLineItems>[number] & {
  varianceAmount: number;
};

export type CompareLineItemsOutput = {
  discrepancies: Discrepancy[];
  variance: number;
  matchedLines: number;
};

export class CompareLineItemsTool extends Tool<
  CompareLineItemsInput,
  CompareLineItemsOutput
> {
  name(): string {
    return 'compare_line_items';
  }

  async call(input: CompareLineItemsInput): Promise<CompareLineItemsOutput> {
    if (!input?.invoice || !input?.purchaseOrder) {
      throw new Error('invoice and purchaseOrder are required');
    }

    const discrepancies = compareLineItems(input.invoice, input.purchaseOrder).map(item => ({
      ...item,
      varianceAmount:
        (item.actualQuantity - item.expectedQuantity) * item.expectedPrice ||
        (item.actualPrice - item.expectedPrice) * item.actualQuantity,
    }));

    const matchedLines = input.invoice.lines.length - discrepancies.length;
    const variance = discrepancies.reduce((sum, item) => sum + item.varianceAmount, 0);

    return {
      discrepancies,
      variance,
      matchedLines,
    };
  }
}

export type RecordFindingsInput = {
  invoice: InvoiceRecord;
  purchaseOrder: PurchaseOrderRecord;
  discrepancies: Discrepancy[];
  variance: number;
};

export type RecordFindingsOutput = {
  reportId: string;
  status: 'clean' | 'needs_remediation';
  summary: string;
  nextSteps: string[];
  generatedAt: string;
};

export class RecordFindingsTool extends Tool<
  RecordFindingsInput,
  RecordFindingsOutput
> {
  name(): string {
    return 'record_findings';
  }

  async call(input: RecordFindingsInput): Promise<RecordFindingsOutput> {
    if (!input?.invoice || !input?.purchaseOrder) {
      throw new Error('invoice and purchaseOrder are required');
    }

    const status = input.discrepancies.length === 0 && Math.abs(input.variance) < 1
      ? 'clean'
      : 'needs_remediation';

    const summary = status === 'clean'
      ? `Invoice ${input.invoice.id} matches purchase order ${input.purchaseOrder.id}`
      : `Invoice ${input.invoice.id} has ${input.discrepancies.length} discrepancy(s)`;

    const nextSteps = status === 'clean'
      ? ['Archive reconciliation report in AP system']
      : [
          'Open remediation ticket with procurement',
          'Notify accounts payable supervisor',
          'Schedule supplier follow-up call',
        ];

    return {
      reportId: `recon-${Date.now()}`,
      status,
      summary,
      nextSteps,
      generatedAt: new Date().toISOString(),
    };
  }
}
