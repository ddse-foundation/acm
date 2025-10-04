// Symbol Extractor - Extract symbols from TypeScript/JavaScript files
import * as fs from 'fs/promises';
import * as path from 'path';
import type { SymbolInfo, WorkspaceIndex } from './types.js';

/**
 * Simple symbol extractor using regex patterns
 * For production use, consider ts-morph or @typescript/vfs
 */
export class SymbolExtractor {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  /**
   * Extract symbols from indexed files
   */
  async extractSymbols(index: WorkspaceIndex): Promise<SymbolInfo[]> {
    const symbols: SymbolInfo[] = [];

    // Filter to TS/JS files
    const codeFiles = index.files.filter(f => 
      (f.language === 'typescript' || f.language === 'javascript') &&
      !f.isBinary &&
      f.size < 500_000
    );

    for (const file of codeFiles) {
      try {
        const fullPath = path.join(this.rootPath, file.path);
        const content = await fs.readFile(fullPath, 'utf-8');
        const fileSymbols = this.parseSymbols(content, file.path);
        symbols.push(...fileSymbols);
      } catch {
        // Skip files we can't read
      }
    }

    return symbols;
  }

  /**
   * Parse symbols from file content using regex
   */
  private parseSymbols(content: string, filePath: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    const lines = content.split('\n');

    // Patterns for different symbol types
    const patterns = {
      function: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
      class: /(?:export\s+)?class\s+(\w+)/g,
      interface: /(?:export\s+)?interface\s+(\w+)/g,
      type: /(?:export\s+)?type\s+(\w+)/g,
      const: /(?:export\s+)?const\s+(\w+)/g,
      let: /(?:export\s+)?let\s+(\w+)/g,
      var: /(?:export\s+)?var\s+(\w+)/g,
    };

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      // Extract functions
      const functionMatches = line.matchAll(patterns.function);
      for (const match of functionMatches) {
        symbols.push({
          name: match[1],
          kind: 'function',
          path: filePath,
          line: lineNum,
          signature: line.trim(),
        });
      }

      // Extract classes
      const classMatches = line.matchAll(patterns.class);
      for (const match of classMatches) {
        symbols.push({
          name: match[1],
          kind: 'class',
          path: filePath,
          line: lineNum,
        });
      }

      // Extract interfaces
      const interfaceMatches = line.matchAll(patterns.interface);
      for (const match of interfaceMatches) {
        symbols.push({
          name: match[1],
          kind: 'interface',
          path: filePath,
          line: lineNum,
        });
      }

      // Extract types
      const typeMatches = line.matchAll(patterns.type);
      for (const match of typeMatches) {
        symbols.push({
          name: match[1],
          kind: 'type',
          path: filePath,
          line: lineNum,
        });
      }

      // Extract exports (const/let/var)
      if (line.includes('export')) {
        for (const [pattern, kind] of [
          [patterns.const, 'export'],
          [patterns.let, 'export'],
          [patterns.var, 'export'],
        ] as const) {
          const matches = line.matchAll(pattern);
          for (const match of matches) {
            symbols.push({
              name: match[1],
              kind,
              path: filePath,
              line: lineNum,
            });
          }
        }
      }
    });

    return symbols;
  }

  /**
   * Find symbol definition by name
   */
  static findSymbol(symbols: SymbolInfo[], name: string): SymbolInfo[] {
    return symbols.filter(s => 
      s.name === name || s.name.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Get symbols by kind
   */
  static filterByKind(symbols: SymbolInfo[], kinds: SymbolInfo['kind'][]): SymbolInfo[] {
    const kindSet = new Set(kinds);
    return symbols.filter(s => kindSet.has(s.kind));
  }
}
