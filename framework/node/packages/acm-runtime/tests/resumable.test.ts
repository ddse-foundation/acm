// Test for resumable executor
import {
  executeResumablePlan,
  MemoryCheckpointStore,
  ResumableExecutor,
  MemoryLedger,
} from '../src/index.js';
import type { Goal, Context, Plan, CapabilityRegistry, ToolRegistry, RunContext } from '@acm/sdk';
import { Task } from '@acm/sdk';

// Simple test capability
class TestTask extends Task {
  constructor() {
    super('test-task', 'test');
  }

  async execute(ctx: RunContext, input: any): Promise<any> {
    return { result: `executed-${input?.value || 'default'}` };
  }
}

// Simple registries
class SimpleCapabilityRegistry implements CapabilityRegistry {
  private tasks = new Map<string, Task>();

  register(capability: any, task: Task): void {
    this.tasks.set(capability.name, task);
  }

  resolve(capability: string): Task | undefined {
    return this.tasks.get(capability);
  }

  list(): any[] {
    return Array.from(this.tasks.keys()).map(name => ({ name }));
  }

  has(name: string): boolean {
    return this.tasks.has(name);
  }

  inputSchema(name: string): unknown {
    return undefined;
  }

  outputSchema(name: string): unknown {
    return undefined;
  }
}

class SimpleToolRegistry implements ToolRegistry {
  get(name: string): any {
    return null;
  }

  list(): any[] {
    return [];
  }
}

async function testBasicCheckpoint() {
  console.log('Testing basic checkpoint creation...');

  const goal: Goal = {
    id: 'test-goal',
    intent: 'Test checkpoint creation',
  };

  const context: Context = {
    id: 'test-context',
    facts: { test: true },
  };

  const plan: Plan = {
    id: 'test-plan',
    contextRef: 'test-ref',
    capabilityMapVersion: '1.0',
    tasks: [
      {
        id: 't1',
        capability: 'test',
        input: { value: 'task1' },
      },
      {
        id: 't2',
        capability: 'test',
        input: { value: 'task2' },
      },
    ],
    edges: [
      { from: 't1', to: 't2' },
    ],
  };

  const capabilityRegistry = new SimpleCapabilityRegistry();
  capabilityRegistry.register({ name: 'test' }, new TestTask());

  const toolRegistry = new SimpleToolRegistry();
  const checkpointStore = new MemoryCheckpointStore();
  const ledger = new MemoryLedger();
  const runId = 'test-run-1';

  const result = await executeResumablePlan({
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
    ledger,
    runId,
    checkpointStore,
    checkpointInterval: 1,
  });

  // Verify execution completed
  if (!result.outputsByTask.t1 || !result.outputsByTask.t2) {
    throw new Error('Tasks not executed');
  }

  // Verify checkpoints were created
  const checkpoints = await checkpointStore.list(runId);
  if (checkpoints.length < 2) {
    throw new Error(`Expected at least 2 checkpoints, got ${checkpoints.length}`);
  }

  console.log('✅ Basic checkpoint test passed');
  console.log(`   Created ${checkpoints.length} checkpoints`);
}

