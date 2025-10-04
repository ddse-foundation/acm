// Integration tests for ACM AI Coder (Phase 2)
import {
  FileReadToolV2,
  FileReadLinesTool,
  FileStatTool,
  CodeEditToolV2,
  DiffTool,
  AnalyzeWorkspaceTask,
  GenerateUnitTestsTask,
  SimpleCapabilityRegistry,
  SimpleToolRegistry,
} from '../src/index.js';
import { MemoryLedger, executePlan } from '@acm/runtime';
import {
  Nucleus,
  type Context,
  type Goal,
  type Plan,
  type LedgerEntry,
  type NucleusConfig,
  type NucleusFactory,
  type NucleusInvokeResult,
  type PostcheckResult,
  type PreflightResult,
  type InternalContextScope,
} from '@acm/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';

console.log('Running ACM AI Coder Integration Tests (Phase 2)');
console.log('='.repeat(60));

const TEMP_ROOT = '/tmp/acm-aicoder-test';

async function cleanup() {
  await fs.rm(TEMP_ROOT, { recursive: true, force: true });
}

class TestNucleus extends Nucleus {
  private scope?: InternalContextScope;

  constructor(config: NucleusConfig) {
    super(config);
  }

  async preflight(): Promise<PreflightResult> {
    return { status: 'OK' };
  }

  async invoke(): Promise<NucleusInvokeResult> {
    return { toolCalls: [] };
  }

  async postcheck(): Promise<PostcheckResult> {
    return { status: 'COMPLETE' };
  }

  recordInference(promptDigest: string): LedgerEntry {
    return {
      id: `test-nucleus-${Date.now()}`,
      ts: Date.now(),
      type: 'NUCLEUS_INFERENCE',
      details: { promptDigest },
    };
  }

  getInternalContext(): InternalContextScope | undefined {
    return this.scope;
  }

  setInternalContext(scope: InternalContextScope): void {
    this.scope = scope;
  }
}

const testNucleusFactory: NucleusFactory = config => new TestNucleus(config);

const nucleusConfig: { llmCall: NucleusConfig['llmCall'] } = {
  llmCall: {
    provider: 'test',
    model: 'stub',
  },
};

// Test 1: FileReadToolV2 + FileStatTool
async function testFileReadToolV2(): Promise<void> {
  console.log('Testing FileReadToolV2 and FileStatTool...');

  const dir = path.join(TEMP_ROOT, 'read');
  const filePath = path.join(dir, 'sample.ts');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, "export const hello = () => 'world';\n");

  const statTool = new FileStatTool();
  const stat = await statTool.call({ path: filePath });
  if (!stat.exists || stat.size === 0) {
    throw new Error('FileStatTool failed to report existing file');
  }

  const readTool = new FileReadToolV2();
  const result = await readTool.call({ path: filePath });

  if (!result.content.includes('hello = () =>')) {
    throw new Error('FileReadToolV2 failed to read file content');
  }

  if (!result.eof) {
    throw new Error('FileReadToolV2 should reach EOF for small file');
  }

  console.log('✅ FileReadToolV2 test passed');
}

// Test 2: CodeEditToolV2 writes content (with backup)
async function testCodeEditToolV2(): Promise<void> {
  console.log('Testing CodeEditToolV2...');

  const dir = path.join(TEMP_ROOT, 'edit');
  const filePath = path.join(dir, 'edit.ts');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, '// original\n');

  const tool = new CodeEditToolV2();
  const response = await tool.call({
    path: filePath,
    content: '// updated\nexport const value = 42;\n',
    backup: true,
  });

  if (!response.success) {
    throw new Error('CodeEditToolV2 did not report success');
  }

  const updated = await fs.readFile(filePath, 'utf-8');
  if (!updated.includes('value = 42')) {
    throw new Error('CodeEditToolV2 did not write expected content');
  }

  if (!response.backupPath) {
    throw new Error('CodeEditToolV2 should create a backup when requested');
  }

  console.log('✅ CodeEditToolV2 test passed');
}

// Test 3: DiffTool generates a diff
async function testDiffTool(): Promise<void> {
  console.log('Testing DiffTool...');

  const diffTool = new DiffTool();
  const diff = await diffTool.call({
    aContent: 'const a = 1;\n',
    bContent: 'const a = 2;\n',
  });

  if (!diff.diff.includes('---') || !diff.diff.includes('+++')) {
    throw new Error('DiffTool output missing headers');
  }

  console.log('✅ DiffTool test passed');
}

