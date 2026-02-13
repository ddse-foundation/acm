# @ddse/acm-sdk

Core types and abstract classes for the ACM v0.5 Node.js Framework.

## Overview

The SDK package provides the foundational types and interfaces that all other ACM packages build upon. It's designed to be minimal, with zero dependencies beyond Node.js built-ins.

## Installation

```bash
pnpm add @ddse/acm-sdk
```

## What's Included

### Abstract Classes

- **Tool<I, O>**: Base class for atomic operations
- **Task<I, O>**: Base class for logical task units
- **CapabilityRegistry**: Interface for task registries
- **ToolRegistry**: Interface for tool registries
- **Nucleus**: Abstract reasoning core with preflight, invoke, and postcheck lifecycle
- **DeterministicNucleus**: Concrete nucleus with built-in context tools, token budget enforcement, and anti-hallucination grounding

### Types

- **Goal**: Represents user intent
- **Context**: Immutable facts for planning
- **Plan**: Task graph with edges and guards
- **TaskSpec**: Task configuration
- **LedgerEntry**: Memory ledger entry
- **PolicyDecision**: Authorization result
- **RunContext**: Execution context passed to tasks
- **NucleusConfig**: Nucleus configuration including `maxContextTokens`, `maxQueryRounds`, and `contextProvider`
- **NucleusInvokeResult**: Invoke result with optional `metrics` (rounds, estimatedPromptTokens, budgetExhausted)

### Utilities

- **DefaultStreamSink**: Stream multiplexer for real-time updates
- **PolicyEngine**: Interface for policy decision points
- **ContextBuilder**: Fluent builder for constructing Context objects with content-addressable refs
- **InternalContextScopeImpl**: Runtime artifact scope with `sizeBytes` tracking and wide provenance support
- **ExternalContextProviderAdapter**: Bridges Nucleus retrieval directives to developer-supplied tools
- **estimateTokens(text)**: Heuristic token estimator with code-aware char/token ratios (aligned with production BudgetManager)

## Usage

### Defining a Tool

```typescript
import { Tool } from '@ddse/acm-sdk';

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
import { Task, type RunContext } from '@ddse/acm-sdk';

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
import { CapabilityRegistry, ToolRegistry, type Capability, type Task, type Tool } from '@ddse/acm-sdk';

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
import { DefaultStreamSink } from '@ddse/acm-sdk';

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
- **Nucleus**: Reasoning core with context tools and token budget

## Nucleus Features

### Built-in Context Tools

The `DeterministicNucleus` auto-injects two tools into every LLM call:

1. **`query_context`** — Read data already in scope (`list`, `read_fact`, `read_augmentation`, `read_assumptions`, `read_artifact`).
2. **`request_context_retrieval`** — Fetch external data not in scope; fulfilled inline when a `contextProvider` is configured.

### Token Budget Enforcement

Set `maxContextTokens` on `NucleusConfig` to pass the model's context window size. The `callLLM` loop estimates cumulative prompt tokens using `estimateTokens()` and forces a final answer (stripping built-in tools) when usage exceeds 85% of the budget.

```typescript
const config: NucleusConfig = {
  goalId: 'g1',
  goalIntent: 'Analyze the codebase',
  contextRef: 'sha256-abc',
  llmCall: { provider: 'vllm', model: 'Qwen/Qwen3-4B', maxTokens: 4096 },
  maxContextTokens: 20480,  // model's context window
  maxQueryRounds: 25,       // max tool loop iterations (default 25)
};
```

The result includes metrics:

```typescript
const result = await nucleus.invoke({ input: task, tools: myTools });
console.log(result.metrics);
// { rounds: 3, estimatedPromptTokens: 12400, budgetExhausted: false }
```

### Anti-Hallucination Grounding

All prompts include grounding directives that force the LLM to:
- Use `query_context` before generating output
- Cite which fact keys, augmentation indices, or artifact IDs were read
- Refuse to fabricate information not present in context
- Call `request_context_retrieval` when needed data is missing

## License

MIT
