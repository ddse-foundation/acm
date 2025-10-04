// Code Search - BM25 based search for code files
import * as fs from 'fs/promises';
import * as path from 'path';
import { BM25Search, type Document } from './bm25.js';
import type { WorkspaceIndex, FileMetadata, SearchResult } from './types.js';

export interface SearchOptions {
  k?: number; // Number of results
  preferTypes?: string[]; // Prefer certain file types
  includeContext?: boolean; // Include surrounding lines
  contextLines?: number; // Number of context lines
}

export class CodeSearch {
  private bm25: BM25Search;
  private rootPath: string;
  private documents: Map<string, Document> = new Map();

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.bm25 = new BM25Search({ k1: 1.5, b: 0.75 });
  }

  /**
   * Index files for search
   */
  async indexFiles(index: WorkspaceIndex): Promise<void> {
    const documents: Document[] = [];
    this.documents.clear();

    // Filter to text files only
    const textFiles = index.files.filter(f => 
      !f.isBinary && 
      f.size < 500_000 && // Only index files < 500KB
      (f.language === 'typescript' || 
       f.language === 'javascript' || 
       f.language === 'markdown' ||
       f.language === 'json')
    );

    // Read and index each file
    for (const file of textFiles) {
      try {
        const fullPath = path.join(this.rootPath, file.path);
        const content = await fs.readFile(fullPath, 'utf-8');
        
        const doc: Document = {
          id: file.path,
          title: path.basename(file.path),
          content,
          language: file.language,
          size: file.size,
          path: file.path,
        };

        documents.push(doc);
        this.documents.set(file.path, doc);
      } catch {
        // Skip files we can't read
      }
    }

    // Build BM25 index
    this.bm25.index(documents);
  }

  /**
   * Search for code
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const k = options.k ?? 10;
    const preferTypes = new Set(options.preferTypes || []);

    // Search using BM25
    const bm25Results = this.bm25.search(query, k * 2); // Get more initially

    // Apply preferences and convert to SearchResult
    const results: SearchResult[] = [];

    for (const result of bm25Results) {
      const doc = result.document;
      let score = result.score;

      // Boost score for preferred file types
      if (preferTypes.size > 0) {
        const ext = path.extname(doc.path);
        const lang = doc.language as string;
        if (preferTypes.has(ext) || preferTypes.has(lang)) {
          score *= 1.5;
        }
      }

      // Find best matching line
      const snippet = this.findBestSnippet(doc.content, query, options);

      results.push({
        path: doc.path,
        score,
        snippet: snippet.text,
        line: snippet.line,
        column: snippet.column,
      });
    }

    // Re-sort by adjusted scores and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  /**
   * Find the best snippet matching the query
   */
  private findBestSnippet(
    content: string, 
    query: string,
    options: SearchOptions
  ): { text: string; line: number; column: number } {
    const lines = content.split('\n');
    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(/\s+/);

    let bestLine = 0;
    let bestScore = 0;

    // Find line with most query tokens
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      
      let score = 0;
      for (const token of queryTokens) {
        if (lineLower.includes(token)) {
          score += 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestLine = i;
      }
    }

    // Extract snippet with context
    const contextLines = options.includeContext ? (options.contextLines ?? 2) : 0;
    const startLine = Math.max(0, bestLine - contextLines);
    const endLine = Math.min(lines.length - 1, bestLine + contextLines);

    const snippetLines = lines.slice(startLine, endLine + 1);
    const snippet = snippetLines
      .map((line, idx) => {
        const lineNum = startLine + idx + 1;
        const marker = lineNum === bestLine + 1 ? '>' : ' ';
        return `${marker} ${lineNum.toString().padStart(4, ' ')} ${line}`;
      })
      .join('\n');

    // Find column position (first occurrence of any query token)
    let column = 0;
    const bestLineLower = lines[bestLine].toLowerCase();
    for (const token of queryTokens) {
      const pos = bestLineLower.indexOf(token);
      if (pos >= 0) {
        column = pos;
        break;
      }
    }

    return {
      text: snippet,
      line: bestLine + 1,
      column,
    };
  }

  /**
   * Search for symbol by name (exact or partial match)
   */
  async searchSymbol(symbolName: string): Promise<SearchResult[]> {
    // Search for exact symbol name with high weight
    return this.search(`${symbolName} function class interface`, {
      k: 5,
      preferTypes: ['.ts', '.tsx', '.js', '.jsx'],
      includeContext: true,
      contextLines: 3,
    });
  }
}
