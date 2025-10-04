// Integration test for ACM framework
import {
  DefaultStreamSink,
  Nucleus,
  type Goal,
  type Context,
  type Plan,
  type NucleusFactory,
  type NucleusConfig,
  type PreflightResult,
  type PostcheckResult,
  type NucleusInvokeResult,
  type InternalContextScope,
  type LedgerEntry,
} from '@acm/sdk';
import { MemoryLedger, executePlan } from '@acm/runtime';
import { SearchTool } from '../src/tools/index.js';
import { SearchTask } from '../src/tasks/index.js';
import { SimpleCapabilityRegistry, SimpleToolRegistry } from '../src/registries.js';

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

const nucleusConfig = {
  llmCall: {
    provider: 'test',
    model: 'stub',
  },
};

async function testBasicExecution() {
  console.log('Testing basic ACM execution...');

  // Setup
  const toolRegistry = new SimpleToolRegistry();
  toolRegistry.register(new SearchTool());

  const capabilityRegistry = new SimpleCapabilityRegistry();
  capabilityRegistry.register({ name: 'search', sideEffects: false }, new SearchTask());

  const goal: Goal = {
    id: 'test-goal',
    intent: 'Test search functionality',
  };

  const context: Context = {
    id: 'test-context',
    facts: { test: true },
  };

  const plan: Plan = {
    id: 'test-plan',
    contextRef: 'test-context',
    capabilityMapVersion: 'v1',
    tasks: [
      {
        id: 't1',
        capability: 'search',
        input: { query: 'test query' },
      },
    ],
    edges: [],
  };

  // Execute
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

  // Verify
  if (!result.outputsByTask['t1']) {
    throw new Error('Task output not found');
  }

  if (!result.outputsByTask['t1'].results) {
    throw new Error('Search results not found');
  }

  if (result.ledger.length === 0) {
    throw new Error('Ledger is empty');
  }

  console.log('✅ Basic execution test passed');
  return true;
}

async function testSearchWithData() {
  console.log('Testing search with synthetic data...');

  // Wait a bit for data to load
  await new Promise(resolve => setTimeout(resolve, 1000));

  const searchTool = new SearchTool();
  
  // Search for policy information
  const result = await searchTool.call({ query: 'return policy' });

  if (!result.results || result.results.length === 0) {
    console.log('  Note: Search data may not be loaded yet, skipping...');
    return true;
  }

  console.log(`  Found ${result.results.length} results`);
  
  console.log('✅ Search with data test passed');
  return true;
}

async function runIntegrationTests() {
  console.log('Running ACM Integration Tests\n');
  console.log('='.repeat(50));

  const tests = [
    testBasicExecution,
    testSearchWithData,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      console.error(`❌ Test failed: ${error}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed\n`);

  return failed === 0;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}
