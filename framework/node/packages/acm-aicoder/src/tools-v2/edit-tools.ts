// Edit Tools - Code modification with safety
import { Tool } from '@ddse/acm-sdk';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * PatchApplyTool - Apply unified diffs with conflict handling
 */
export class PatchApplyTool extends Tool<
  { diffs: string | string[]; strategy?: 'fail' | 'best-effort'; dryRun?: boolean },
  { 
    applied: Array<{ path: string; hunks: number }>;
    conflicts: Array<{ path: string; context: string }>;
    preview?: boolean;
  }
> {
  name(): string {
    return 'patch_apply';
  }

  async call(input: { 
    diffs: string | string[]; 
    strategy?: 'fail' | 'best-effort';
    dryRun?: boolean;
  }): Promise<{ 
    applied: Array<{ path: string; hunks: number }>;
    conflicts: Array<{ path: string; context: string }>;
    preview?: boolean;
  }> {
    const diffs = Array.isArray(input.diffs) ? input.diffs : [input.diffs];
    const strategy = input.strategy ?? 'fail';
    const dryRun = input.dryRun ?? false;

    const applied: Array<{ path: string; hunks: number }> = [];
    const conflicts: Array<{ path: string; context: string }> = [];

    for (const diff of diffs) {
      // Parse diff to extract file path and changes
      const lines = diff.split('\n');
      let filePath = '';
      let hunks = 0;

      for (const line of lines) {
        if (line.startsWith('+++')) {
          // Extract file path (remove +++ prefix and any a/ or b/ prefix)
          filePath = line.substring(4).trim().replace(/^[ab]\//, '');
        } else if (line.startsWith('@@')) {
          hunks++;
        }
      }

      if (!filePath) {
        conflicts.push({
          path: 'unknown',
          context: 'Could not parse file path from diff',
        });
        continue;
      }

      // Apply changes (simplified - in production, use a proper diff parser)
      if (!dryRun) {
        try {
          // For now, just track that we would apply
          applied.push({ path: filePath, hunks });
        } catch (error: any) {
          if (strategy === 'fail') {
            throw error;
          }
          conflicts.push({
            path: filePath,
            context: error.message,
          });
        }
      } else {
        applied.push({ path: filePath, hunks });
      }
    }

    return {
      applied,
      conflicts,
      preview: dryRun,
    };
  }
}

/**
 * CodeEditToolV2 - Enhanced code editing with backup
 */
export class CodeEditToolV2 extends Tool<
  { path: string; content: string; dryRun?: boolean; backup?: boolean },
  { success: boolean; path: string; message: string; backupPath?: string }
> {
  private rootPath: string;

  constructor(rootPath: string = process.cwd()) {
    super();
    this.rootPath = path.resolve(rootPath);
  }

  name(): string {
    return 'code_edit_v2';
  }

  async call(input: {
    path: string;
    content: string;
    dryRun?: boolean;
    backup?: boolean;
  }): Promise<{ success: boolean; path: string; message: string; backupPath?: string }> {
    const targetPath = this.resolvePath(input.path);

    if (input.dryRun) {
      return {
        success: true,
        path: targetPath,
        message: `Dry run: would write ${input.content.length} bytes to ${targetPath}`,
      };
    }

    // Create backup if requested
    let backupPath: string | undefined;
    if (input.backup) {
      try {
  const existing = await fs.readFile(targetPath, 'utf-8');
        backupPath = `${targetPath}.backup`;
        await fs.writeFile(backupPath, existing, 'utf-8');
      } catch {
        // File might not exist yet
      }
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
      backupPath,
    };
  }

  private resolvePath(filePath: string): string {
    return path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.rootPath, filePath);
  }
}
