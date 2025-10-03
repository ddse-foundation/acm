// Code Intelligence Tools
import { Tool } from '@acm/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * CodeReadTool - Structured file/directory reads with size limits
 */
export class CodeReadTool extends Tool<
  { path: string; maxSize?: number },
  { content: string; size: number; lines: number }
> {
  name(): string {
    return 'code_read';
  }

  async call(input: { path: string; maxSize?: number }): Promise<{
    content: string;
    size: number;
    lines: number;
  }> {
    const maxSize = input.maxSize || 100000; // 100KB default limit
    const targetPath = path.resolve(input.path);

    // Check if path exists
    const stats = await fs.stat(targetPath);

    if (stats.isDirectory()) {
      // List directory contents
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const content = entries
        .map(e => `${e.isDirectory() ? '[DIR]' : '[FILE]'} ${e.name}`)
        .join('\n');
      
      return {
        content,
        size: content.length,
        lines: entries.length,
      };
    }

    // Read file with size limit
    if (stats.size > maxSize) {
      throw new Error(`File size ${stats.size} exceeds max limit ${maxSize}`);
    }

    const content = await fs.readFile(targetPath, 'utf-8');
    const lines = content.split('\n').length;

    return {
      content,
      size: stats.size,
      lines,
    };
  }
}

/**
 * CodeEditTool - Diff-based edits with git integration
 */
export class CodeEditTool extends Tool<
  { path: string; content: string; dryRun?: boolean },
  { success: boolean; path: string; message: string }
> {
  name(): string {
    return 'code_edit';
  }

  async call(input: {
    path: string;
    content: string;
    dryRun?: boolean;
  }): Promise<{ success: boolean; path: string; message: string }> {
    const targetPath = path.resolve(input.path);

    if (input.dryRun) {
      return {
        success: true,
        path: targetPath,
        message: 'Dry run: would write content to file',
      };
    }

    // Ensure directory exists
    const dir = path.dirname(targetPath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(targetPath, input.content, 'utf-8');

    return {
      success: true,
      path: targetPath,
      message: `Successfully wrote ${input.content.length} bytes to ${targetPath}`,
    };
  }
}

/**
 * CodeAnalyzeTool - Static analysis and code review
 */
export class CodeAnalyzeTool extends Tool<
  { path: string; analysisType?: string },
  { summary: string; issues: Array<{ line?: number; message: string; severity: string }> }
> {
  name(): string {
    return 'code_analyze';
  }

  async call(input: {
    path: string;
    analysisType?: string;
  }): Promise<{
    summary: string;
    issues: Array<{ line?: number; message: string; severity: string }>;
  }> {
    const targetPath = path.resolve(input.path);
    const content = await fs.readFile(targetPath, 'utf-8');
    const lines = content.split('\n');

    // Simple static analysis
    const issues: Array<{ line?: number; message: string; severity: string }> = [];

    // Check for common issues
    lines.forEach((line, idx) => {
      if (line.includes('console.log') && !line.trim().startsWith('//')) {
        issues.push({
          line: idx + 1,
          message: 'Console.log statement found',
          severity: 'warning',
        });
      }
      if (line.includes('TODO') || line.includes('FIXME')) {
        issues.push({
          line: idx + 1,
          message: 'TODO/FIXME comment found',
          severity: 'info',
        });
      }
    });

    return {
      summary: `Analyzed ${lines.length} lines, found ${issues.length} issues`,
      issues,
    };
  }
}

/**
 * TestRunnerTool - Run tests and capture results
 */
export class TestRunnerTool extends Tool<
  { command: string; cwd?: string },
  { success: boolean; output: string; exitCode: number }
> {
  name(): string {
    return 'test_runner';
  }

  async call(input: {
    command: string;
    cwd?: string;
  }): Promise<{ success: boolean; output: string; exitCode: number }> {
    const { execa } = await import('execa');
    
    try {
      const result = await execa(input.command, {
        shell: true,
        cwd: input.cwd || process.cwd(),
        timeout: 300000, // 5 minute timeout
      });

      return {
        success: result.exitCode === 0,
        output: result.stdout + '\n' + result.stderr,
        exitCode: result.exitCode || 0,
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout + '\n' + error.stderr,
        exitCode: error.exitCode || 1,
      };
    }
  }
}
