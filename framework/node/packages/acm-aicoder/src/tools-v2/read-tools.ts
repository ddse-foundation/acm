// Enhanced Code Tools - Reading, Searching, and Comparison
import { Tool } from '@acm/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * FileStatTool - Check file existence, size, type
 */
export class FileStatTool extends Tool<
  { path: string },
  { exists: boolean; size: number; mtime: number; isBinary: boolean }
> {
  name(): string {
    return 'file_stat';
  }

  async call(input: { path: string }): Promise<{
    exists: boolean;
    size: number;
    mtime: number;
    isBinary: boolean;
  }> {
    try {
      const stats = await fs.stat(input.path);
      const ext = path.extname(input.path);
      const binaryExts = new Set(['.png', '.jpg', '.pdf', '.zip', '.exe', '.dll']);
      
      return {
        exists: true,
        size: stats.size,
        mtime: stats.mtimeMs,
        isBinary: binaryExts.has(ext),
      };
    } catch {
      return {
        exists: false,
        size: 0,
        mtime: 0,
        isBinary: false,
      };
    }
  }
}

/**
 * FileReadTool - Read files with offset/limit for large files
 */
export class FileReadToolV2 extends Tool<
  { path: string; offset?: number; limit?: number; ranges?: Array<{ start: number; end: number }> },
  { content: string; bytesRead: number; eof: boolean; lang?: string }
> {
  name(): string {
    return 'file_read_v2';
  }

  async call(input: { 
    path: string; 
    offset?: number; 
    limit?: number;
    ranges?: Array<{ start: number; end: number }>;
  }): Promise<{ content: string; bytesRead: number; eof: boolean; lang?: string }> {
    // Normalize common aliases for file path (planner may emit `filepath` or `filePath`)
    const anyInput = input as any;
    const normalizedPath: string | undefined = anyInput?.path ?? anyInput?.filepath ?? anyInput?.filePath;
    if (!normalizedPath) {
      throw new Error('FileReadToolV2: missing required path. Accepted keys: path | filepath | filePath');
    }
    const fullPath = path.resolve(normalizedPath);
    const stats = await fs.stat(fullPath);
    
    // Check if binary
    const ext = path.extname(normalizedPath);
    const binaryExts = new Set(['.png', '.jpg', '.pdf', '.zip', '.exe', '.dll']);
    if (binaryExts.has(ext)) {
      throw new Error(`File ${normalizedPath} is binary, cannot read as text`);
    }

    // Handle ranged reads
    if (input.ranges && input.ranges.length > 0) {
      const content = await fs.readFile(fullPath, 'utf-8');
      const rangeContents = input.ranges.map(range => 
        content.slice(range.start, range.end)
      );
      return {
        content: rangeContents.join('\n---\n'),
        bytesRead: rangeContents.reduce((sum, c) => sum + c.length, 0),
        eof: true,
        lang: this.detectLanguage(ext),
      };
    }

    // Handle offset/limit reads
    const offset = input.offset ?? 0;
    const limit = input.limit ?? stats.size;

  const content = await fs.readFile(fullPath, 'utf-8');
    const slice = content.slice(offset, offset + limit);
    const eof = offset + slice.length >= content.length;

    return {
      content: slice,
      bytesRead: slice.length,
      eof,
      lang: this.detectLanguage(ext),
    };
  }

  private detectLanguage(ext: string): string {
    const langMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
    };
    return langMap[ext] || 'text';
  }
}

/**
 * FileReadLinesTool - Line-ranged reading for precision
 */
export class FileReadLinesTool extends Tool<
  { path: string; startLine?: number; endLine?: number; maxLines?: number },
  { content: string; startLine: number; endLine: number; totalLines?: number }
> {
  name(): string {
    return 'file_read_lines';
  }

  async call(input: { 
    path: string; 
    startLine?: number; 
    endLine?: number;
    maxLines?: number;
  }): Promise<{ content: string; startLine: number; endLine: number; totalLines?: number }> {
    // Normalize common aliases for file path (planner may emit `filepath` or `filePath`)
    const anyInput = input as any;
    const normalizedPath: string | undefined = anyInput?.path ?? anyInput?.filepath ?? anyInput?.filePath;
    if (!normalizedPath) {
      throw new Error('FileReadLinesTool: missing required path. Accepted keys: path | filepath | filePath');
    }
    const fullPath = path.resolve(normalizedPath);
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');
    
    const startLine = Math.max(1, input.startLine ?? 1);
    const maxLines = input.maxLines ?? 100;
    const endLine = input.endLine 
      ? Math.min(lines.length, input.endLine)
      : Math.min(lines.length, startLine + maxLines - 1);

    // Extract lines (convert from 1-based to 0-based indexing)
    const selectedLines = lines.slice(startLine - 1, endLine);
    
    return {
      content: selectedLines.join('\n'),
      startLine,
      endLine,
      totalLines: lines.length,
    };
  }
}

/**
 * DiffTool - Generate unified diffs
 */
export class DiffTool extends Tool<
  { aPath?: string; aContent?: string; bPath?: string; bContent?: string; context?: number },
  { diff: string; stats: { filesChanged: number; additions: number; deletions: number } }
> {
  name(): string {
    return 'diff';
  }

  async call(input: { 
    aPath?: string; 
    aContent?: string; 
    bPath?: string; 
    bContent?: string;
    context?: number;
  }): Promise<{ diff: string; stats: { filesChanged: number; additions: number; deletions: number } }> {
    // Get content from paths or direct content
    const aContent = input.aContent ?? (input.aPath ? await fs.readFile(input.aPath, 'utf-8') : '');
    const bContent = input.bContent ?? (input.bPath ? await fs.readFile(input.bPath, 'utf-8') : '');

    // Simple line-by-line diff
    const aLines = aContent.split('\n');
    const bLines = bContent.split('\n');

    const diff: string[] = [];
    diff.push(`--- ${input.aPath || 'a'}`);
    diff.push(`+++ ${input.bPath || 'b'}`);

    let additions = 0;
    let deletions = 0;

    // Very simple diff (not optimal, but functional)
    const maxLen = Math.max(aLines.length, bLines.length);
    for (let i = 0; i < maxLen; i++) {
      const aLine = aLines[i];
      const bLine = bLines[i];

      if (aLine !== bLine) {
        if (aLine !== undefined) {
          diff.push(`-${aLine}`);
          deletions++;
        }
        if (bLine !== undefined) {
          diff.push(`+${bLine}`);
          additions++;
        }
      } else if (aLine !== undefined) {
        diff.push(` ${aLine}`);
      }
    }

    return {
      diff: diff.join('\n'),
      stats: {
        filesChanged: 1,
        additions,
        deletions,
      },
    };
  }
}
