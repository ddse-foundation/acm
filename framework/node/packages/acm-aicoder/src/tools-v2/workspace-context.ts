// Workspace Context Retrieval Tool
import { Tool, type ContextRetrievalArtifact } from '@acm/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CodeSearch, WorkspaceIndexer, type WorkspaceIndex } from '../context/index.js';
import { GrepTool } from './search-tools.js';

export type WorkspaceContextOperation =
  | {
      type: 'search';
      query: string;
      k?: number;
      includeContext?: boolean;
      contextLines?: number;
      preferTypes?: string[];
      rationale?: string;
    }
  | {
      type: 'symbol';
      symbol: string;
      k?: number;
      rationale?: string;
    }
  | {
      type: 'grep';
      pattern: string;
      regex?: boolean;
      caseInsensitive?: boolean;
      maxResults?: number;
      rationale?: string;
    }
  | {
      type: 'file';
      path: string;
      startLine?: number;
      endLine?: number;
      maxBytes?: number;
      rationale?: string;
    }
  | {
      type: 'recent';
      limit?: number;
      languages?: string[];
      rationale?: string;
    }
  | {
      type: 'metadata';
      summary?: boolean;
      languages?: string[];
      rationale?: string;
    };

export interface WorkspaceContextRequest {
  directive?: string;
  goal?: string;
  operations?: WorkspaceContextOperation[];
}

const DEFAULT_MAX_BYTES = 16_000;

export class WorkspaceContextRetrievalTool extends Tool<
  WorkspaceContextRequest,
  ContextRetrievalArtifact[]
