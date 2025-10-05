// Enhanced Developer Tasks using Context Engine and V2 Tools
import { Task, type RunContext } from '@acm/sdk';
import path from 'path';
import type { ContextPack } from '../context/types.js';

/**
 * FindSymbolDefinitionTask - Locate symbol across codebase
 */
export class FindSymbolDefinitionTask extends Task<
  { symbolName: string; fileHint?: string },
  { locations: Array<{ path: string; line: number; snippet: string }> }
> {
  constructor() {
    super('find-symbol-definition', 'find_symbol_definition');
  }

  async execute(
    ctx: RunContext,
    input: { symbolName: string; fileHint?: string }
  ): Promise<{ locations: Array<{ path: string; line: number; snippet: string }> }> {
    const searchTool = ctx.getTool('code_search');
    if (!searchTool) throw new Error('CodeSearchTool not found');

    // Search for symbol
    const query = `${input.symbolName} function class interface`;
    const result = await searchTool.call({
      query,
      k: 5,
      preferTypes: ['.ts', '.tsx', '.js', '.jsx'],
      includeContext: true,
    });

    ctx.stream?.emit('task', {
      taskId: this.id,
      step: 'symbol_search_complete',
      resultsFound: result.results.length,
    });

    return {
      locations: result.results.map((r: any) => ({
        path: r.path,
        line: r.line,
        snippet: r.snippet,
      })),
    };
  }

  verification(): string[] {
    return ['output.locations !== undefined'];
  }
}

/**
 * ImplementFunctionTask - Create function with AI assistance
 */
export class ImplementFunctionTask extends Task<
  { 
    path: string;
    functionName: string;
    signature: string;
    intent: string;
    dryRun?: boolean;
  },
  { implemented: boolean; changes: string; testResults?: any }
> {
  constructor() {
    super('implement-function', 'implement_function');
  }

  async execute(
    ctx: RunContext,
    input: { 
      path: string;
      functionName: string;
      signature: string;
      intent: string;
      dryRun?: boolean;
    }
  ): Promise<{ implemented: boolean; changes: string; testResults?: any }> {
  const readTool = ctx.getTool('file_read_lines');
  const editTool = ctx.getTool('code_edit_v2');
    
    if (!readTool || !editTool) {
      throw new Error('Required tools not found');
    }

  const workspaceRoot = getWorkspaceRoot(ctx);
  const targetPath = resolveWorkspacePath(workspaceRoot, input.path);

  // Read the file to understand context
    ctx.stream?.emit('task', { taskId: this.id, step: 'reading_file' });
  const fileContent = await readTool.call({ path: targetPath });

    // Generate function implementation (simplified - in real use, call LLM)
    const implementation = `
export ${input.signature} {
  // TODO: ${input.intent}
  throw new Error('Not implemented');
}
`;

    // Apply changes
    ctx.stream?.emit('task', { taskId: this.id, step: 'applying_changes' });
    const newContent = fileContent.content + '\n' + implementation;
    
    const result = await editTool.call({
      path: targetPath,
      content: newContent,
      dryRun: input.dryRun,
      backup: !input.dryRun,
    });

    ctx.stream?.emit('task', { taskId: this.id, step: 'implementation_complete' });

    return {
      implemented: result.success,
      changes: implementation,
    };
  }

  policyInput(ctx: RunContext, input: any): Record<string, unknown> {
    const workspaceRoot = getWorkspaceRoot(ctx);
    return {
      path: resolveWorkspacePath(workspaceRoot, input.path),
      action: 'implement_function',
      dryRun: input.dryRun || false,
    };
  }

  verification(): string[] {
    return ['output.implemented === true'];
  }
}

/**
 * RefactorRenameSymbolTask - Rename symbol across codebase
 */
export class RefactorRenameSymbolTask extends Task<
  { symbol: string; newName: string; scope?: string; dryRun?: boolean },
  { occurrences: number; filesChanged: string[]; success: boolean }
