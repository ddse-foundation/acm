# @acm/replay

Replay bundle export and import for ACM, providing complete audit trails and reproducibility.

## Overview

This package enables exporting and importing complete ACM execution bundles. Replay bundles capture all artifacts, decisions, and I/O from an execution run, enabling:

- **Audit & Compliance**: Complete execution history for regulatory review
- **Debugging**: Understand exactly what happened in a failed run
- **Reproducibility**: Replay executions for testing or validation
- **Analysis**: Post-execution analysis of agent behavior

## Features

- Export complete execution bundles to structured JSON files
- Load and validate existing bundles
- Comprehensive artifact capture (goals, plans, context, I/O, ledger)
- JSONL format for streaming logs (ledger, policy records)
- Metadata tracking for versioning and provenance

## Installation

```bash
pnpm add @acm/replay
```

## Usage

### Exporting a Replay Bundle

```typescript
import { ReplayBundleExporter } from '@acm/replay';

// After execution, export the bundle
const bundlePath = await ReplayBundleExporter.export({
  outputDir: './replay/run-12345',
  goal,
  context,
  plans: [planA, planB],
  selectedPlanId: planA.id,
  ledger: ledger.entries(),
  taskIO: [
    {
      taskId: 't1',
      capability: 'search',
      input: { query: 'test' },
      output: { results: ['result1'] },
      ts: '2025-01-15T10:00:00Z',
    },
  ],
  policyRecords: [
    {
      id: 'p1',
      ts: '2025-01-15T10:00:00Z',
      action: 'search',
      input: {},
      decision: true,
    },
  ],
  verificationResults: [],
  engineTrace: {
    runId: 'run-12345',
    engine: 'runtime',
    startedAt: '2025-01-15T10:00:00Z',
    completedAt: '2025-01-15T10:05:00Z',
    status: 'success',
    tasks: [],
  },
});

console.log(`Bundle exported to: ${bundlePath}`);
```

### Loading a Replay Bundle

```typescript
import { ReplayBundleExporter } from '@acm/replay';

// Load bundle
const bundle = await ReplayBundleExporter.load('./replay/run-12345');

console.log('Goal:', bundle.goal);
console.log('Plans:', bundle.plans.length);
console.log('Ledger entries:', bundle.ledger.length);
console.log('Task I/O records:', bundle.taskIO.length);
```

### Validating a Bundle

```typescript
import { ReplayBundleExporter } from '@acm/replay';

const validation = await ReplayBundleExporter.validate('./replay/run-12345');

if (validation.valid) {
  console.log('Bundle is valid');
} else {
  console.error('Bundle validation errors:', validation.errors);
}
```

### Integration with CLI

The replay package integrates seamlessly with the ACM demo CLI:

```bash
# Run with replay bundle export
pnpm --filter @acm/examples demo -- --goal refund --save-bundle

# Bundle will be saved to ./replay/<runId>/
```

## Bundle Structure

A replay bundle has the following directory structure:

```
replay/run-12345/
├── metadata.json                    # Bundle metadata
├── goal/
│   └── goal.json                    # Goal definition
├── context/
│   └── context.json                 # Context packet
├── plans/
│   ├── planA.json                   # Plan A
│   └── planB.json                   # Plan B (if available)
├── task-specs/
│   ├── t1.json                      # Task spec for task t1
│   └── t2.json                      # Task spec for task t2
├── policy/
│   └── requests.jsonl               # Policy decisions (JSONL)
├── verification/
│   └── results.json                 # Verification results
├── memory-ledger/
│   └── ledger.jsonl                 # Memory ledger entries (JSONL)
├── engine-trace/
│   └── run.json                     # Engine execution trace
├── task-io/
│   ├── t1.input.json                # Task t1 input
│   ├── t1.output.json               # Task t1 output
│   ├── t2.input.json                # Task t2 input
│   └── t2.output.json               # Task t2 output
└── planner-prompts/
    └── messages.json                # Planner LLM messages (optional)
```

## API Reference

### `ReplayBundleExporter`

Main class for exporting and loading replay bundles.

#### Methods

**`static async export(options: ReplayBundleExportOptions): Promise<string>`**

Export a replay bundle to disk.

**Parameters:**
- `outputDir`: Output directory path
- `goal`: Goal object
- `context`: Context object
- `plans`: Array of Plan objects
- `selectedPlanId`: ID of the selected plan
- `ledger`: Array of ledger entries
- `taskIO`: Array of task I/O records
- `policyRecords`: Optional array of policy records
- `verificationResults`: Optional array of verification results
- `engineTrace`: Optional engine trace
- `plannerPrompts`: Optional planner LLM messages

**Returns:** Path to the created bundle

**`static async load(bundleDir: string): Promise<Bundle>`**

Load a replay bundle from disk.

**Parameters:**
- `bundleDir`: Path to bundle directory

**Returns:** Bundle object with all artifacts

**`static async validate(bundleDir: string): Promise<ValidationResult>`**

Validate a replay bundle structure.

**Parameters:**
- `bundleDir`: Path to bundle directory

**Returns:** Validation result with errors if any

### Types

```typescript
interface ReplayBundleMetadata {
  version: string;
  createdAt: string;
  runId: string;
  goalId: string;
  contextRef: string;
  planId: string;
}

interface PolicyRecord {
  id: string;
  ts: string;
  action: string;
  input: any;
  decision: boolean;
}

interface VerificationResult {
  taskId: string;
  ts: string;
  expressions: string[];
  results: boolean[];
  passed: boolean;
}

interface TaskIORecord {
  taskId: string;
  capability: string;
  input: any;
  output: any;
  ts: string;
}

interface EngineTrace {
  runId: string;
  engine: string;
  startedAt: string;
  completedAt: string;
  status: 'success' | 'failed' | 'partial';
  tasks: Array<{
    taskId: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    error?: string;
  }>;
}
```

## ACM v0.5 Compliance

This package implements the Replay Bundle artifact specification from ACM v0.5:

- ✅ Complete artifact capture (Goal, Context, Plans, Tasks)
- ✅ Policy decision recording
- ✅ Verification results
- ✅ Memory ledger in append-only format (JSONL)
- ✅ Engine execution trace
- ✅ Task I/O recording
- ✅ Optional planner prompts for LLM transparency
- ✅ Content-addressable references via metadata

## Use Cases

### Compliance & Audit

Export bundles for regulatory compliance, providing complete audit trails:

```typescript
// Export after each production run
await ReplayBundleExporter.export({
  outputDir: `./audit/runs/${runId}`,
  // ... all execution data
});
```

### Debugging

Load bundles to understand failures:

```typescript
const bundle = await ReplayBundleExporter.load('./replay/failed-run');
console.log('Failed at task:', bundle.ledger.find(e => e.type === 'TASK_ERROR'));
```

### Testing

Use bundles to verify behavior:

```typescript
const bundle = await ReplayBundleExporter.load('./test-fixtures/baseline');
// Compare with new execution
```

## License

Apache-2.0
