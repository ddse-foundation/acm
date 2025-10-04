// Workspace Indexer - Fast file scanning and caching
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import type { FileMetadata, WorkspaceIndex } from './types.js';

const DEFAULT_IGNORES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.cache',
  'coverage',
  '.aicoder',
  '*.lock',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
];

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.pdf', '.zip', '.tar', '.gz', '.bz2',
  '.exe', '.dll', '.so', '.dylib',
  '.woff', '.woff2', '.ttf', '.eot',
  '.mp4', '.mp3', '.wav', '.avi',
]);

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.md': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sql': 'sql',
  '.sh': 'shell',
};

export class WorkspaceIndexer {
  private rootPath: string;
  private ignorePatterns: Set<string>;
  private cacheDir: string;

  constructor(rootPath: string, additionalIgnores: string[] = []) {
    this.rootPath = path.resolve(rootPath);
    this.ignorePatterns = new Set([...DEFAULT_IGNORES, ...additionalIgnores]);
    this.cacheDir = path.join(this.rootPath, '.aicoder');
  }

  /**
   * Build or refresh the workspace index
   */
  async buildIndex(options: { useCache?: boolean; maxFileSize?: number } = {}): Promise<WorkspaceIndex> {
    const useCache = options.useCache ?? true;
    const maxFileSize = options.maxFileSize ?? 1_000_000; // 1MB default

    // Try to load from cache
    if (useCache) {
      const cached = await this.loadCache();
      if (cached) {
        return cached;
      }
    }

    // Scan workspace
    const files: FileMetadata[] = [];
    await this.scanDirectory(this.rootPath, files, maxFileSize);

    const index: WorkspaceIndex = {
      files,
      totalFiles: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      indexedAt: new Date().toISOString(),
      rootPath: this.rootPath,
    };

    // Save to cache
    if (useCache) {
      await this.saveCache(index);
    }

    return index;
  }

  /**
   * Recursively scan directory for files
   */
  private async scanDirectory(
    dirPath: string,
    files: FileMetadata[],
    maxFileSize: number
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(this.rootPath, fullPath);

        // Skip ignored patterns
        if (this.shouldIgnore(relativePath, entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, files, maxFileSize);
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath);
            
            // Skip files that are too large
            if (stats.size > maxFileSize) {
              continue;
            }

            const ext = path.extname(entry.name);
            const isBinary = BINARY_EXTENSIONS.has(ext);
            
            // Compute hash for non-binary files
            let hash = '';
            if (!isBinary && stats.size < 100_000) { // Hash only small text files
              try {
                const content = await fs.readFile(fullPath, 'utf-8');
                hash = createHash('sha256').update(content).digest('hex').substring(0, 16);
              } catch {
                // Skip files that can't be read
                continue;
              }
            }

            files.push({
              path: relativePath,
              size: stats.size,
              mtime: stats.mtimeMs,
              hash,
              language: LANGUAGE_MAP[ext] || 'unknown',
              isBinary,
            });
          } catch (error) {
            // Skip files we can't stat
            continue;
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  /**
   * Check if path should be ignored
   */
  private shouldIgnore(relativePath: string, name: string): boolean {
    // Check exact matches
    if (this.ignorePatterns.has(name)) {
      return true;
    }

    // Check if any part of the path matches ignore patterns
    const parts = relativePath.split(path.sep);
    for (const part of parts) {
      if (this.ignorePatterns.has(part)) {
        return true;
      }
    }

    // Check wildcard patterns
    for (const pattern of this.ignorePatterns) {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        if (regex.test(name)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Load index from cache
   */
  private async loadCache(): Promise<WorkspaceIndex | null> {
    try {
      const cachePath = path.join(this.cacheDir, 'index.json');
      const content = await fs.readFile(cachePath, 'utf-8');
      const index: WorkspaceIndex = JSON.parse(content);

      // Validate cache is recent (within 1 hour)
      const cacheAge = Date.now() - new Date(index.indexedAt).getTime();
      if (cacheAge > 3600_000) {
        return null;
      }

      return index;
    } catch {
      return null;
    }
  }

  /**
   * Save index to cache
   */
  private async saveCache(index: WorkspaceIndex): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      const cachePath = path.join(this.cacheDir, 'index.json');
      await fs.writeFile(cachePath, JSON.stringify(index, null, 2), 'utf-8');
    } catch {
      // Cache save is best-effort
    }
  }

  /**
   * Get files by language
   */
  static filterByLanguage(index: WorkspaceIndex, languages: string[]): FileMetadata[] {
    const langSet = new Set(languages);
    return index.files.filter(f => langSet.has(f.language));
  }

  /**
   * Get recently modified files
   */
  static getRecentFiles(index: WorkspaceIndex, count: number = 10): FileMetadata[] {
    return [...index.files]
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, count);
  }
}
