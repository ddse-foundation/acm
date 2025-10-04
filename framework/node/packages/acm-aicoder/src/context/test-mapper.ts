// Test Mapper - Identify test files and their targets
import * as path from 'path';
import type { TestMapping, WorkspaceIndex } from './types.js';

const TEST_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /__tests__\//,
  /\.test\..*$/,
];

export class TestMapper {
  /**
   * Map test files to their likely source targets
   */
  static mapTests(index: WorkspaceIndex): TestMapping[] {
    const mappings: TestMapping[] = [];

    // Find test files
    const testFiles = index.files.filter(f => 
      TEST_PATTERNS.some(pattern => pattern.test(f.path))
    );

    for (const testFile of testFiles) {
      // Try to infer source file
      const targetFiles = this.inferTargetFiles(testFile.path, index);
      
      // Detect test framework
      const framework = this.detectFramework(testFile.path);

      mappings.push({
        testFile: testFile.path,
        targetFiles,
        testFramework: framework,
      });
    }

    return mappings;
  }

  /**
   * Infer target source files from test file path
   */
  private static inferTargetFiles(testPath: string, index: WorkspaceIndex): string[] {
    const targets: string[] = [];

    // Remove test suffix/prefix patterns
    let basePath = testPath
      .replace(/\.test\.(ts|tsx|js|jsx)$/, '.$1')
      .replace(/\.spec\.(ts|tsx|js|jsx)$/, '.$1')
      .replace(/__tests__\//, '');

    // Check if this file exists
    if (index.files.some(f => f.path === basePath)) {
      targets.push(basePath);
    }

    // Try src/ variant
    const srcPath = path.join('src', path.basename(basePath));
    if (index.files.some(f => f.path === srcPath)) {
      targets.push(srcPath);
    }

    return targets;
  }

  /**
   * Detect test framework from file path
   */
  private static detectFramework(testPath: string): string | undefined {
    if (testPath.includes('jest')) return 'jest';
    if (testPath.includes('mocha')) return 'mocha';
    if (testPath.includes('vitest')) return 'vitest';
    if (testPath.includes('spec')) return 'jasmine';
    return undefined;
  }
}