async function testResume() {
  console.log('Testing resume from checkpoint...');

  const goal: Goal = {
    id: 'test-goal-resume',
    intent: 'Test resume functionality',
  };

  const context: Context = {
    id: 'test-context-resume',
    facts: { test: true },
  };

  const plan: Plan = {
    id: 'test-plan-resume',
    contextRef: 'test-ref-resume',
    capabilityMapVersion: '1.0',
    tasks: [
      {
        id: 't1',
        capability: 'test',
        input: { value: 'task1' },
      },
      {
        id: 't2',
        capability: 'test',
        input: { value: 'task2' },
      },
      {
        id: 't3',
        capability: 'test',
        input: { value: 'task3' },
      },
    ],
    edges: [
      { from: 't1', to: 't2' },
      { from: 't2', to: 't3' },
    ],
  };

  const capabilityRegistry = new SimpleCapabilityRegistry();
  capabilityRegistry.register({ name: 'test' }, new TestTask());

  const toolRegistry = new SimpleToolRegistry();
  const checkpointStore = new MemoryCheckpointStore();
  const ledger1 = new MemoryLedger();
  const runId = 'test-run-resume';

  // First execution - execute first 2 tasks
  const result1 = await executeResumablePlan({
    goal,
    context,
    plan: {
      ...plan,
      // Simulate interruption by only including first 2 tasks
      tasks: plan.tasks.slice(0, 2),
      edges: [{ from: 't1', to: 't2' }],
    },
    capabilityRegistry,
    toolRegistry,
    ledger: ledger1,
    runId,
    checkpointStore,
    checkpointInterval: 1,
  });

  // Get the latest checkpoint
  const checkpoint = await checkpointStore.get(runId);
  if (!checkpoint) {
    throw new Error('No checkpoint found');
  }

  console.log(`   First execution completed, checkpoint: ${checkpoint.id}`);

  // Resume from checkpoint
  const ledger2 = new MemoryLedger();
  const result2 = await executeResumablePlan({
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
    ledger: ledger2,
    runId,
    checkpointStore,
    resumeFrom: checkpoint.id,
    checkpointInterval: 1,
  });

  // Verify all tasks completed
  if (!result2.outputsByTask.t1 || !result2.outputsByTask.t2 || !result2.outputsByTask.t3) {
    throw new Error('Not all tasks executed after resume');
  }

  // Verify t1 and t2 outputs match (were restored from checkpoint)
  if (result2.outputsByTask.t1.result !== 'executed-task1') {
    throw new Error('Task 1 output not restored correctly');
  }

  if (result2.outputsByTask.t2.result !== 'executed-task2') {
    throw new Error('Task 2 output not restored correctly');
  }

  console.log('✅ Resume test passed');
  console.log(`   Successfully resumed and completed task 3`);
}

async function testResumableExecutor() {
  console.log('Testing ResumableExecutor class...');

  const executor = new ResumableExecutor();

  const goal: Goal = {
    id: 'test-goal-executor',
    intent: 'Test ResumableExecutor',
  };

  const context: Context = {
    id: 'test-context-executor',
    facts: { test: true },
  };

  const plan: Plan = {
    id: 'test-plan-executor',
    contextRef: 'test-ref-executor',
    capabilityMapVersion: '1.0',
    tasks: [
      {
        id: 't1',
        capability: 'test',
        input: { value: 'task1' },
      },
    ],
    edges: [],
  };

  const capabilityRegistry = new SimpleCapabilityRegistry();
  capabilityRegistry.register({ name: 'test' }, new TestTask());

  const toolRegistry = new SimpleToolRegistry();
  const runId = 'test-run-executor';

  const result = await executor.execute({
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
    runId,
    checkpointInterval: 1,
  });

  // Verify execution completed
  if (!result.outputsByTask.t1) {
    throw new Error('Task not executed');
  }

  // List checkpoints
  const checkpoints = await executor.listCheckpoints(runId);
  if (checkpoints.length < 1) {
    throw new Error('No checkpoints created');
  }

  console.log('✅ ResumableExecutor test passed');
}

async function runTests() {
  console.log('Running Resumable Executor Tests');
  console.log('==================================================');

  let passed = 0;
  let failed = 0;

  try {
    await testBasicCheckpoint();
    passed++;
  } catch (err) {
    console.error('❌ Basic checkpoint test failed:', err);
    failed++;
  }

  try {
    await testResume();
    passed++;
  } catch (err) {
    console.error('❌ Resume test failed:', err);
    failed++;
  }

  try {
    await testResumableExecutor();
    passed++;
  } catch (err) {
    console.error('❌ ResumableExecutor test failed:', err);
    failed++;
  }

  console.log('==================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
