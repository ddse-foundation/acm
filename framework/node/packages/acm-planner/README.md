# @acm/planner

LLM-based plan generation with Plan-A/B alternatives and safe fallback.

## Overview

The planner package uses LLMs to generate execution plans from goals and contexts. It produces Plan-A and Plan-B alternatives as specified in ACM v0.5, with automatic fallback to a safe linear plan if parsing fails.

## Installation

```bash
pnpm add @acm/planner @acm/llm @acm/sdk
```

## Features

- ✅ LLM-based plan generation
- ✅ Plan-A and Plan-B alternatives
- ✅ Context reference computation (SHA-256)
- ✅ Streaming support for live feedback
- ✅ Safe fallback on parsing errors
- ✅ ACM v0.5 compliant plan format

## Usage

### Basic Planning

```typescript
import { LLMPlanner } from '@acm/planner';
import { createOllamaClient } from '@acm/llm';

const llm = createOllamaClient('llama3.1');
const planner = new LLMPlanner();

const result = await planner.plan({
  goal: {
    id: 'goal-1',
    intent: 'Process a customer refund',
    constraints: { maxTimeSeconds: 120 },
  },
  context: {
    id: 'ctx-1',
    facts: {
      orderId: 'O123',
      amount: 49.99,
      region: 'EU',
    },
  },
  capabilities: [
    { name: 'search', sideEffects: false },
    { name: 'assess_risk', sideEffects: false },
    { name: 'create_refund', sideEffects: true },
    { name: 'notify_supervisor', sideEffects: true },
  ],
  llm,
});

console.log('Context Ref:', result.contextRef);
console.log('Plans generated:', result.plans.length);
console.log('Rationale:', result.rationale);

// Select Plan-A
const plan = result.plans[0];
```

### With Streaming

```typescript
import { DefaultStreamSink } from '@acm/sdk';

const stream = new DefaultStreamSink();

stream.attach('planner', (chunk) => {
  if (chunk.delta) {
    process.stdout.write(chunk.delta);
  }
  if (chunk.done) {
    console.log('\n\nPlanning complete!');
  }
});

const result = await planner.plan({
  goal,
  context,
  capabilities,
  llm,
  stream,
});
```

### Custom Capability Map Version

```typescript
const result = await planner.plan({
  goal,
  context,
  capabilities,
  llm,
  capabilityMapVersion: 'v2.1',
});

console.log('Plan uses capability map:', result.plans[0].capabilityMapVersion);
```

## API Reference

### LLMPlanner

#### plan(options): Promise<PlannerResult>

Generate Plan-A and Plan-B from a goal and context.

**Options:**
```typescript
{
  goal: Goal;                    // The goal to plan for
  context: Context;              // Immutable context packet
  capabilities: Capability[];    // Available capabilities
  llm: LLM;                      // LLM client
  stream?: StreamSink;           // Optional streaming
  capabilityMapVersion?: string; // Version (default: 'v1')
}
```

**Returns:**
```typescript
{
  plans: Plan[];        // Plan-A and Plan-B (or fallback)
  contextRef: string;   // SHA-256 hash of context
  rationale?: string;   // LLM explanation
}
```

## Plan Format

Generated plans follow ACM v0.5 specification:

```typescript
{
  id: 'plan-a',
  contextRef: '8f3a2b1c...',  // SHA-256 hash
  capabilityMapVersion: 'v1',
  tasks: [
    {
      id: 't1',
      capability: 'search',
      input: { query: 'order O123' },
    },
    {
      id: 't2',
      capability: 'assess_risk',
      input: { orderId: 'O123' },
      retry: {
        attempts: 3,
        backoff: 'exp',
      },
    },
  ],
  edges: [
    { from: 't1', to: 't2' },
    { from: 't2', to: 't3', guard: 'outputs.t2.riskTier !== "HIGH"' },
  ],
}
```

## Context Reference

The planner computes a deterministic context reference using SHA-256:

```typescript
const contextRef = sha256(JSON.stringify(context)).substring(0, 16);
```

This ensures:
- Plans are bound to specific contexts
- Replay audits can verify context integrity
- Context changes trigger re-planning

## Fallback Behavior

If the LLM response cannot be parsed, the planner returns a safe linear plan:

```typescript
{
  id: 'plan-fallback',
  contextRef: '<computed>',
  capabilityMapVersion: 'v1',
  tasks: [
    { id: 't1', capability: 'search', input: {} },
  ],
  edges: [],
}
```

This ensures the system remains operational even with unreliable LLM outputs.

## Prompt Engineering

The planner uses a structured prompt that includes:
- Goal intent and constraints
- Context facts
- Available capability names
- Request for Plan-A and Plan-B in JSON format

Example prompt:
```
You are a task planner. Given a goal and context, generate two
alternative execution plans (Plan-A and Plan-B).

Goal: Process a customer refund
Constraints: {"maxTimeSeconds":120}

Context facts: {"orderId":"O123","amount":49.99}

Available capabilities: search, assess_risk, create_refund

Generate two plans in the following JSON format: ...
```

## Streaming Output

When streaming is enabled, the planner emits token-by-token updates:

```typescript
stream.emit('planner', { delta: 'Generating' });
stream.emit('planner', { delta: ' plan...' });
stream.emit('planner', { done: true });
```

This provides real-time feedback during planning, which can take several seconds.

## ACM v0.5 Compliance

- ✅ Section 5.4: Plan Graph format
- ✅ Section 4: Context Packet binding via contextRef
- ✅ Section 5.4.2: Plan alternatives (Plan-A, Plan-B)
- ✅ Section 6.1: Deterministic contextRef computation

## Error Handling

The planner never throws errors. Instead:
- Invalid LLM responses trigger fallback plan
- Network errors are logged and fallback is used
- Malformed JSON is caught and fallback is used

This ensures robustness in production environments.

## Performance

Typical planning times:
- Ollama (llama3.1): 2-5 seconds
- vLLM (qwen2.5:7b): 1-3 seconds

Streaming provides immediate feedback, improving perceived performance.

## License

Apache-2.0