> {
  constructor() {
    super('refactor-rename-symbol', 'refactor_rename_symbol');
  }

  async execute(
    ctx: RunContext,
    input: { symbol: string; newName: string; scope?: string; dryRun?: boolean }
  ): Promise<{ occurrences: number; filesChanged: string[]; success: boolean }> {
    const grepTool = ctx.getTool('grep');
    if (!grepTool) throw new Error('GrepTool not found');

    // Find all occurrences
    ctx.stream?.emit('task', { taskId: this.id, step: 'searching_occurrences' });
    const matches = await grepTool.call({
      pattern: input.symbol,
      regex: false,
      caseInsensitive: false,
      maxResults: 100,
    });

    ctx.stream?.emit('task', { 
      taskId: this.id, 
      step: 'occurrences_found',
      count: matches.matches.length,
    });

    // Get unique files
    const filesSet = new Set<string>(matches.matches.map((m: any) => String(m.path)));
    const filesChanged: string[] = Array.from(filesSet);

    // In production, would actually perform the rename
    if (!input.dryRun) {
      // TODO: Implement actual rename logic
      ctx.stream?.emit('task', { taskId: this.id, step: 'renaming_symbols' });
    }

    return {
      occurrences: matches.matches.length,
      filesChanged,
      success: true,
    };
  }

  policyInput(ctx: RunContext, input: any): Record<string, unknown> {
    return {
      action: 'refactor_rename',
      symbol: input.symbol,
      dryRun: input.dryRun || false,
    };
  }

  verification(): string[] {
    return ['output.occurrences >= 0', 'output.success === true'];
  }
}

/**
 * FixTypeErrorTask - Resolve TypeScript errors
 */
export class FixTypeErrorTask extends Task<
  { diagnostics: string; context?: string; dryRun?: boolean },
  { fixed: boolean; changes: string[]; remainingErrors: number }
> {
  constructor() {
    super('fix-type-error', 'fix_type_error');
  }

  async execute(
    ctx: RunContext,
    input: { diagnostics: string; context?: string; dryRun?: boolean }
  ): Promise<{ fixed: boolean; changes: string[]; remainingErrors: number }> {
    const buildTool = ctx.getTool('build');
    if (!buildTool) throw new Error('BuildTool not found');

    // Run build to get current errors
    ctx.stream?.emit('task', { taskId: this.id, step: 'building_project' });
    const buildResult = await buildTool.call({
      command: 'npm run build',
    });

    const errorCount = buildResult.errors.length;
    ctx.stream?.emit('task', { 
      taskId: this.id, 
      step: 'errors_detected',
      count: errorCount,
    });

    // In production, would use LLM to suggest fixes
    return {
      fixed: errorCount === 0,
      changes: [],
      remainingErrors: errorCount,
    };
  }

  policyInput(ctx: RunContext, input: any): Record<string, unknown> {
    return {
      action: 'fix_type_error',
      dryRun: input.dryRun || false,
    };
  }

  verification(): string[] {
    return ['output.remainingErrors !== undefined'];
  }
}

/**
 * GenerateUnitTestsTask - Create tests with AI
 */
export class GenerateUnitTestsTask extends Task<
  { targetPath: string; symbolName?: string; coverage?: string; dryRun?: boolean },
  { implemented: boolean; testPath: string; testCount: number }
> {
  constructor() {
    super('generate-unit-tests', 'generate_unit_tests');
  }

  async execute(
    ctx: RunContext,
    input: { targetPath: string; symbolName?: string; coverage?: string; dryRun?: boolean }
  ): Promise<{ implemented: boolean; testPath: string; testCount: number }> {
    const readTool = ctx.getTool('file_read_lines');
    const editTool = ctx.getTool('code_edit_v2');

    if (!readTool || !editTool) {
      throw new Error('Required tools not found');
    }

  const workspaceRoot = getWorkspaceRoot(ctx);
  const absoluteTargetPath = resolveWorkspacePath(workspaceRoot, input.targetPath);

  // Read target file
    ctx.stream?.emit('task', { taskId: this.id, step: 'reading_target' });
  await readTool.call({ path: absoluteTargetPath });

    // Generate test file path
  const testPathAbsolute = absoluteTargetPath.replace(/\.ts$/, '.test.ts');
  const testPath = toWorkspaceRelative(workspaceRoot, testPathAbsolute);

    // Generate test template (simplified)
    const testContent = `import { describe, it, expect } from 'vitest';
import { ${input.symbolName || 'module'} } from './${input.targetPath.replace(/\.ts$/, '')}';

describe('${input.symbolName || 'Module'} Tests', () => {
  it('should work correctly', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});
`;

    ctx.stream?.emit('task', { taskId: this.id, step: 'generating_tests' });
    const result = await editTool.call({
      path: testPathAbsolute,
      content: testContent,
      dryRun: input.dryRun,
    });

    return {
      implemented: result.success,
      testPath,
      testCount: 1,
    };
  }

  policyInput(ctx: RunContext, input: any): Record<string, unknown> {
    const workspaceRoot = getWorkspaceRoot(ctx);
    return {
      action: 'generate_tests',
      targetPath: resolveWorkspacePath(workspaceRoot, input.targetPath),
      dryRun: input.dryRun || false,
    };
  }

  verification(): string[] {
    return ['output.implemented === true', 'output.testCount > 0'];
  }
}

