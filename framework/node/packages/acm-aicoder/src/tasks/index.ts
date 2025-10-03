// AI Coder Tasks
import { Task, type RunContext } from '@acm/sdk';

/**
 * AnalyzeCodebaseTask - Analyze a codebase and provide summary
 */
export class AnalyzeCodebaseTask extends Task<
  { path: string; depth?: number },
  { summary: string; files: number; issues: any[] }
> {
  constructor() {
    super('analyze-codebase-task', 'analyze_codebase');
  }

  async execute(
    ctx: RunContext,
    input: { path: string; depth?: number }
  ): Promise<{ summary: string; files: number; issues: any[] }> {
    const readTool = ctx.getTool('code_read');
    if (!readTool) throw new Error('CodeReadTool not found');

    const analyzeTool = ctx.getTool('code_analyze');
    if (!analyzeTool) throw new Error('CodeAnalyzeTool not found');

    // Read directory structure
    const dirResult = await readTool.call({ path: input.path });
    ctx.stream?.emit('task', { taskId: this.id, step: 'directory_read', files: dirResult.lines });

    // Count files
    const files = dirResult.content.split('\n').filter((l: string) => l.includes('[FILE]')).length;

    // Analyze if there are TypeScript/JavaScript files
    const allIssues: any[] = [];
    const lines = dirResult.content.split('\n');
    
    for (const line of lines.slice(0, 10)) { // Limit to first 10 files
      if (line.includes('[FILE]') && (line.includes('.ts') || line.includes('.js'))) {
        const filename = line.split(']')[1].trim();
        try {
          const analysisResult = await analyzeTool.call({
            path: `${input.path}/${filename}`,
          });
          allIssues.push(...analysisResult.issues.map((i: any) => ({ file: filename, ...i })));
        } catch (error) {
          // Skip files that can't be analyzed
        }
      }
    }

    ctx.stream?.emit('task', { taskId: this.id, step: 'analysis_complete', issuesFound: allIssues.length });

    return {
      summary: `Analyzed ${files} files, found ${allIssues.length} issues`,
      files,
      issues: allIssues,
    };
  }

  verification(): string[] {
    return ['output.files >= 0', 'output.summary !== undefined'];
  }
}

/**
 * FixBugTask - Analyze and fix a bug in the codebase
 */
export class FixBugTask extends Task<
  { path: string; bugDescription: string; dryRun?: boolean },
  { fixed: boolean; changes: string[]; testResults?: any }
> {
  constructor() {
    super('fix-bug-task', 'fix_bug');
  }

  async execute(
    ctx: RunContext,
    input: { path: string; bugDescription: string; dryRun?: boolean }
  ): Promise<{ fixed: boolean; changes: string[]; testResults?: any }> {
    const readTool = ctx.getTool('code_read');
    const editTool = ctx.getTool('code_edit');
    const testTool = ctx.getTool('test_runner');

    if (!readTool || !editTool) {
      throw new Error('Required tools not found');
    }

    // Read the file
    const fileContent = await readTool.call({ path: input.path });
    ctx.stream?.emit('task', { taskId: this.id, step: 'file_read', size: fileContent.size });

    // Simulate bug fix (in real implementation, this would use LLM)
    const fixedContent = fileContent.content.replace(/console\.log/g, '// console.log');
    
    // Apply fix
    const editResult = await editTool.call({
      path: input.path,
      content: fixedContent,
      dryRun: input.dryRun,
    });

    ctx.stream?.emit('task', { taskId: this.id, step: 'fix_applied', dryRun: input.dryRun });

    // Run tests if test tool is available and not dry run
    let testResults;
    if (testTool && !input.dryRun) {
      try {
        testResults = await testTool.call({ command: 'npm test' });
        ctx.stream?.emit('task', { taskId: this.id, step: 'tests_run', success: testResults.success });
      } catch (error) {
        // Tests may not be configured, continue anyway
      }
    }

    return {
      fixed: editResult.success,
      changes: [editResult.message],
      testResults,
    };
  }

  policyInput(ctx: RunContext, input: any): Record<string, unknown> {
    return {
      path: input.path,
      action: 'fix_bug',
      dryRun: input.dryRun || false,
    };
  }

  verification(): string[] {
    return ['output.fixed !== undefined', 'output.changes.length >= 0'];
  }
}

/**
 * ImplementFeatureTask - Implement a new feature
 */
export class ImplementFeatureTask extends Task<
  { description: string; targetPath: string; dryRun?: boolean },
  { implemented: boolean; files: string[]; summary: string }
> {
  constructor() {
    super('implement-feature-task', 'implement_feature');
  }

  async execute(
    ctx: RunContext,
    input: { description: string; targetPath: string; dryRun?: boolean }
  ): Promise<{ implemented: boolean; files: string[]; summary: string }> {
    const editTool = ctx.getTool('code_edit');
    if (!editTool) throw new Error('CodeEditTool not found');

    // Generate simple feature boilerplate
    const featureCode = `// Feature: ${input.description}
// TODO: Implement feature logic

export function newFeature() {
  // Implementation goes here
  console.log('Feature: ${input.description}');
}
`;

    const result = await editTool.call({
      path: input.targetPath,
      content: featureCode,
      dryRun: input.dryRun,
    });

    ctx.stream?.emit('task', { 
      taskId: this.id, 
      step: 'feature_created', 
      path: input.targetPath,
      dryRun: input.dryRun 
    });

    return {
      implemented: result.success,
      files: [input.targetPath],
      summary: `Feature scaffolded at ${input.targetPath}`,
    };
  }

  policyInput(ctx: RunContext, input: any): Record<string, unknown> {
    return {
      targetPath: input.targetPath,
      action: 'implement_feature',
      dryRun: input.dryRun || false,
    };
  }

  verification(): string[] {
    return ['output.implemented === true', 'output.files.length > 0'];
  }
}

/**
 * RunTestsTask - Run tests and report results
 */
export class RunTestsTask extends Task<
  { command?: string; cwd?: string },
  { success: boolean; output: string; summary: string }
> {
  constructor() {
    super('run-tests-task', 'run_tests');
  }

  async execute(
    ctx: RunContext,
    input: { command?: string; cwd?: string }
  ): Promise<{ success: boolean; output: string; summary: string }> {
    const testTool = ctx.getTool('test_runner');
    if (!testTool) throw new Error('TestRunnerTool not found');

    const command = input.command || 'npm test';
    
    ctx.stream?.emit('task', { taskId: this.id, step: 'tests_starting', command });

    const result = await testTool.call({
      command,
      cwd: input.cwd,
    });

    ctx.stream?.emit('task', { 
      taskId: this.id, 
      step: 'tests_complete', 
      success: result.success,
      exitCode: result.exitCode 
    });

    return {
      success: result.success,
      output: result.output,
      summary: result.success ? 'All tests passed' : 'Some tests failed',
    };
  }

  verification(): string[] {
    return ['output.output !== undefined'];
  }
}
