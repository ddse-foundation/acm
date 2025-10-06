# @ddse/acm-adapters

Framework adapters for ACM, providing integration with LangGraph and Microsoft Agent Framework.

## Overview

This package provides adapters that allow ACM plans to be executed using popular agent frameworks. The adapters handle the conversion of ACM tasks, guards, and edges into framework-specific constructs while preserving ACM's policy, verification, and streaming capabilities.

## Features

- **LangGraph Adapter**: Convert ACM plans into LangGraph state graphs
- **MS Agent Framework Adapter**: Execute ACM plans as MS Agent activities
- Full support for ACM policy hooks and verification
- Streaming progress updates
- Memory ledger integration

## Installation

```bash
pnpm add @ddse/acm-adapters
```

For LangGraph support, also install:
```bash
pnpm add @langchain/langgraph
```

## Usage

### LangGraph Adapter

```typescript
import { asLangGraph } from '@ddse/acm-adapters';
import { executePlan } from '@ddse/acm-runtime';

// Create adapter
const adapter = asLangGraph({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  policy,
  stream,
  ledger,
});

// Get graph structure for use with LangGraph
const { nodes, edges, entryPoint } = adapter.buildGraph();

// Or execute directly (simplified execution)
const result = await adapter.execute();
```

### Microsoft Agent Framework Adapter

```typescript
import { wrapAgentNodes } from '@ddse/acm-adapters';

// Create adapter
const adapter = wrapAgentNodes({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  policy,
  stream,
  ledger,
});

// Get activities for MS Agent Framework
const activities = adapter.getAllActivities();

// Or execute directly
const result = await adapter.execute();
```

### Full Example with CLI

```typescript
import { asLangGraph, wrapAgentNodes } from '@ddse/acm-adapters';

// ... setup goal, context, plan, registries ...

let result;

if (engine === 'langgraph') {
  const adapter = asLangGraph({
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
    policy,
    stream,
    ledger,
  });
  result = await adapter.execute();
} else if (engine === 'msaf') {
  const adapter = wrapAgentNodes({
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
    policy,
    stream,
    ledger,
  });
  result = await adapter.execute();
} else {
  // Use standard ACM runtime
  result = await executePlan({
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
    policy,
    stream,
    ledger,
  });
}
```

## Features by Adapter

### LangGraph Adapter

The LangGraph adapter converts ACM plans into LangGraph state graphs:

- **Nodes**: Each ACM task becomes a LangGraph node
- **Edges**: ACM edges with guards become conditional edges
- **State**: Graph state includes task outputs and context
- **Execution**: Supports LangGraph's execution engine

**Key Methods:**
- `buildGraph()`: Get nodes, edges, and entry point
- `execute()`: Run simplified execution

### MS Agent Framework Adapter

The MS Agent Framework adapter wraps ACM tasks as activities:

- **Activities**: Each ACM task becomes an activity handler
- **Workflow**: Respects task dependencies via topological sort
- **Hooks**: Full policy and verification support
- **Events**: Streaming events for progress tracking

**Key Methods:**
- `getActivity(taskId)`: Get activity handler for a task
- `getAllActivities()`: Get all activity handlers
- `execute()`: Run workflow execution

## Policy and Verification

Both adapters fully support ACM's policy and verification features:

```typescript
// Policy checks happen before task execution
const policy = {
  async evaluate({ action, input, context }) {
    // Return true to allow, false to deny
    return input.riskLevel !== 'HIGH';
  },
};

// Verification happens after task execution
class MyTask extends Task {
  verification() {
    return ['output.result !== null', 'output.status === "success"'];
  }
}
```

## Streaming

Both adapters emit progress events that can be consumed:

```typescript
const stream = new DefaultStreamSink();
stream.attach('task', (update) => {
  console.log(`Task ${update.taskId}: ${update.status}`);
});

// Use with adapter
const adapter = asLangGraph({
  // ...
  stream,
});
```

## API Reference

### LangGraphAdapter

**Constructor:**
```typescript
new LangGraphAdapter(options: LangGraphAdapterOptions)
```

**Methods:**
- `buildGraph()`: Returns `{ nodes, edges, entryPoint }`
- `execute()`: Returns `{ outputs, ledger }`

### MSAgentFrameworkAdapter

**Constructor:**
```typescript
new MSAgentFrameworkAdapter(options: MSAgentFrameworkAdapterOptions)
```

**Methods:**
- `getActivity(taskId: string)`: Get activity handler
- `getAllActivities()`: Get all activities as Map
- `execute()`: Returns `{ outputs, ledger }`

## Notes

- The adapters provide simplified execution modes suitable for ACM use cases
- For advanced LangGraph features (checkpointing, parallel execution), use the graph structure directly
- MS Agent Framework adapter uses topological sorting for task ordering
- Both adapters respect guard expressions for conditional branching

## License

Apache-2.0
