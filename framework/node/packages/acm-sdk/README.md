# @acm/sdk

Core types and abstract classes for the ACM v0.5 Node.js Framework.

## Overview

The SDK package provides the foundational types and interfaces that all other ACM packages build upon. It's designed to be minimal, with zero dependencies beyond Node.js built-ins.

## Installation

```bash
pnpm add @acm/sdk
```

## What's Included

### Abstract Classes

- **Tool<I, O>**: Base class for atomic operations
- **Task<I, O>**: Base class for logical task units
- **CapabilityRegistry**: Interface for task registries
- **ToolRegistry**: Interface for tool registries

### Types

- **Goal**: Represents user intent
- **Context**: Immutable facts for planning
- **Plan**: Task graph with edges and guards
- **TaskSpec**: Task configuration
- **LedgerEntry**: Memory ledger entry
- **PolicyDecision**: Authorization result
- **RunContext**: Execution context passed to tasks

### Utilities

- **DefaultStreamSink**: Stream multiplexer for real-time updates
- **PolicyEngine**: Interface for policy decision points

## Usage

### Defining a Tool

```typescript
import { Tool } from '@acm/sdk';

export class MyTool extends Tool<{ input: string }, { output: string }> {
  name(): string {
    return 'my-tool';
  }

  async call(input: { input: string }): Promise<{ output: string }> {
    // Your implementation
    return { output: `Processed: ${input.input}` };
  }
}
```

### Defining a Task

```typescript
import { Task, type RunContext } from '@acm/sdk';

export class MyTask extends Task<{ query: string }, { result: any }> {
  constructor() {
    super('my-task-id', 'my-capability');
  }

  async execute(ctx: RunContext, input: { query: string }): Promise<{ result: any }> {
    const tool = ctx.getTool('my-tool');
    if (!tool) throw new Error('Tool not found');
    
    const result = await tool.call({ input: input.query });
    return { result };
  }

  // Optional: for idempotency
  idemKey(ctx: RunContext, input: { query: string }): string {
    return `my-task:${input.query}`;
  }

  // Optional: for policy evaluation
  policyInput(ctx: RunContext, input: { query: string }): Record<string, unknown> {
    return { query: input.query, userId: ctx.context.facts.userId };
  }

  // Optional: for verification
  verification(): string[] {
    return ['output.result !== undefined'];
  }
}
```

### Implementing Registries

```typescript
import { CapabilityRegistry, ToolRegistry, type Capability, type Task, type Tool } from '@acm/sdk';

export class MyCapabilityRegistry extends CapabilityRegistry {
  private tasks = new Map<string, Task>();
  private capabilities = new Map<string, Capability>();

  register(capability: Capability, task: Task): void {
    this.capabilities.set(capability.name, capability);
    this.tasks.set(capability.name, task);
  }

  list(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  has(name: string): boolean {
    return this.capabilities.has(name);
  }

  resolve(name: string): Task | undefined {
    return this.tasks.get(name);
  }

  inputSchema(name: string): unknown | undefined {
    return this.capabilities.get(name)?.inputSchema;
  }

  outputSchema(name: string): unknown | undefined {
    return this.capabilities.get(name)?.outputSchema;
  }
}
```

### Using Streaming

```typescript
import { DefaultStreamSink } from '@acm/sdk';

const stream = new DefaultStreamSink();

// Attach listeners
stream.attach('task', (update) => {
  console.log('Task update:', update);
});

stream.attach('planner', (chunk) => {
  if (chunk.delta) {
    process.stdout.write(chunk.delta);
  }
});

// Emit events
stream.emit('task', { taskId: 't1', status: 'running' });
stream.emit('planner', { delta: 'Generating plan...' });

// Clean up
stream.close('task');
```

## Type Reference

### Goal

```typescript
type Goal = {
  id: string;
  intent: string;
  constraints?: Record<string, any>;
};
```

### Context

```typescript
type Context = {
  id: string;
  facts: Record<string, any>;
  version?: string;
};
```

### Plan

```typescript
type Plan = {
  id: string;
  contextRef: string;
  capabilityMapVersion: string;
  tasks: TaskSpec[];
  edges: PlanEdge[];
  join?: 'all' | 'any';
  alternatives?: string[];
  rationale?: string;
};
```

### TaskSpec

```typescript
type TaskSpec = {
  id: string;
  capability: string;
  input?: any;
  retry?: {
    attempts: number;
    backoff: 'fixed' | 'exp';
    baseMs?: number;
    jitter?: boolean;
  };
  verification?: string[];
};
```

## ACM v0.5 Mapping

This package implements the core abstractions from ACM v0.5:
- **Goal**: Section 2.1
- **Capability**: Section 2.3
- **Task**: Section 2.4
- **Tool**: Section 2.5
- **Context**: Section 4
- **Plan**: Section 5.4

## License

Apache-2.0
