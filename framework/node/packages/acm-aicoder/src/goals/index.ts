// AI Coder Goals and Contexts
import type { Goal, Context } from '@acm/sdk';

export const goals = {
  analyze: {
    id: 'goal-analyze-1',
    intent: 'Analyze the codebase and provide a comprehensive summary',
    constraints: {
      maxDepth: 3,
      includeIssues: true,
    },
  } as Goal,

  fixBug: {
    id: 'goal-fix-bug-1',
    intent: 'Analyze and fix a bug in the specified file',
    constraints: {
      requireTests: true,
      createBackup: true,
    },
  } as Goal,

  implementFeature: {
    id: 'goal-implement-feature-1',
    intent: 'Implement a new feature with proper scaffolding and tests',
    constraints: {
      generateTests: true,
      followConventions: true,
    },
  } as Goal,

  runTests: {
    id: 'goal-run-tests-1',
    intent: 'Run the test suite and report results',
    constraints: {
      timeout: 300,
      captureOutput: true,
    },
  } as Goal,
};

export const contexts = {
  analyze: {
    id: 'ctx-analyze-1',
    facts: {
      path: './src',
      depth: 2,
      includeTests: true,
    },
    version: '1.0',
  } as Context,

  fixBug: {
    id: 'ctx-fix-bug-1',
    facts: {
      path: './src/index.ts',
      bugDescription: 'Remove debug console.log statements',
      runTests: true,
    },
    version: '1.0',
  } as Context,

  implementFeature: {
    id: 'ctx-implement-feature-1',
    facts: {
      description: 'Add user authentication',
      targetPath: './src/auth.ts',
      includeTests: true,
    },
    version: '1.0',
  } as Context,

  runTests: {
    id: 'ctx-run-tests-1',
    facts: {
      command: 'npm test',
      cwd: './',
    },
    version: '1.0',
  } as Context,
};
