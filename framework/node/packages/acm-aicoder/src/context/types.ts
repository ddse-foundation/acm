// Context Engine Types

export interface FileMetadata {
  path: string;
  size: number;
  mtime: number;
  hash: string;
  language: string;
  isBinary: boolean;
}

export interface WorkspaceIndex {
  files: FileMetadata[];
  totalFiles: number;
  totalSize: number;
  indexedAt: string;
  rootPath: string;
}

export interface SymbolInfo {
  name: string;
  kind: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'export' | 'import';
  path: string;
  line: number;
  column?: number;
  signature?: string;
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency' | 'peerDependency';
  packageJsonPath: string;
}

export interface ImportGraph {
  [filePath: string]: {
    imports: string[];
    exportedSymbols: string[];
  };
}

export interface TestMapping {
  testFile: string;
  targetFiles: string[];
  testFramework?: string;
}

export interface SearchResult {
  path: string;
  score: number;
  snippet: string;
  line: number;
  column?: number;
}

export interface ContextPack {
  goal: string;
  files: Array<{
    path: string;
    snippet: string;
    relevance: number;
  }>;
  symbols: SymbolInfo[];
  dependencies: DependencyInfo[];
  testFiles: string[];
  summary: string;
  generatedAt: string;
}