> {
  private rootPath: string;
  private codeSearch?: CodeSearch;
  private indexer: WorkspaceIndexer;
  private index?: WorkspaceIndex;
  private grepTool: GrepTool;
  private indexingPromise?: Promise<void>;

  constructor(rootPath: string = process.cwd()) {
    super();
    this.rootPath = path.resolve(rootPath);
    this.indexer = new WorkspaceIndexer(this.rootPath);
    this.grepTool = new GrepTool(this.rootPath);
  }

  name(): string {
    return 'workspace_context';
  }

  async call(request: WorkspaceContextRequest): Promise<ContextRetrievalArtifact[]> {
    const operations = request.operations && request.operations.length > 0
      ? request.operations
      : this.deriveOperationsFromDirective(request.directive);

    if (!operations || operations.length === 0) {
      return [];
    }

    await this.ensureSearchIndex();

    const artifacts: ContextRetrievalArtifact[] = [];
    const seen = new Set<string>();

    for (const operation of operations) {
      try {
        if (operation.type === 'search') {
          const searchArtifacts = await this.handleSearch(operation);
          this.pushArtifacts(searchArtifacts, artifacts, seen);
        } else if (operation.type === 'symbol') {
          const symbolArtifacts = await this.handleSymbol(operation);
          this.pushArtifacts(symbolArtifacts, artifacts, seen);
        } else if (operation.type === 'grep') {
          const grepArtifacts = await this.handleGrep(operation);
          this.pushArtifacts(grepArtifacts, artifacts, seen);
        } else if (operation.type === 'file') {
          const fileArtifact = await this.handleFile(operation);
          this.pushArtifacts(fileArtifact, artifacts, seen);
        } else if (operation.type === 'recent') {
          const recentArtifact = await this.handleRecent(operation);
          this.pushArtifacts(recentArtifact, artifacts, seen);
        } else if (operation.type === 'metadata') {
          const metadataArtifact = await this.handleMetadata(operation);
          this.pushArtifacts(metadataArtifact, artifacts, seen);
        }
      } catch (error) {
        // Skip failing operation but surface metadata for debugging
        this.pushArtifacts(
          {
            type: 'workspace.debug',
            content: {
              operation,
              error: error instanceof Error ? error.message : String(error),
            },
            promote: false,
            provenance: {
              tool: this.name(),
              stage: 'operation-error',
            },
          },
          artifacts,
          seen
        );
      }
    }

    return artifacts;
  }

  private async ensureSearchIndex(): Promise<void> {
    if (this.index && this.codeSearch) {
      return;
    }

    if (!this.indexingPromise) {
      this.indexingPromise = (async () => {
        this.index = await this.indexer.buildIndex({ useCache: true });
        this.codeSearch = new CodeSearch(this.rootPath);
        await this.codeSearch.indexFiles(this.index);
      })();
    }

    await this.indexingPromise;
  }

  private deriveOperationsFromDirective(directive?: string): WorkspaceContextOperation[] {
    if (!directive) {
      return [];
    }

    const separatorIndex = directive.indexOf(':');
    const payload = separatorIndex >= 0 ? directive.slice(separatorIndex + 1).trim() : '';

    if (payload.startsWith('{')) {
      try {
        const parsed = JSON.parse(payload);
        if (Array.isArray(parsed.operations)) {
          return parsed.operations as WorkspaceContextOperation[];
        }
        if (typeof parsed.query === 'string' && parsed.query.length > 0) {
          return [
            {
              type: 'search',
              query: parsed.query,
              k: parsed.k,
              includeContext: parsed.includeContext ?? true,
              rationale: parsed.rationale,
            },
          ];
        }
      } catch {
        // fall back to text parsing
      }
    }

    if (payload.length > 0) {
      return [
        {
          type: 'search',
          query: payload,
          includeContext: true,
        },
        {
          type: 'grep',
          pattern: payload,
          maxResults: 20,
        },
      ];
    }

    return [];
  }

  private pushArtifacts(
    artifact: ContextRetrievalArtifact | ContextRetrievalArtifact[] | null | undefined,
    collection: ContextRetrievalArtifact[],
    seen: Set<string>
  ): void {
    if (!artifact) return;
    const artifacts = Array.isArray(artifact) ? artifact : [artifact];

    for (const entry of artifacts) {
      if (!entry || typeof entry.type !== 'string') continue;

      const provenance = entry.provenance ?? { tool: this.name() };
      const keySource = JSON.stringify([
        entry.type,
        provenance.tool,
        (entry.content && (entry.content.path || entry.content.id || entry.content.key)) ??
          JSON.stringify(entry.content),
      ]);

      if (seen.has(keySource)) {
        continue;
      }

      seen.add(keySource);
      collection.push({
        ...entry,
        provenance,
      });
    }
  }

  private async handleSearch(operation: Extract<WorkspaceContextOperation, { type: 'search' }>): Promise<ContextRetrievalArtifact[]> {
    if (!this.codeSearch) {
      return [];
    }

    const results = await this.codeSearch.search(operation.query, {
      k: Math.min(operation.k ?? 8, 20),
      includeContext: operation.includeContext ?? true,
      contextLines: operation.contextLines ?? 2,
      preferTypes: operation.preferTypes,
    });

    return results.map(result => ({
      type: 'workspace.snippet',
      promote: true,
      content: {
        path: result.path,
        line: result.line,
        snippet: result.snippet,
        score: result.score,
        operation: 'bm25-search',
        query: operation.query,
        rationale: operation.rationale,
      },
      provenance: {
        tool: this.name(),
        operation: 'search',
      },
    }));
  }

  private async handleSymbol(operation: Extract<WorkspaceContextOperation, { type: 'symbol' }>): Promise<ContextRetrievalArtifact[]> {
    if (!this.codeSearch) {
      return [];
    }

    const results = await this.codeSearch.searchSymbol(operation.symbol);
    return results.slice(0, Math.min(operation.k ?? 5, 10)).map(result => ({
      type: 'workspace.snippet',
      promote: true,
      content: {
        path: result.path,
        line: result.line,
        snippet: result.snippet,
        score: result.score,
        operation: 'symbol-search',
        symbol: operation.symbol,
        rationale: operation.rationale,
      },
      provenance: {
        tool: this.name(),
        operation: 'symbol',
      },
    }));
  }

  private async handleGrep(operation: Extract<WorkspaceContextOperation, { type: 'grep' }>): Promise<ContextRetrievalArtifact[]> {
    const result = await this.grepTool.call({
      pattern: operation.pattern,
      regex: operation.regex,
      caseInsensitive: operation.caseInsensitive,
      maxResults: Math.min(operation.maxResults ?? 30, 100),
    });

    return result.matches.map(match => ({
      type: 'workspace.match',
      promote: true,
      content: {
        path: match.path,
        line: match.line,
        column: match.column,
        preview: match.preview,
        operation: 'grep',
        pattern: operation.pattern,
        rationale: operation.rationale,
      },
      provenance: {
        tool: this.name(),
        operation: 'grep',
      },
    }));
  }

  private async handleFile(operation: Extract<WorkspaceContextOperation, { type: 'file' }>): Promise<ContextRetrievalArtifact | null> {
    const absolutePath = path.isAbsolute(operation.path)
      ? operation.path
      : path.join(this.rootPath, operation.path);

    const relativePath = path.relative(this.rootPath, absolutePath);

    try {
      let content = await fs.readFile(absolutePath, 'utf-8');
      const maxBytes = operation.maxBytes ?? DEFAULT_MAX_BYTES;
      if (content.length > maxBytes) {
        content = content.slice(0, maxBytes);
      }

      let snippet = content;
      let startLine = 1;
      let endLine = content.split('\n').length;

      if (operation.startLine || operation.endLine) {
        const lines = content.split('\n');
        startLine = Math.max(operation.startLine ?? 1, 1);
        endLine = Math.min(operation.endLine ?? lines.length, lines.length);
        snippet = lines.slice(startLine - 1, endLine).join('\n');
      }

      return {
        type: 'workspace.file',
        promote: true,
        content: {
          path: relativePath,
          snippet,
          startLine,
          endLine,
          rationale: operation.rationale,
        },
        provenance: {
          tool: this.name(),
          operation: 'file',
        },
      };
    } catch {
      return {
        type: 'workspace.debug',
        promote: false,
        content: {
          operation,
          error: `Failed to read file: ${relativePath}`,
        },
        provenance: {
          tool: this.name(),
          operation: 'file',
        },
      };
    }
  }

  private async handleRecent(operation: Extract<WorkspaceContextOperation, { type: 'recent' }>): Promise<ContextRetrievalArtifact | null> {
    if (!this.index) {
      return null;
    }

    const limit = Math.min(operation.limit ?? 5, 20);
    const files = WorkspaceIndexer.getRecentFiles(this.index, limit);
    const filtered = operation.languages && operation.languages.length > 0
      ? files.filter(file => operation.languages!.includes(file.language))
      : files;

    return {
      type: 'workspace.metadata',
      promote: true,
      content: {
        kind: 'recent-files',
        files: filtered.map(file => ({
          path: file.path,
          mtime: file.mtime,
          language: file.language,
          size: file.size,
        })),
        rationale: operation.rationale,
      },
      provenance: {
        tool: this.name(),
        operation: 'recent',
      },
    };
  }

  private async handleMetadata(operation: Extract<WorkspaceContextOperation, { type: 'metadata' }>): Promise<ContextRetrievalArtifact | null> {
    if (!this.index) {
      return null;
    }

    return {
      type: 'workspace.metadata',
      promote: true,
      content: {
        kind: 'summary',
        files: this.index.totalFiles,
        totalSize: this.index.totalSize,
        languages: Array.from(new Set(this.index.files.map(f => f.language))).slice(0, 32),
        rationale: operation.rationale,
      },
      provenance: {
        tool: this.name(),
        operation: 'metadata',
      },
    };
  }
}
