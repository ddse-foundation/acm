# Testing Guide

This document describes the testing infrastructure and how to write tests for ACM.

## Running Tests

### All Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @ddse/acm-examples test

# Run specific test suite
pnpm --filter @ddse/acm-examples test:bm25
```

### Individual Test Files

```bash
# Run a specific test file
cd packages/acm-examples
node dist/tests/bm25.test.js
node dist/tests/integration.test.js
```

## Test Structure

### Unit Tests

Unit tests focus on individual components in isolation. Example: BM25 search tests.

```typescript
// tests/bm25.test.ts
import { BM25Search } from '../src/search/bm25.js';

async function testIndexAndSearch() {
  console.log('Testing index and search...');
  
  const documents = [
    { id: 'doc1', content: 'Test content' },
  ];

  const search = new BM25Search();
  search.index(documents);

  const results = search.search('test');
  
  if (results.length === 0) {
    throw new Error('Expected results, got none');
  }
  
  console.log('✅ Index and search test passed');
}

async function runTests() {
  const tests = [testIndexAndSearch];
  
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

  console.log(`Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}
```

### Integration Tests

Integration tests verify that components work together correctly.

```typescript
// tests/integration.test.ts
import { executePlan } from '@ddse/acm-runtime';
import { SimpleCapabilityRegistry, SimpleToolRegistry } from '../src/registries.js';

async function testBasicExecution() {
  console.log('Testing basic ACM execution...');

  // Setup
  const toolRegistry = new SimpleToolRegistry();
  const capabilityRegistry = new SimpleCapabilityRegistry();
  
  // ... register tools and capabilities

  // Execute
  const result = await executePlan({
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
  });

  // Verify
  const task = result.outputsByTask['t1'];
  if (!task || task.output === undefined) {
    throw new Error('Task output not found');
  }

  console.log('✅ Basic execution test passed');
  return true;
}
```

## Writing New Tests

### 1. Create Test File

Create a new file in `packages/[package]/tests/`:

```typescript
// tests/my-feature.test.ts
async function testMyFeature() {
  console.log('Testing my feature...');
  
  // Setup
  // ...
  
  // Execute
  // ...
  
  // Verify
  if (/* condition */) {
    throw new Error('Test failed: reason');
  }
  
  console.log('✅ My feature test passed');
}

async function runTests() {
  const tests = [testMyFeature];
  
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

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}
```

### 2. Add to package.json

```json
{
  "scripts": {
    "test:myfeature": "node ./dist/tests/my-feature.test.js"
  }
}
```

### 3. Include in Build

Ensure `tests/**/*` is included in `tsconfig.json`:

```json
{
  "include": ["bin/**/*", "src/**/*", "tests/**/*"]
}
```

## Test Patterns

### Testing Tools

```typescript
async function testSearchTool() {
  const tool = new SearchTool();
  
  const result = await tool.call({ query: 'test query' });
  
  if (!result.results || result.results.length === 0) {
    throw new Error('Search returned no results');
  }
  
  console.log('✅ Search tool test passed');
}
```

### Testing Tasks

```typescript
async function testMyTask() {
  const task = new MyTask();
  
  const mockContext = {
    goal: { id: 'g1', intent: 'test' },
    context: { id: 'ctx1', facts: {} },
    outputs: {},
    metrics: { costUsd: 0, elapsedSec: 0 },
    getTool: (name) => mockToolRegistry.get(name),
    getCapabilityRegistry: () => mockCapabilityRegistry,
  };
  
  const result = await task.execute(mockContext, { input: 'test' });
  
  if (!result.output) {
    throw new Error('Task did not produce output');
  }
  
  console.log('✅ Task test passed');
}
```

### Testing Execution

```typescript
async function testPlanExecution() {
  const result = await executePlan({
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
    ledger: new MemoryLedger(),
  });
  
  // Verify outputs
  const task = result.outputsByTask['t1'];
  if (!task || task.output === undefined) {
    throw new Error('Task t1 did not execute');
  }
  
  // Verify ledger
  if (result.ledger.length === 0) {
    throw new Error('Ledger is empty');
  }
  
  console.log('✅ Execution test passed');
}
```

### Testing with MCP

```typescript
async function testMCPIntegration() {
  const manager = new McpClientManager();
  
  try {
    await manager.connect({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    });
    
    if (!manager.isConnected()) {
      throw new Error('Failed to connect to MCP server');
    }
    
    const registry = new McpToolRegistry(manager);
    const tools = registry.list();
    
    if (tools.length === 0) {
      throw new Error('No MCP tools discovered');
    }
    
    console.log('✅ MCP integration test passed');
  } finally {
    await manager.disconnect();
  }
}
```

### Testing Adapters

```typescript
async function testLangGraphAdapter() {
  const adapter = asLangGraph({
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
    ledger: new MemoryLedger(),
  });
  
  const result = await adapter.execute();
  
  if (!result.outputsByTask) {
    throw new Error('Adapter did not produce outputs');
  }
  
  console.log('✅ LangGraph adapter test passed');
}
```

### Testing Replay Bundles

```typescript
async function testReplayBundle() {
  // Export
  const bundlePath = await ReplayBundleExporter.export({
    outputDir: '/tmp/test-bundle',
    goal,
    context,
    plans: [plan],
    selectedPlanId: plan.id,
    ledger: [],
    taskIO: [],
  });
  
  // Validate
  const validation = await ReplayBundleExporter.validate(bundlePath);
  if (!validation.valid) {
    throw new Error(`Bundle invalid: ${validation.errors.join(', ')}`);
  }
  
  // Load
  const bundle = await ReplayBundleExporter.load(bundlePath);
  if (bundle.goal.id !== goal.id) {
    throw new Error('Loaded bundle has wrong goal');
  }
  
  console.log('✅ Replay bundle test passed');
}
```

## Test Data

### Using Synthetic Data

The examples package includes synthetic data for testing:

- `data/documents.json`: Sample documents
- `data/orders.json`: Sample orders
- `data/issues.json`: Sample issues

```typescript
import * as fs from 'fs/promises';

async function loadTestData() {
  const documents = JSON.parse(
    await fs.readFile('./data/documents.json', 'utf-8')
  );
  
  return documents;
}
```

### Creating Mock Objects

```typescript
// Mock tool registry
const mockToolRegistry = {
  get(name: string) {
    return {
      name: () => name,
      call: async (input: any) => ({ result: 'mock' }),
    };
  },
  list() {
    return ['tool1', 'tool2'];
  },
};

// Mock capability registry
const mockCapabilityRegistry = {
  resolve(name: string) {
    return mockTask;
  },
  list() {
    return [{ name: 'capability1' }];
  },
};
```

## Best Practices

1. **Isolate Tests**: Each test should be independent and not rely on others

2. **Use Descriptive Names**: Test function names should clearly describe what is being tested

3. **Test Edge Cases**: Include tests for error conditions and boundary cases

4. **Keep Tests Simple**: Tests should be easy to understand and maintain

5. **Use Mock Data**: Create minimal test data needed for each test

6. **Clean Up Resources**: Always clean up (e.g., disconnect MCP, remove temp files)

7. **Assert Early**: Fail fast when conditions are not met

8. **Log Progress**: Use console.log to show test progress

9. **Return Boolean**: Test runners should return `true` for success, `false` for failure

## Continuous Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test
```

## Troubleshooting

**Tests not found**: Ensure test files are included in tsconfig.json and built

**Import errors**: Check that all dependencies are properly installed

**Async errors**: Make sure to await all async operations

**File path errors**: Use absolute paths or paths relative to the test file

**MCP connection issues**: Check that MCP server commands are correct

## Future Enhancements

- Integration with Jest or Mocha
- Code coverage reporting
- Performance benchmarking
- Visual test reports
- Automated test generation
