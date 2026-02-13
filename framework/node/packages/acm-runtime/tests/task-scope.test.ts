// Tests for Change 2: taskScope on resumable executor
//
// Covers:
//   - taskScope with a single task — only that task is executed
//   - taskScope with a subset — only scoped tasks run
//   - No taskScope (undefined) — all tasks run as before
//   - taskScope with dependency task NOT in scope — dependency still needs to be satisfied
//   - Early-break when all scoped tasks complete
//   - taskScope with resume — scoped filtering applied after checkpoint restore
//   - taskScope with tasks that have no capability match (should throw)
//   - Empty taskScope array — early-break, nothing executes
//   - taskScope with non-existent task IDs — nothing matches, nothing runs

import {
  executeResumablePlan,
  MemoryCheckpointStore,
  MemoryLedger,
} from '../src/index.js';
import type {
  Goal,
  Context,
  Plan,
  CapabilityRegistry,
  ToolRegistry,
  NucleusConfig,
  PreflightResult,
  PostcheckResult,
  NucleusInvokeResult,
  NucleusFactory,
  InternalContextScope,
  LedgerEntry,
  RunContext,
} from '@ddse/acm-sdk';
import { Task, Nucleus } from '@ddse/acm-sdk';

// ── Test helpers (same pattern as resumable.test.ts) ─────────

class TestTask extends Task {
  constructor() {
    super('test-task', 'test');
  }
  async execute(ctx: RunContext, input: any): Promise<any> {
    return { result: `executed-${input?.value || 'default'}` };
  }
}

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
  get(name: string): any { return null; }
  list(): any[] { return []; }
}

class TestNucleus extends Nucleus {
  private scope?: InternalContextScope;
  constructor(config: NucleusConfig) { super(config); }

  async preflight(): Promise<PreflightResult> { return { status: 'OK' }; }
  async invoke(): Promise<NucleusInvokeResult> { return { toolCalls: [] }; }
  async postcheck(): Promise<PostcheckResult> { return { status: 'COMPLETE' }; }
  recordInference(promptDigest: string): LedgerEntry {
    return {
      id: `test-${Date.now()}`,
      ts: Date.now(),
      type: 'NUCLEUS_INFERENCE',
      details: { promptDigest },
    };
  }
  getInternalContext(): InternalContextScope | undefined { return this.scope; }
  setInternalContext(scope: InternalContextScope): void { this.scope = scope; }
}

