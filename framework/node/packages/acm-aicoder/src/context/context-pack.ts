// Context Pack Generator - Create rich context for LLM planning
import type { 
  ContextPack, 
  WorkspaceIndex, 
  SymbolInfo, 
  DependencyInfo, 
  TestMapping 
} from './types.js';
import { CodeSearch } from './code-search.js';

export interface ContextPackOptions {
  maxFiles?: number;
  maxSymbols?: number;
  includeTests?: boolean;
  includeDependencies?: boolean;
}

export class ContextPackGenerator {
  private search: CodeSearch;

  constructor(search: CodeSearch) {
    this.search = search;
  }

  /**
   * Generate context pack for a goal
   */
  async generate(
    goal: string,
    index: WorkspaceIndex,
    symbols: SymbolInfo[],
    dependencies: DependencyInfo[],
    testMappings: TestMapping[],
    options: ContextPackOptions = {}
  ): Promise<ContextPack> {
    const maxFiles = options.maxFiles ?? 8;
    const maxSymbols = options.maxSymbols ?? 20;
    const normalizedGoal = (goal || '').toString();
    const searchQuery = normalizedGoal.trim().length > 0
      ? normalizedGoal
      : 'workspace overview';

    // Search for relevant files
    const searchResults = await this.search.search(searchQuery, {
      k: maxFiles,
      includeContext: true,
      contextLines: 2,
    });

    // Extract relevant symbols (top matching symbols)
    const relevantSymbols = this.findRelevantSymbols(normalizedGoal, symbols, maxSymbols);

    // Filter dependencies if requested
    const relevantDeps = options.includeDependencies 
      ? dependencies.slice(0, 20) // Top 20 deps
      : [];

    // Extract test files if requested
    const testFiles = options.includeTests
      ? testMappings.map(m => m.testFile)
      : [];

    // Build context pack
    const pack: ContextPack = {
      goal: normalizedGoal,
      files: searchResults.map(r => ({
        path: r.path,
        snippet: r.snippet,
        relevance: r.score,
      })),
      symbols: relevantSymbols,
      dependencies: relevantDeps,
      testFiles,
      summary: this.generateSummary(index, searchResults.length, relevantSymbols.length),
      generatedAt: new Date().toISOString(),
    };

    return pack;
  }

  /**
   * Find symbols relevant to the goal
   */
  private findRelevantSymbols(goal: string, symbols: SymbolInfo[], limit: number): SymbolInfo[] {
    const goalLower = (goal || '').toLowerCase();
    const tokens = goalLower.split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
      return [];
    }

    // Score symbols by relevance
    const scored = symbols.map(symbol => {
      let score = 0;
      const nameLower = symbol.name.toLowerCase();

      // Exact match
      if (tokens.some(t => nameLower === t)) {
        score += 10;
      }

      // Partial match
      if (tokens.some(t => nameLower.includes(t) || t.includes(nameLower))) {
        score += 5;
      }

      // Boost exported symbols
      if (symbol.kind === 'function' || symbol.kind === 'class') {
        score += 2;
      }

      return { symbol, score };
    });

    // Sort by score and return top symbols
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.symbol);
  }

  /**
   * Generate a summary of the context
   */
  private generateSummary(index: WorkspaceIndex, fileCount: number, symbolCount: number): string {
    const totalFiles = index.totalFiles;
    const totalSize = (index.totalSize / 1024 / 1024).toFixed(2);

    return `Workspace: ${totalFiles} files, ${totalSize}MB. ` +
           `Context: ${fileCount} relevant files, ${symbolCount} symbols.`;
  }
}
