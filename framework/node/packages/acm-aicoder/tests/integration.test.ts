// Integration tests for ACM AI Coder
import {
  CodeReadTool,
  CodeEditTool,
  CodeAnalyzeTool,
  AnalyzeCodebaseTask,
  FixBugTask,
  SimpleCapabilityRegistry,
  SimpleToolRegistry,
} from '../src/index.js';
import { MemoryLedger, executePlan } from '@acm/runtime';
import type { Goal, Context, Plan } from '@acm/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Running ACM AI Coder Integration Tests');
console.log('='.repeat(60));

// Test 1: Code Read Tool
async function testCodeReadTool() {
  console.log('Testing CodeReadTool...');
  
  const tool = new CodeReadTool();
  
  // Create a temporary test file
  const testDir = '/tmp/acm-aicoder-test';
  const testFile = path.join(testDir, 'test.ts');
  
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(testFile, `// Test file\nconsole.log('Hello, World!');`);
  
  const result = await tool.call({ path: testFile });
  
  if (!result.content.includes('Test file')) {
    throw new Error('CodeReadTool failed to read file content');
  }
  
  if (result.lines !== 2) {
    throw new Error(`CodeReadTool line count incorrect: expected 2, got ${result.lines}`);
  }
  
  console.log('✅ CodeReadTool test passed');
  
  // Clean up
  await fs.rm(testDir, { recursive: true, force: true });
}

// Test 2: Code Edit Tool
async function testCodeEditTool() {
  console.log('Testing CodeEditTool...');
  
  const tool = new CodeEditTool();
  
  const testDir = '/tmp/acm-aicoder-test';
  const testFile = path.join(testDir, 'edit-test.ts');
  
  await fs.mkdir(testDir, { recursive: true });
  
  const result = await tool.call({
    path: testFile,
    content: '// Edited content\nconsole.log("Modified");',
  });
  
  if (!result.success) {
    throw new Error('CodeEditTool failed to write file');
  }
  
  const content = await fs.readFile(testFile, 'utf-8');
  if (!content.includes('Edited content')) {
    throw new Error('CodeEditTool did not write expected content');
  }
  
  console.log('✅ CodeEditTool test passed');
  
  // Clean up
  await fs.rm(testDir, { recursive: true, force: true });
}

// Test 3: Code Analyze Tool
async function testCodeAnalyzeTool() {
  console.log('Testing CodeAnalyzeTool...');
  
  const tool = new CodeAnalyzeTool();
  
  const testDir = '/tmp/acm-aicoder-test';
  const testFile = path.join(testDir, 'analyze-test.ts');
  
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(
    testFile,
    '// Test\nconsole.log("debug");\n// TODO: fix this\nconst x = 1;'
  );
  
  const result = await tool.call({ path: testFile });
  
  if (result.issues.length < 2) {
    throw new Error('CodeAnalyzeTool should find at least 2 issues');
  }
  
  console.log(`  Found ${result.issues.length} issues`);
  console.log('✅ CodeAnalyzeTool test passed');
  
  // Clean up
  await fs.rm(testDir, { recursive: true, force: true });
}

// Test 4: Analyze Codebase Task
async function testAnalyzeCodebaseTask() {
  console.log('Testing AnalyzeCodebaseTask...');
  
  // Create test directory structure
  const testDir = '/tmp/acm-aicoder-test/codebase';
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(path.join(testDir, 'file1.ts'), 'console.log("test");');
  await fs.writeFile(path.join(testDir, 'file2.ts'), '// TODO: implement');
  
  const goal: Goal = {
    id: 'test-analyze',
    intent: 'Analyze test codebase',
  };
  
  const context: Context = {
    id: 'test-ctx',
    facts: { path: testDir },
    version: '1.0',
  };
  
  const plan: Plan = {
    id: 'test-plan',
    contextRef: 'test-ref',
    capabilityMapVersion: '1.0',
    tasks: [
      {
        id: 't1',
        capability: 'analyze_codebase',
        input: { path: testDir },
      },
    ],
    edges: [],
  };
  
  const toolRegistry = new SimpleToolRegistry();
  toolRegistry.register(new CodeReadTool());
  toolRegistry.register(new CodeAnalyzeTool());
  
  const capabilityRegistry = new SimpleCapabilityRegistry();
  capabilityRegistry.register(
    { name: 'analyze_codebase', sideEffects: false },
    new AnalyzeCodebaseTask()
  );
  
  const ledger = new MemoryLedger();
  
  const result = await executePlan({
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
    ledger,
  });
  
  if (!result.outputsByTask.t1) {
    throw new Error('Task did not produce output');
  }
  
  if (result.outputsByTask.t1.files < 1) {
    throw new Error('Task should find at least 1 file');
  }
  
  console.log(`  Analyzed ${result.outputsByTask.t1.files} files`);
  console.log('✅ AnalyzeCodebaseTask test passed');
  
  // Clean up
  await fs.rm('/tmp/acm-aicoder-test', { recursive: true, force: true });
}

// Test 5: Fix Bug Task (dry run)
async function testFixBugTask() {
  console.log('Testing FixBugTask (dry run)...');
  
  const testDir = '/tmp/acm-aicoder-test';
  const testFile = path.join(testDir, 'bug.ts');
  
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(testFile, 'console.log("debug statement");');
  
  const goal: Goal = {
    id: 'test-fix',
    intent: 'Fix bug in test file',
  };
  
  const context: Context = {
    id: 'test-ctx',
    facts: { path: testFile, bugDescription: 'Remove console.log' },
    version: '1.0',
  };
  
  const plan: Plan = {
    id: 'test-plan',
    contextRef: 'test-ref',
    capabilityMapVersion: '1.0',
    tasks: [
      {
        id: 't1',
        capability: 'fix_bug',
        input: {
          path: testFile,
          bugDescription: 'Remove console.log',
          dryRun: true,
        },
      },
    ],
    edges: [],
  };
  
  const toolRegistry = new SimpleToolRegistry();
  toolRegistry.register(new CodeReadTool());
  toolRegistry.register(new CodeEditTool());
  
  const capabilityRegistry = new SimpleCapabilityRegistry();
  capabilityRegistry.register(
    { name: 'fix_bug', sideEffects: true },
    new FixBugTask()
  );
  
  const ledger = new MemoryLedger();
  
  const result = await executePlan({
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
    ledger,
  });
  
  if (!result.outputsByTask.t1) {
    throw new Error('Task did not produce output');
  }
  
  console.log('✅ FixBugTask test passed');
  
  // Clean up
  await fs.rm(testDir, { recursive: true, force: true });
}

// Run all tests
async function runTests() {
  try {
    await testCodeReadTool();
    await testCodeEditTool();
    await testCodeAnalyzeTool();
    await testAnalyzeCodebaseTask();
    await testFixBugTask();
    
    console.log('='.repeat(60));
    console.log('Results: All tests passed! ✅');
  } catch (error: any) {
    console.log('='.repeat(60));
    console.log(`Results: Test failed ❌`);
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

runTests();
