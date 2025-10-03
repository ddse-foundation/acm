// Sample tools
import { Tool } from '@acm/sdk';
import { BM25Search, type Document } from '../search/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize BM25 search engine
const documentsSearch = new BM25Search();
const ordersSearch = new BM25Search();
const issuesSearch = new BM25Search();

// Load data on module initialization
async function initializeSearchEngines() {
  try {
    // Try multiple paths to find the data directory
    const possiblePaths = [
      path.join(__dirname, '../../data'),
      path.join(__dirname, '../../../data'),
      path.join(process.cwd(), 'data'),
    ];
    
    let dataDir = '';
    for (const p of possiblePaths) {
      try {
        await fs.access(p);
        dataDir = p;
        break;
      } catch {
        continue;
      }
    }
    
    if (!dataDir) {
      console.warn('Data directory not found, search will return empty results');
      return;
    }
    
    // Load documents
    const documentsData = await fs.readFile(path.join(dataDir, 'documents.json'), 'utf-8');
    const documents = JSON.parse(documentsData);
    documentsSearch.index(documents);
    
    // Load orders
    const ordersData = await fs.readFile(path.join(dataDir, 'orders.json'), 'utf-8');
    const orders = JSON.parse(ordersData);
    ordersSearch.index(orders.map((o: any) => ({
      id: o.orderId,
      content: `${o.orderId} ${o.customerName} ${o.status} ${JSON.stringify(o.items)}`,
      ...o,
    })));
    
    // Load issues
    const issuesData = await fs.readFile(path.join(dataDir, 'issues.json'), 'utf-8');
    const issues = JSON.parse(issuesData);
    issuesSearch.index(issues.map((i: any) => ({
      id: i.issueId,
      title: i.title,
      content: `${i.title} ${i.description}`,
      ...i,
    })));
  } catch (error) {
    console.warn('Failed to load search data:', error);
  }
}

// Initialize on import
initializeSearchEngines().catch(console.error);

export class SearchTool extends Tool<{ query: string }, { results: any[] }> {
  name(): string {
    return 'search';
  }

  async call(input: { query: string }): Promise<{ results: any[] }> {
    // Use BM25 to search across all data sources
    const docResults = documentsSearch.search(input.query, 3);
    const orderResults = ordersSearch.search(input.query, 2);
    const issueResults = issuesSearch.search(input.query, 2);
    
    const results = [
      ...docResults.map(r => ({ type: 'document', ...r.document, score: r.score })),
      ...orderResults.map(r => ({ type: 'order', ...r.document, score: r.score })),
      ...issueResults.map(r => ({ type: 'issue', ...r.document, score: r.score })),
    ];
    
    // Sort by score and return top results
    results.sort((a, b) => b.score - a.score);
    
    return {
      results: results.slice(0, 5),
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