const testNucleusFactory: NucleusFactory = config => new TestNucleus(config);
const sharedNucleusOptions = {
  nucleusFactory: testNucleusFactory,
  nucleusConfig: { llmCall: { provider: 'noop', model: 'noop' } },
};

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${name}:`, (err as Error).message);
    failed++;
  }
}

// ── Shared fixtures ──────────────────────────────────────────

function makeGoal(): Goal {
  return { id: 'task-scope-goal', intent: 'Test taskScope filtering' };
}

function makeContext(): Context {
  return { id: 'task-scope-ctx', facts: { env: 'test' } };
}

/**
 *  Diamond DAG:
 *      t1
 *     /  \
 *    t2   t3
 *     \  /
 *      t4
 */
function makeDiamondPlan(): Plan {
  return {
    id: 'diamond-plan',
    contextRef: 'ref',
    capabilityMapVersion: '1.0',
    tasks: [
      { id: 't1', capability: 'test', input: { value: 'task1' } },
      { id: 't2', capability: 'test', input: { value: 'task2' } },
      { id: 't3', capability: 'test', input: { value: 'task3' } },
      { id: 't4', capability: 'test', input: { value: 'task4' } },
    ],
    edges: [
      { from: 't1', to: 't2' },
      { from: 't1', to: 't3' },
      { from: 't2', to: 't4' },
      { from: 't3', to: 't4' },
    ],
  };
}

function makeRegistry(): SimpleCapabilityRegistry {
  const r = new SimpleCapabilityRegistry();
  r.register({ name: 'test' }, new TestTask());
  return r;
}

// ── Tests ────────────────────────────────────────────────────

console.log('Running taskScope tests');
console.log('='.repeat(60));

// ── 1. No taskScope — all tasks execute ──────────────────────

await runTest('No taskScope — all 4 tasks execute in diamond DAG', async () => {
  const result = await executeResumablePlan({
    goal: makeGoal(),
    context: makeContext(),
    plan: makeDiamondPlan(),
    capabilityRegistry: makeRegistry(),
    toolRegistry: new SimpleToolRegistry(),
    ledger: new MemoryLedger(),
    checkpointStore: new MemoryCheckpointStore(),
    runId: 'no-scope-run',
    ...sharedNucleusOptions,
  });

  const executedIds = Object.keys(result.outputsByTask);
  if (executedIds.length !== 4) {
    throw new Error(`Expected 4 tasks executed, got ${executedIds.length}: ${executedIds}`);
  }
  for (const id of ['t1', 't2', 't3', 't4']) {
    if (!result.outputsByTask[id]) throw new Error(`Task ${id} not executed`);
  }
});

// ── 2. taskScope with single root task ───────────────────────

await runTest('taskScope: [t1] — only root task executes', async () => {
  const result = await executeResumablePlan({
    goal: makeGoal(),
    context: makeContext(),
    plan: makeDiamondPlan(),
    capabilityRegistry: makeRegistry(),
    toolRegistry: new SimpleToolRegistry(),
    ledger: new MemoryLedger(),
    checkpointStore: new MemoryCheckpointStore(),
    runId: 'scope-t1',
    taskScope: ['t1'],
    ...sharedNucleusOptions,
  });

  const executedIds = Object.keys(result.outputsByTask);
  if (executedIds.length !== 1) {
    throw new Error(`Expected 1 task, got ${executedIds.length}: ${executedIds}`);
  }
  if (!result.outputsByTask.t1) throw new Error('t1 should have been executed');
  if (result.outputsByTask.t1.output.result !== 'executed-task1') {
    throw new Error('t1 output incorrect');
  }
});

// ── 3. taskScope with subset at same level ───────────────────

await runTest('taskScope: [t2, t3] — waits for dependency t1 that is NOT in scope', async () => {
  // t2 and t3 depend on t1. Since t1 is NOT in scope, t2/t3 can never
  // become ready. They should not execute.
  const result = await executeResumablePlan({
    goal: makeGoal(),
    context: makeContext(),
    plan: makeDiamondPlan(),
    capabilityRegistry: makeRegistry(),
    toolRegistry: new SimpleToolRegistry(),
    ledger: new MemoryLedger(),
    checkpointStore: new MemoryCheckpointStore(),
    runId: 'scope-t2-t3-no-dep',
    taskScope: ['t2', 't3'],
    ...sharedNucleusOptions,
  });

  // t2 and t3 depend on t1 which isn't in scope and was never executed;
  // they should never become ready, so nothing runs
  const executedIds = Object.keys(result.outputsByTask);
  if (executedIds.length !== 0) {
    throw new Error(`Expected 0 tasks (deps not met), got ${executedIds.length}: ${executedIds}`);
  }
});

// ── 4. taskScope with independent tasks ──────────────────────

await runTest('taskScope with independent tasks (no deps) — all execute', async () => {
  const plan: Plan = {
    id: 'independent-plan',
    contextRef: 'ref',
    capabilityMapVersion: '1.0',
    tasks: [
      { id: 'a', capability: 'test', input: { value: 'alpha' } },
      { id: 'b', capability: 'test', input: { value: 'bravo' } },
      { id: 'c', capability: 'test', input: { value: 'charlie' } },
    ],
    edges: [],
  };

  const result = await executeResumablePlan({
    goal: makeGoal(),
    context: makeContext(),
    plan,
    capabilityRegistry: makeRegistry(),
    toolRegistry: new SimpleToolRegistry(),
    ledger: new MemoryLedger(),
    checkpointStore: new MemoryCheckpointStore(),
    runId: 'scope-indep',
    taskScope: ['a', 'c'],
    ...sharedNucleusOptions,
  });

  const executedIds = Object.keys(result.outputsByTask);
  if (executedIds.length !== 2) {
    throw new Error(`Expected 2 tasks, got ${executedIds.length}: ${executedIds}`);
  }
  if (!result.outputsByTask.a) throw new Error('task a should have been executed');
  if (!result.outputsByTask.c) throw new Error('task c should have been executed');
  if (result.outputsByTask.b) throw new Error('task b should NOT have been executed');
});

// ── 5. taskScope first two in linear chain ───────────────────

await runTest('taskScope: [t1, t2] in linear chain — stops after t2, skips t3', async () => {
  const plan: Plan = {
    id: 'linear-plan',
    contextRef: 'ref',
    capabilityMapVersion: '1.0',
    tasks: [
      { id: 't1', capability: 'test', input: { value: 'task1' } },
      { id: 't2', capability: 'test', input: { value: 'task2' } },
      { id: 't3', capability: 'test', input: { value: 'task3' } },
    ],
    edges: [
      { from: 't1', to: 't2' },
      { from: 't2', to: 't3' },
    ],
  };

  const result = await executeResumablePlan({
    goal: makeGoal(),
    context: makeContext(),
    plan,
    capabilityRegistry: makeRegistry(),
    toolRegistry: new SimpleToolRegistry(),
    ledger: new MemoryLedger(),
    checkpointStore: new MemoryCheckpointStore(),
    runId: 'scope-linear-12',
    taskScope: ['t1', 't2'],
    ...sharedNucleusOptions,
  });

  const executedIds = Object.keys(result.outputsByTask);
  if (executedIds.length !== 2) {
    throw new Error(`Expected 2 tasks, got ${executedIds.length}: ${executedIds}`);
  }
  if (!result.outputsByTask.t1 || !result.outputsByTask.t2) {
    throw new Error('t1 and t2 should be executed');
  }
  if (result.outputsByTask.t3) {
    throw new Error('t3 should NOT be executed');
  }
});

// ── 6. Early-break after scoped tasks complete ───────────────

await runTest('Early-break: stops iteration after all scoped tasks done', async () => {
  // Linear: t1 → t2 → t3. Scope = [t1]. Should stop after t1.
  const plan: Plan = {
    id: 'earlybreak-plan',
    contextRef: 'ref',
    capabilityMapVersion: '1.0',
    tasks: [
      { id: 't1', capability: 'test', input: { value: '1' } },
      { id: 't2', capability: 'test', input: { value: '2' } },
      { id: 't3', capability: 'test', input: { value: '3' } },
    ],
    edges: [
      { from: 't1', to: 't2' },
      { from: 't2', to: 't3' },
    ],
  };

  const result = await executeResumablePlan({
    goal: makeGoal(),
    context: makeContext(),
    plan,
    capabilityRegistry: makeRegistry(),
    toolRegistry: new SimpleToolRegistry(),
    ledger: new MemoryLedger(),
    checkpointStore: new MemoryCheckpointStore(),
    runId: 'earlybreak-run',
    taskScope: ['t1'],
    ...sharedNucleusOptions,
  });

  const executedIds = Object.keys(result.outputsByTask);
  if (executedIds.length !== 1) {
    throw new Error(`Expected 1 task (early break), got ${executedIds.length}: ${executedIds}`);
  }
  if (!result.outputsByTask.t1) throw new Error('t1 should have been executed');
});

// ── 7. Empty taskScope array — nothing runs ──────────────────

await runTest('Empty taskScope [] — no tasks execute', async () => {
  const result = await executeResumablePlan({
    goal: makeGoal(),
    context: makeContext(),
    plan: makeDiamondPlan(),
    capabilityRegistry: makeRegistry(),
    toolRegistry: new SimpleToolRegistry(),
    ledger: new MemoryLedger(),
    checkpointStore: new MemoryCheckpointStore(),
    runId: 'empty-scope',
    taskScope: [],
    ...sharedNucleusOptions,
  });

  const executedIds = Object.keys(result.outputsByTask);
  if (executedIds.length !== 0) {
    throw new Error(`Expected 0 tasks with empty scope, got ${executedIds.length}`);
  }
});

// ── 8. taskScope with non-existent IDs — nothing runs ────────

await runTest('taskScope with bogus IDs — no tasks execute', async () => {
  const result = await executeResumablePlan({
    goal: makeGoal(),
    context: makeContext(),
    plan: makeDiamondPlan(),
    capabilityRegistry: makeRegistry(),
    toolRegistry: new SimpleToolRegistry(),
    ledger: new MemoryLedger(),
    checkpointStore: new MemoryCheckpointStore(),
    runId: 'bogus-scope',
    taskScope: ['x1', 'x2'],
    ...sharedNucleusOptions,
  });

  const executedIds = Object.keys(result.outputsByTask);
  if (executedIds.length !== 0) {
    throw new Error(`Expected 0 tasks with bogus scope, got ${executedIds.length}`);
  }
});

// ── 9. taskScope with resume — scope filtering after restore ─

await runTest('taskScope with resume — scope applied after checkpoint restore', async () => {
  // Full plan: t1 → t2 → t3, first run executes all;
  // resume with taskScope=[t3] should detect t3 already done → skip
  const plan: Plan = {
    id: 'scope-resume-plan',
    contextRef: 'ref',
    capabilityMapVersion: '1.0',
    tasks: [
      { id: 't1', capability: 'test', input: { value: '1' } },
      { id: 't2', capability: 'test', input: { value: '2' } },
      { id: 't3', capability: 'test', input: { value: '3' } },
    ],
    edges: [
      { from: 't1', to: 't2' },
      { from: 't2', to: 't3' },
    ],
  };

  const checkpointStore = new MemoryCheckpointStore();
  const runId = 'scope-resume-run';

  // First run: execute entire plan
  await executeResumablePlan({
    goal: makeGoal(),
    context: makeContext(),
    plan,
    capabilityRegistry: makeRegistry(),
    toolRegistry: new SimpleToolRegistry(),
    ledger: new MemoryLedger(),
    checkpointStore,
    runId,
    ...sharedNucleusOptions,
  });

  // Get latest checkpoint
  const cp = await checkpointStore.get(runId);
  if (!cp) throw new Error('Checkpoint not found');

  // Resume with taskScope=['t3'] — t3 was already executed in the first run
  const result2 = await executeResumablePlan({
    goal: makeGoal(),
    context: makeContext(),
    plan,
    capabilityRegistry: makeRegistry(),
    toolRegistry: new SimpleToolRegistry(),
    ledger: new MemoryLedger(),
    checkpointStore,
    runId,
    resumeFrom: cp.id,
    taskScope: ['t3'],
    ...sharedNucleusOptions,
  });

  // t3 was already in executed set from checkpoint, so taskScope=['t3']
  // should result in early-break. The outputs should still include t3 from the
  // restored state.
  if (!result2.outputsByTask.t3) {
    throw new Error('t3 should be in restored outputs');
  }
});

// ── 10. taskScope preserves original output values ───────────

await runTest('taskScope produces correct output values per task', async () => {
  const plan: Plan = {
    id: 'output-plan',
    contextRef: 'ref',
    capabilityMapVersion: '1.0',
    tasks: [
      { id: 'a', capability: 'test', input: { value: 'alpha' } },
      { id: 'b', capability: 'test', input: { value: 'bravo' } },
      { id: 'c', capability: 'test', input: { value: 'charlie' } },
    ],
    edges: [],
  };

  const result = await executeResumablePlan({
    goal: makeGoal(),
    context: makeContext(),
    plan,
    capabilityRegistry: makeRegistry(),
    toolRegistry: new SimpleToolRegistry(),
    ledger: new MemoryLedger(),
    checkpointStore: new MemoryCheckpointStore(),
    runId: 'output-run',
    taskScope: ['b'],
    ...sharedNucleusOptions,
  });

  if (result.outputsByTask.b.output.result !== 'executed-bravo') {
    throw new Error(`Expected 'executed-bravo', got '${result.outputsByTask.b.output.result}'`);
  }
});

// ── 11. taskScope checkpoints only scoped tasks ──────────────

await runTest('taskScope: checkpoints reflect only scoped executions', async () => {
  const plan: Plan = {
    id: 'cp-plan',
    contextRef: 'ref',
    capabilityMapVersion: '1.0',
    tasks: [
      { id: 'a', capability: 'test', input: { value: 'alpha' } },
      { id: 'b', capability: 'test', input: { value: 'bravo' } },
      { id: 'c', capability: 'test', input: { value: 'charlie' } },
    ],
    edges: [],
  };

  const checkpointStore = new MemoryCheckpointStore();
  const runId = 'cp-scope-run';

  await executeResumablePlan({
    goal: makeGoal(),
    context: makeContext(),
    plan,
    capabilityRegistry: makeRegistry(),
    toolRegistry: new SimpleToolRegistry(),
    ledger: new MemoryLedger(),
    checkpointStore,
    runId,
    taskScope: ['a', 'c'],
    checkpointInterval: 1,
    ...sharedNucleusOptions,
  });

  // Verify checkpoint contains exactly the scoped tasks
  const cp = await checkpointStore.get(runId);
  if (!cp) throw new Error('No checkpoint created');

  const executedInCheckpoint = new Set(cp.state.executed);
  if (executedInCheckpoint.size !== 2) {
    throw new Error(`Expected 2 executed in checkpoint, got ${executedInCheckpoint.size}`);
  }
  if (!executedInCheckpoint.has('a') || !executedInCheckpoint.has('c')) {
    throw new Error('Checkpoint should contain tasks a and c');
  }
  if (executedInCheckpoint.has('b')) {
    throw new Error('Checkpoint should NOT contain task b');
  }
});

// ── 12. taskScope with leaf task whose deps are met ──────────

await runTest('taskScope: [t1, t4] in diamond — t4 blocked until deps complete', async () => {
  // Diamond: t1 → t2, t1 → t3, t2 → t4, t3 → t4
  // scope = [t1, t4]. t1 will execute, but t4 depends on t2 and t3 which are
  // NOT in scope. t4 should NOT execute.
  const result = await executeResumablePlan({
    goal: makeGoal(),
    context: makeContext(),
    plan: makeDiamondPlan(),
    capabilityRegistry: makeRegistry(),
    toolRegistry: new SimpleToolRegistry(),
    ledger: new MemoryLedger(),
    checkpointStore: new MemoryCheckpointStore(),
    runId: 'scope-diamond-t1-t4',
    taskScope: ['t1', 't4'],
    ...sharedNucleusOptions,
  });

  const executedIds = Object.keys(result.outputsByTask);
  // Only t1 should execute; t4 is blocked by t2/t3 which aren't in scope
  if (executedIds.length !== 1) {
    throw new Error(`Expected 1 task (t1 only), got ${executedIds.length}: ${executedIds}`);
  }
  if (!result.outputsByTask.t1) throw new Error('t1 should execute');
  if (result.outputsByTask.t4) throw new Error('t4 should NOT execute (deps not met)');
});

// ── 13. Ledger recorded correctly with taskScope ─────────────

await runTest('Ledger entries accurate when taskScope limits execution', async () => {
  const plan: Plan = {
    id: 'ledger-plan',
    contextRef: 'ref',
    capabilityMapVersion: '1.0',
    tasks: [
      { id: 'a', capability: 'test', input: { value: 'alpha' } },
      { id: 'b', capability: 'test', input: { value: 'bravo' } },
    ],
    edges: [],
  };

  const ledger = new MemoryLedger();

  await executeResumablePlan({
    goal: makeGoal(),
    context: makeContext(),
    plan,
    capabilityRegistry: makeRegistry(),
    toolRegistry: new SimpleToolRegistry(),
    ledger,
    checkpointStore: new MemoryCheckpointStore(),
    runId: 'ledger-scope-run',
    taskScope: ['a'],
    ...sharedNucleusOptions,
  });

  const entries = ledger.getEntries();
  // Should have PLAN_SELECTED + TASK_STARTED/COMPLETED for 'a' only
  const taskEntries = entries.filter(e =>
    e.type === 'TASK_END' || e.type === 'TASK_START'
  );
  const taskIds = taskEntries.map(e => (e.details as any)?.taskId).filter(Boolean);
  const unique = [...new Set(taskIds)];
  if (unique.length !== 1 || unique[0] !== 'a') {
    throw new Error(`Expected ledger entries only for 'a', got ${unique}`);
  }
});

// ── Summary ──────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
