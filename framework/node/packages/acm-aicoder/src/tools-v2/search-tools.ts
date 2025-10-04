// Search Tools - Code search and pattern matching
import { Tool } from '@acm/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CodeSearch, type SearchResult as ContextSearchResult } from '../context/index.js';
import { WorkspaceIndexer } from '../context/index.js';

/**
 * CodeSearchTool - BM25-based code search
 */
export class CodeSearchTool extends Tool<
  { query: string; k?: number; preferTypes?: string[]; includeContext?: boolean },
  { results: Array<{ path: string; score: number; snippet: string; line: number }> }
> {
  private search: CodeSearch | null = null;
  private rootPath: string;

  constructor(rootPath: string = process.cwd()) {
    super();
    this.rootPath = rootPath;
  }

  name(): string {
    return 'code_search';
  }

  async call(input: { 
    query: string; 
    k?: number; 
    preferTypes?: string[];
    includeContext?: boolean;
  }): Promise<{ results: Array<{ path: string; score: number; snippet: string; line: number }> }> {
    // Lazy initialize search
    if (!this.search) {
      this.search = new CodeSearch(this.rootPath);
      const indexer = new WorkspaceIndexer(this.rootPath);
      const index = await indexer.buildIndex({ useCache: true });
      await this.search.indexFiles(index);
    }

    const results = await this.search.search(input.query, {
      k: input.k ?? 10,
      preferTypes: input.preferTypes,
      includeContext: input.includeContext ?? true,
      contextLines: 2,
    });

    return {
      results: results.map(r => ({
        path: r.path,
        score: r.score,
        snippet: r.snippet,
        line: r.line,
      })),
    };
  }
}

/**
 * GrepTool - Pattern-based multi-file search
 */
export class GrepTool extends Tool<
  { pattern: string; globs?: string[]; regex?: boolean; caseInsensitive?: boolean; maxResults?: number },
  { matches: Array<{ path: string; line: number; column: number; preview: string }> }
> {
  private rootPath: string;

  constructor(rootPath: string = process.cwd()) {
    super();
    this.rootPath = rootPath;
  }

  name(): string {
    return 'grep';
  }

  async call(input: { 
    pattern: string; 
    globs?: string[];
    regex?: boolean;
    caseInsensitive?: boolean;
    maxResults?: number;
  }): Promise<{ matches: Array<{ path: string; line: number; column: number; preview: string }> }> {
    const maxResults = input.maxResults ?? 100;
    const matches: Array<{ path: string; line: number; column: number; preview: string }> = [];

    // Build pattern
    let searchPattern: RegExp;
    if (input.regex) {
      const flags = input.caseInsensitive ? 'gi' : 'g';
      searchPattern = new RegExp(input.pattern, flags);
    } else {
      const escaped = input.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = input.caseInsensitive ? 'gi' : 'g';
      searchPattern = new RegExp(escaped, flags);
    }

    // Scan files
    await this.scanDirectory(this.rootPath, searchPattern, matches, maxResults);

    return { matches };
  }

  private async scanDirectory(
    dir: string,
    pattern: RegExp,
    matches: Array<{ path: string; line: number; column: number; preview: string }>,
    maxResults: number
  ): Promise<void> {
    if (matches.length >= maxResults) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (matches.length >= maxResults) break;

        // Skip common directories
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, pattern, matches, maxResults);
        } else if (entry.isFile()) {
          // Only search text files
          const ext = path.extname(entry.name);
          if (['.ts', '.tsx', '.js', '.jsx', '.md', '.json'].includes(ext)) {
            await this.searchFile(fullPath, pattern, matches, maxResults);
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  private async searchFile(
    filePath: string,
    pattern: RegExp,
    matches: Array<{ path: string; line: number; column: number; preview: string }>,
    maxResults: number
  ): Promise<void> {
    if (matches.length >= maxResults) return;

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(this.rootPath, filePath);

      for (let i = 0; i < lines.length; i++) {
        if (matches.length >= maxResults) break;

        const line = lines[i];
        const match = pattern.exec(line);

        if (match) {
          matches.push({
            path: relativePath,
            line: i + 1,
            column: match.index,
            preview: line.substring(0, 100), // First 100 chars
          });
        }

        // Reset lastIndex for global regex
        pattern.lastIndex = 0;
      }
    } catch {
      // Skip files we can't read
    }
  }
}
