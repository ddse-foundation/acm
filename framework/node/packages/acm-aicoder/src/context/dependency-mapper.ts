// Dependency Mapper - Parse and analyze dependencies
import * as fs from 'fs/promises';
import * as path from 'path';
import type { DependencyInfo, WorkspaceIndex } from './types.js';

export class DependencyMapper {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  /**
   * Extract dependencies from package.json files
   */
  async extractDependencies(index: WorkspaceIndex): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];

    // Find all package.json files
    const packageFiles = index.files.filter(f => 
      path.basename(f.path) === 'package.json'
    );

    for (const file of packageFiles) {
      try {
        const fullPath = path.join(this.rootPath, file.path);
        const content = await fs.readFile(fullPath, 'utf-8');
        const pkg = JSON.parse(content);

        // Extract dependencies
        if (pkg.dependencies) {
          for (const [name, version] of Object.entries(pkg.dependencies)) {
            dependencies.push({
              name,
              version: version as string,
              type: 'dependency',
              packageJsonPath: file.path,
            });
          }
        }

        // Extract devDependencies
        if (pkg.devDependencies) {
          for (const [name, version] of Object.entries(pkg.devDependencies)) {
            dependencies.push({
              name,
              version: version as string,
              type: 'devDependency',
              packageJsonPath: file.path,
            });
          }
        }

        // Extract peerDependencies
        if (pkg.peerDependencies) {
          for (const [name, version] of Object.entries(pkg.peerDependencies)) {
            dependencies.push({
              name,
              version: version as string,
              type: 'peerDependency',
              packageJsonPath: file.path,
            });
          }
        }
      } catch {
        // Skip invalid package.json files
      }
    }

    return dependencies;
  }
}
