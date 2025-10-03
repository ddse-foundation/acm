// Simple BM25 search implementation for ACM examples

/**
 * Document interface for BM25 search
 */
export interface Document {
  id: string;
  title?: string;
  content: string;
  [key: string]: any;
}

/**
 * Search result with score
 */
export interface SearchResult {
  document: Document;
  score: number;
}

/**
 * BM25 parameters
 */
export interface BM25Params {
  k1?: number; // Term frequency saturation (default: 1.5)
  b?: number;  // Length normalization (default: 0.75)
}

/**
 * Simple tokenizer
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * BM25 Search Engine
 * 
 * Implements the BM25 ranking function for full-text search.
 * BM25 is a probabilistic ranking function used by search engines
 * to estimate the relevance of documents to a query.
 */
export class BM25Search {
  private documents: Document[] = [];
  private documentTokens: Map<string, string[]> = new Map();
  private documentFrequency: Map<string, number> = new Map();
  private averageDocumentLength: number = 0;
  private k1: number;
  private b: number;

  constructor(params: BM25Params = {}) {
    this.k1 = params.k1 ?? 1.5;
    this.b = params.b ?? 0.75;
  }

  /**
   * Index documents for search
   */
  index(documents: Document[]): void {
    this.documents = documents;
    this.documentTokens.clear();
    this.documentFrequency.clear();

    // Tokenize documents
    let totalLength = 0;
    for (const doc of documents) {
      const text = this.extractText(doc);
      const tokens = tokenize(text);
      this.documentTokens.set(doc.id, tokens);
      totalLength += tokens.length;

      // Update document frequency
      const uniqueTokens = new Set(tokens);
      for (const token of uniqueTokens) {
        this.documentFrequency.set(token, (this.documentFrequency.get(token) || 0) + 1);
      }
    }

    this.averageDocumentLength = totalLength / documents.length;
  }

  /**
   * Extract searchable text from document
   */
  private extractText(doc: Document): string {
    const parts: string[] = [];
    if (doc.title) parts.push(doc.title);
    if (doc.content) parts.push(doc.content);
    return parts.join(' ');
  }

  /**
   * Calculate IDF (Inverse Document Frequency)
   */
  private idf(term: string): number {
    const df = this.documentFrequency.get(term) || 0;
    if (df === 0) return 0;

    const n = this.documents.length;
    return Math.log((n - df + 0.5) / (df + 0.5) + 1);
  }

  /**
   * Calculate BM25 score for a document
   */
  private score(docId: string, queryTokens: string[]): number {
    const tokens = this.documentTokens.get(docId);
    if (!tokens) return 0;

    const docLength = tokens.length;
    let score = 0;

    for (const queryToken of queryTokens) {
      const termFreq = tokens.filter((t) => t === queryToken).length;
      if (termFreq === 0) continue;

      const idf = this.idf(queryToken);
      const numerator = termFreq * (this.k1 + 1);
      const denominator = termFreq + this.k1 * (1 - this.b + this.b * (docLength / this.averageDocumentLength));

      score += idf * (numerator / denominator);
    }

    return score;
  }

  /**
   * Search for documents matching the query
   */
  search(query: string, limit: number = 10): SearchResult[] {
    if (this.documents.length === 0) {
      return [];
    }

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }

    // Score all documents
    const results: SearchResult[] = [];
    for (const doc of this.documents) {
      const score = this.score(doc.id, queryTokens);
      if (score > 0) {
        results.push({ document: doc, score });
      }
    }

    // Sort by score (descending) and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Get all indexed documents
   */
  getDocuments(): Document[] {
    return this.documents;
  }

  /**
   * Get document count
   */
  getDocumentCount(): number {
    return this.documents.length;
  }
}
