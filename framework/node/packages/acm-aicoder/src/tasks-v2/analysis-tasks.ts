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
  {
    path?: string;
    includeTests?: boolean;
    includeDeps?: boolean;
    runBuild?: boolean;
    runTests?: boolean;
    buildCommand?: string;
    testCommand?: string;
  },
  {
    summary: string;
    totalFiles: number;
    codeFiles: number;
    symbols: number;
    dependencies: number;
    testFiles: number;
    build?: { success: boolean; errors: string[]; duration: number };
    tests?: { success: boolean; exitCode: number; duration: number };
    contextPack?: ContextPack;
  }
> {
  constructor() {
    super('analyze-workspace', 'analyze_workspace');
  }

  async execute(
    ctx: RunContext,
    input: {
      path?: string;
      includeTests?: boolean;
      includeDeps?: boolean;
      runBuild?: boolean;
      runTests?: boolean;
      buildCommand?: string;
      testCommand?: string;
    }
  ): Promise<{
    summary: string;
    totalFiles: number;
    codeFiles: number;
    symbols: number;
    dependencies: number;
    testFiles: number;
    build?: { success: boolean; errors: string[]; duration: number };
    tests?: { success: boolean; exitCode: number; duration: number };
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

    // Optionally run build and tests using registered tools
    let buildSummary: { success: boolean; errors: string[]; duration: number } | undefined;
    if (input.runBuild) {
      ctx.stream?.emit('task', { taskId: this.id, step: 'running_build' });
      const buildTool = ctx.getTool('build');
      if (buildTool) {
        const buildRes = await buildTool.call({
          command: input.buildCommand || 'npm run build',
          cwd: rootPath,
        });
        buildSummary = {
          success: !!buildRes.success,
          errors: Array.isArray(buildRes.errors) ? buildRes.errors : [],
          duration: Number(buildRes.duration) || 0,
        };
        ctx.stream?.emit('task', {
          taskId: this.id,
          step: 'build_complete',
          success: buildSummary.success,
          errors: buildSummary.errors.length,
          duration: buildSummary.duration,
        });
      } else {
        ctx.stream?.emit('task', { taskId: this.id, step: 'build_tool_missing' });
      }
    }

    let testSummary: { success: boolean; exitCode: number; duration: number } | undefined;
    if (input.runTests) {
      ctx.stream?.emit('task', { taskId: this.id, step: 'running_tests' });
      const testTool = ctx.getTool('run_tests_v2');
      if (testTool) {
        const testRes = await testTool.call({
          command: input.testCommand || 'npm test',
          cwd: rootPath,
        });
        testSummary = {
          success: !!testRes.success,
          exitCode: Number(testRes.exitCode) || (testRes.success ? 0 : 1),
          duration: Number(testRes.duration) || 0,
        };
        ctx.stream?.emit('task', {
          taskId: this.id,
          step: 'tests_complete',
          success: testSummary.success,
          exitCode: testSummary.exitCode,
          duration: testSummary.duration,
        });
      } else {
        ctx.stream?.emit('task', { taskId: this.id, step: 'test_tool_missing' });
      }
    }

    const summaryParts = [
      `Analyzed ${index.totalFiles} files`,
      `${codeFiles} code files`,
      `${symbols.length} symbols`,
      `${dependencies.length} dependencies`,
      `${testMappings.length} test files`,
    ];
    if (buildSummary) {
      summaryParts.push(`build: ${buildSummary.success ? 'ok' : `${buildSummary.errors.length} errors`}`);
    }
    if (testSummary) {
      summaryParts.push(`tests: ${testSummary.success ? 'ok' : `exit ${testSummary.exitCode}`}`);
    }
    const summary = summaryParts.join(', ');

    return {
      summary,
      totalFiles: index.totalFiles,
      codeFiles,
      symbols: symbols.length,
      dependencies: dependencies.length,
      testFiles: testMappings.length,
      build: buildSummary,
      tests: testSummary,
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
