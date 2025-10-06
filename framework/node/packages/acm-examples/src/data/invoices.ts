import { loadJson } from './loader.js';

export interface InvoiceLine {
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceRecord {
  id: string;
  supplier: string;
  total: number;
  currency: string;
  purchaseOrderId: string;
  receivedAt: string;
  lines: InvoiceLine[];
}

export interface PurchaseOrderRecord {
  id: string;
  initiator: string;
  department: string;
  total: number;
  currency: string;
  status: string;
  lines: InvoiceLine[];
}

interface InvoiceData {
  invoices: InvoiceRecord[];
  purchaseOrders: PurchaseOrderRecord[];
}

let cached: InvoiceData | null = null;

async function loadData(): Promise<InvoiceData> {
  if (cached) {
    return cached;
  }

  const [invoices, purchaseOrders] = await Promise.all([
    loadJson<InvoiceRecord[]>('data/invoices/invoices.json'),
    loadJson<PurchaseOrderRecord[]>('data/invoices/purchase-orders.json'),
  ]);

  cached = { invoices, purchaseOrders };
  return cached;
}

export async function getInvoice(invoiceId: string): Promise<InvoiceRecord | undefined> {
  const { invoices } = await loadData();
  return invoices.find(inv => inv.id === invoiceId);
}

export async function getPurchaseOrder(poId: string): Promise<PurchaseOrderRecord | undefined> {
  const { purchaseOrders } = await loadData();
  return purchaseOrders.find(po => po.id === poId);
}

export function compareLineItems(invoice: InvoiceRecord, po: PurchaseOrderRecord): Array<{
  sku: string;
  expectedQuantity: number;
  actualQuantity: number;
  expectedPrice: number;
  actualPrice: number;
}> {
  const discrepancies: Array<{
    sku: string;
    expectedQuantity: number;
    actualQuantity: number;
    expectedPrice: number;
    actualPrice: number;
  }> = [];

  const poLines = new Map(po.lines.map(line => [line.sku, line]));

  for (const invLine of invoice.lines) {
    const poLine = poLines.get(invLine.sku);
    if (!poLine) {
      discrepancies.push({
        sku: invLine.sku,
        expectedQuantity: 0,
        actualQuantity: invLine.quantity,
        expectedPrice: 0,
        actualPrice: invLine.unitPrice,
      });
      continue;
    }

    if (poLine.quantity !== invLine.quantity || poLine.unitPrice !== invLine.unitPrice) {
      discrepancies.push({
        sku: invLine.sku,
        expectedQuantity: poLine.quantity,
        actualQuantity: invLine.quantity,
        expectedPrice: poLine.unitPrice,
        actualPrice: invLine.unitPrice,
      });
    }
  }

  return discrepancies;
}