// Test 4: AnalyzeWorkspaceTask over small project
async function testAnalyzeWorkspaceTask(): Promise<void> {
  console.log('Testing AnalyzeWorkspaceTask...');

  const workspace = path.join(TEMP_ROOT, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  await fs.writeFile(path.join(workspace, 'file1.ts'), 'export const foo = 1;\n');
  await fs.writeFile(path.join(workspace, 'file2.ts'), '// TODO: implement\n');

  const goal: Goal = {
    id: 'goal-analyze',
    intent: 'Analyze the workspace',
  };

  const context: Context = {
    id: 'ctx-analyze',
    facts: { path: workspace },
    version: '1.0',
  };

  const plan: Plan = {
    id: 'plan-analyze',
    contextRef: 'ref-analyze',
    capabilityMapVersion: '1.0',
    tasks: [
      {
        id: 't1',
        capability: 'analyze_workspace',
        input: { path: workspace },
      },
    ],
    edges: [],
  };

  const capabilityRegistry = new SimpleCapabilityRegistry();
  capabilityRegistry.register(
    { name: 'analyze_workspace', sideEffects: false },
    new AnalyzeWorkspaceTask()
  );

  const toolRegistry = new SimpleToolRegistry();

  const ledger = new MemoryLedger();
  const result = await executePlan({
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
    ledger,
    nucleusFactory: testNucleusFactory,
    nucleusConfig,
  });

  const output = result.outputsByTask.t1;
  if (!output || output.totalFiles < 2) {
    throw new Error('AnalyzeWorkspaceTask should report indexed files');
  }

  console.log('✅ AnalyzeWorkspaceTask test passed');
}

// Test 5: GenerateUnitTestsTask writes scaffold
async function testGenerateUnitTestsTask(): Promise<void> {
  console.log('Testing GenerateUnitTestsTask...');

  const workspace = path.join(TEMP_ROOT, 'unit-tests');
  const sourceFile = path.join(workspace, 'src', 'thing.ts');
  await fs.mkdir(path.dirname(sourceFile), { recursive: true });
  await fs.writeFile(sourceFile, 'export function thing() { return 1; }\n');

  const goal: Goal = {
    id: 'goal-tests',
    intent: 'Generate tests for thing',
  };

  const context: Context = {
    id: 'ctx-tests',
    facts: { path: workspace },
    version: '1.0',
  };

  const plan: Plan = {
    id: 'plan-tests',
    contextRef: 'ref-tests',
    capabilityMapVersion: '1.0',
    tasks: [
      {
        id: 't1',
        capability: 'generate_unit_tests',
        input: {
          targetPath: sourceFile,
          symbolName: 'thing',
        },
      },
    ],
    edges: [],
  };

  const capabilityRegistry = new SimpleCapabilityRegistry();
  capabilityRegistry.register(
    { name: 'generate_unit_tests', sideEffects: true },
    new GenerateUnitTestsTask()
  );

  const toolRegistry = new SimpleToolRegistry();
  toolRegistry.register(new FileReadLinesTool());
  toolRegistry.register(new CodeEditToolV2());

  const ledger = new MemoryLedger();
  const result = await executePlan({
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
    ledger,
    nucleusFactory: testNucleusFactory,
    nucleusConfig,
  });

  const output = result.outputsByTask.t1;
  if (!output || !output.implemented) {
    throw new Error('GenerateUnitTestsTask should implement tests');
  }

  const generated = await fs.readFile(output.testPath, 'utf-8');
  if (!generated.includes('describe')) {
    throw new Error('Generated test file missing scaffold');
  }

  console.log('✅ GenerateUnitTestsTask test passed');
}

// Run all tests sequentially
async function runTests(): Promise<void> {
  try {
    await cleanup();
    await testFileReadToolV2();
    await testCodeEditToolV2();
    await testDiffTool();
    await testAnalyzeWorkspaceTask();
    await testGenerateUnitTestsTask();

    console.log('='.repeat(60));
    console.log('Results: All tests passed! ✅');
  } catch (error: any) {
    console.log('='.repeat(60));
    console.log('Results: Test failed ❌');
    console.error(error?.message ?? error);
    if (error?.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await cleanup();
  }
}

runTests();
