// Test and Build Tools
import { Tool } from '@ddse/acm-sdk';
import * as path from 'path';

/**
 * RunTestsToolV2 - Enhanced test runner with better output
 */
export class RunTestsToolV2 extends Tool<
  { command?: string; cwd?: string; timeout?: number },
  { success: boolean; output: string; exitCode: number; duration: number }
> {
  private defaultCwd: string;

  constructor(defaultCwd: string = process.cwd()) {
    super();
    this.defaultCwd = path.resolve(defaultCwd);
  }

  name(): string {
    return 'run_tests_v2';
  }

  async call(input: {
    command?: string;
    cwd?: string;
    timeout?: number;
  }): Promise<{ success: boolean; output: string; exitCode: number; duration: number }> {
    const { execa } = await import('execa');
    const command = input.command || 'npm test';
    const timeout = input.timeout ?? 300000; // 5 minutes

    const startTime = Date.now();

    const resolvedCwd = this.resolveCwd(input.cwd);

    try {
      const result = await execa(command, {
        shell: true,
        cwd: resolvedCwd,
        timeout,
      });

      return {
        success: result.exitCode === 0,
        output: result.stdout + '\n' + result.stderr,
        exitCode: result.exitCode || 0,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: (error.stdout || '') + '\n' + (error.stderr || ''),
        exitCode: error.exitCode || 1,
        duration: Date.now() - startTime,
      };
    }
  }

  private resolveCwd(cwd?: string): string {
    if (!cwd) {
      return this.defaultCwd;
    }

    return path.isAbsolute(cwd) ? cwd : path.resolve(this.defaultCwd, cwd);
  }
}

/**
 * BuildTool - Run build commands with error extraction
 */
export class BuildTool extends Tool<
  { command?: string; cwd?: string; timeout?: number },
  { success: boolean; output: string; errors: string[]; duration: number }
> {
  private defaultCwd: string;

  constructor(defaultCwd: string = process.cwd()) {
    super();
    this.defaultCwd = path.resolve(defaultCwd);
  }

  name(): string {
    return 'build';
  }

  async call(input: {
    command?: string;
    cwd?: string;
    timeout?: number;
  }): Promise<{ success: boolean; output: string; errors: string[]; duration: number }> {
    const { execa } = await import('execa');
    const command = input.command || 'npm run build';
    const timeout = input.timeout ?? 600000; // 10 minutes

    const startTime = Date.now();

    const resolvedCwd = this.resolveCwd(input.cwd);

    try {
      const result = await execa(command, {
        shell: true,
        cwd: resolvedCwd,
        timeout,
      });

      return {
        success: result.exitCode === 0,
        output: result.stdout + '\n' + result.stderr,
        errors: [],
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      const output = (error.stdout || '') + '\n' + (error.stderr || '');
      
      // Extract errors (simple pattern matching)
      const errors = this.extractErrors(output);

      return {
        success: false,
        output,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  private extractErrors(output: string): string[] {
    const errors: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('error') || line.includes('Error:') || line.includes('ERROR')) {
        errors.push(line.trim());
      }
    }

    return errors.slice(0, 20); // Limit to first 20 errors
  }

  private resolveCwd(cwd?: string): string {
    if (!cwd) {
      return this.defaultCwd;
    }

    return path.isAbsolute(cwd) ? cwd : path.resolve(this.defaultCwd, cwd);
  }
}
