// Analysis and Utility Tasks
import { Task, type RunContext } from '@acm/sdk';
import { 
  WorkspaceIndexer,
  SymbolExtractor,
  DependencyMapper,
  TestMapper,
  CodeSearch,
  ContextPackGenerator,
  type ContextPack,
} from '../context/index.js';

/**
 * AnalyzeWorkspaceTask - Deep workspace analysis with context
 */
export class AnalyzeWorkspaceTask extends Task<
  { path?: string; includeTests?: boolean; includeDeps?: boolean },
  { 
    summary: string;
    totalFiles: number;
    codeFiles: number;
    symbols: number;
    dependencies: number;
    testFiles: number;
    contextPack?: ContextPack;
  }
> {
  constructor() {
    super('analyze-workspace', 'analyze_workspace');
  }

  async execute(
    ctx: RunContext,
    input: { path?: string; includeTests?: boolean; includeDeps?: boolean }
  ): Promise<{ 
    summary: string;
    totalFiles: number;
    codeFiles: number;
    symbols: number;
    dependencies: number;
    testFiles: number;
    contextPack?: ContextPack;
  }> {
    const rootPath = input.path || process.cwd();

    // Build index
    ctx.stream?.emit('task', { taskId: this.id, step: 'indexing_workspace' });
    const indexer = new WorkspaceIndexer(rootPath);
    const index = await indexer.buildIndex({ useCache: true });

    ctx.stream?.emit('task', { 
      taskId: this.id, 
      step: 'index_complete',
      totalFiles: index.totalFiles,
    });

    // Extract symbols
    ctx.stream?.emit('task', { taskId: this.id, step: 'extracting_symbols' });
    const symbolExtractor = new SymbolExtractor(rootPath);
    const symbols = await symbolExtractor.extractSymbols(index);

    // Extract dependencies
    const depMapper = new DependencyMapper(rootPath);
    const dependencies = await depMapper.extractDependencies(index);

    // Map tests
    const testMappings = TestMapper.mapTests(index);

    // Count code files
    const codeFiles = index.files.filter(f => 
      ['typescript', 'javascript'].includes(f.language)
    ).length;

    ctx.stream?.emit('task', { 
      taskId: this.id, 
      step: 'analysis_complete',
      symbols: symbols.length,
      dependencies: dependencies.length,
      tests: testMappings.length,
    });

    const summary = `Analyzed ${index.totalFiles} files: ${codeFiles} code files, ` +
                   `${symbols.length} symbols, ${dependencies.length} dependencies, ` +
                   `${testMappings.length} test files`;

    return {
      summary,
      totalFiles: index.totalFiles,
      codeFiles,
      symbols: symbols.length,
      dependencies: dependencies.length,
      testFiles: testMappings.length,
    };
  }

  verification(): string[] {
    return ['output.totalFiles > 0', 'output.summary !== undefined'];
  }
}

/**
 * CollectContextPackTask - Generate context for planning
 */
export class CollectContextPackTask extends Task<
  { goal: string; path?: string; maxFiles?: number; maxSymbols?: number },
  { contextPack: ContextPack }
> {
  constructor() {
    super('collect-context-pack', 'collect_context_pack');
  }

  async execute(
    ctx: RunContext,
    input: { goal: string; path?: string; maxFiles?: number; maxSymbols?: number }
  ): Promise<{ contextPack: ContextPack }> {
    const rootPath = input.path || process.cwd();

    // Build index and search
    ctx.stream?.emit('task', { taskId: this.id, step: 'indexing' });
    const indexer = new WorkspaceIndexer(rootPath);
    const index = await indexer.buildIndex({ useCache: true });

    const search = new CodeSearch(rootPath);
    await search.indexFiles(index);

    // Extract symbols and dependencies
    const symbolExtractor = new SymbolExtractor(rootPath);
    const symbols = await symbolExtractor.extractSymbols(index);

    const depMapper = new DependencyMapper(rootPath);
    const dependencies = await depMapper.extractDependencies(index);

    const testMappings = TestMapper.mapTests(index);

    // Generate context pack
    ctx.stream?.emit('task', { taskId: this.id, step: 'generating_context' });
    const packGenerator = new ContextPackGenerator(search);
    const contextPack = await packGenerator.generate(
      input.goal,
      index,
      symbols,
      dependencies,
      testMappings,
      {
        maxFiles: input.maxFiles ?? 8,
        maxSymbols: input.maxSymbols ?? 20,
        includeTests: true,
        includeDependencies: true,
      }
    );

    ctx.stream?.emit('task', { 
      taskId: this.id, 
      step: 'context_ready',
      files: contextPack.files.length,
      symbols: contextPack.symbols.length,
    });

    return { contextPack };
  }

  verification(): string[] {
    return ['output.contextPack !== undefined', 'output.contextPack.files.length > 0'];
  }
}

/**
 * SearchCodeTask - Search for code with context
 */
export class SearchCodeTask extends Task<
  { query: string; k?: number; preferTypes?: string[]; path?: string },
  { results: Array<{ path: string; score: number; snippet: string; line: number }> }
> {
  constructor() {
    super('search-code', 'search_code');
  }

  async execute(
    ctx: RunContext,
    input: { query: string; k?: number; preferTypes?: string[]; path?: string }
  ): Promise<{ results: Array<{ path: string; score: number; snippet: string; line: number }> }> {
    const searchTool = ctx.getTool('code_search');
    if (!searchTool) throw new Error('CodeSearchTool not found');

    ctx.stream?.emit('task', { taskId: this.id, step: 'searching', query: input.query });

    const result = await searchTool.call({
      query: input.query,
      k: input.k ?? 10,
      preferTypes: input.preferTypes,
      includeContext: true,
    });

    ctx.stream?.emit('task', { 
      taskId: this.id, 
      step: 'search_complete',
      resultsFound: result.results.length,
    });

    return { results: result.results };
  }

  verification(): string[] {
    return ['output.results !== undefined'];
  }
}