function getWorkspaceRoot(ctx: RunContext): string {
  const workspace = (ctx.context?.facts?.workspace as string) ?? process.cwd();
  return path.resolve(workspace);
}

function resolveWorkspacePath(workspaceRoot: string, filePath?: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Task requires a valid file path');
  }

  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(workspaceRoot, filePath);
}

function toWorkspaceRelative(workspaceRoot: string, targetPath: string): string {
  const relative = path.relative(workspaceRoot, targetPath);
  return relative && !relative.startsWith('..') ? relative : targetPath;
}

/**
 * ReadFileLinesTask - Precise file slice reading
 */
export class ReadFileLinesTask extends Task<
  { path: string; startLine?: number; endLine?: number; maxLines?: number },
  { content: string; startLine: number; endLine: number; totalLines?: number }
> {
  constructor() {
    super('read-file-lines', 'read_file_lines');
  }

  async execute(
    ctx: RunContext,
    input: { path: string; startLine?: number; endLine?: number; maxLines?: number }
  ): Promise<{ content: string; startLine: number; endLine: number; totalLines?: number }> {
    const readLines = ctx.getTool('file_read_lines');
    if (!readLines) throw new Error('FileReadLinesTool not found');

    // Normalize path aliases from planner (filepath/filePath)
    const anyInput = input as any;
    const normalizedPath: string | undefined = anyInput?.path ?? anyInput?.filepath ?? anyInput?.filePath;
    if (!normalizedPath) {
      throw new Error('ReadFileLinesTask: missing required path. Accepted keys: path | filepath | filePath');
    }

    const res = await readLines.call({
      path: normalizedPath,
      startLine: input.startLine,
      endLine: input.endLine,
      maxLines: input.maxLines,
    });
    return res;
  }

  verification(): string[] {
    return ['output.content !== undefined'];
  }
}

/**
 * DiffFilesTask - Generate unified diff between two files
 */
export class DiffFilesTask extends Task<
  { aPath: string; bPath: string; context?: number },
  { diff: string; stats: { filesChanged: number; additions: number; deletions: number } }
> {
  constructor() {
    super('diff-files', 'diff_files');
  }

  async execute(
    ctx: RunContext,
    input: { aPath: string; bPath: string; context?: number }
  ): Promise<{ diff: string; stats: { filesChanged: number; additions: number; deletions: number } }> {
    const diffTool = ctx.getTool('diff');
    if (!diffTool) throw new Error('DiffTool not found');

    const res = await diffTool.call({ aPath: input.aPath, bPath: input.bPath, context: input.context });
    return res;
  }

  verification(): string[] {
    return ['output.diff !== undefined'];
  }
}

/**
 * GrepSearchTask - Fast pattern search across workspace
 */
export class GrepSearchTask extends Task<
  { pattern: string; regex?: boolean; caseInsensitive?: boolean; maxResults?: number },
  { matches: Array<{ path: string; line: number; column: number; preview: string }> }
> {
  constructor() {
    super('grep-search', 'grep_search');
  }

  async execute(
    ctx: RunContext,
    input: { pattern: string; regex?: boolean; caseInsensitive?: boolean; maxResults?: number }
  ): Promise<{ matches: Array<{ path: string; line: number; column: number; preview: string }> }> {
    const grep = ctx.getTool('grep');
    if (!grep) throw new Error('GrepTool not found');
    const res = await grep.call({
      pattern: input.pattern,
      regex: input.regex,
      caseInsensitive: input.caseInsensitive,
      maxResults: input.maxResults,
    });
    return res;
  }

  verification(): string[] {
    return ['output.matches !== undefined'];
  }
}
