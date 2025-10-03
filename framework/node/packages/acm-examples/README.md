# @acm/examples

Complete CLI demo and sample implementations for the ACM v0.5 Node.js Framework.

## Overview

This package provides a full-featured CLI demo application that showcases end-to-end ACM v0.5 workflows with LLM integration, streaming, and policy enforcement. It includes sample tools, tasks, and two complete example scenarios.

## Installation

```bash
# From the monorepo root
cd framework/node
pnpm install
pnpm build
```

## Running the Demo

### Basic Usage

```bash
# Using Ollama (default)
pnpm --filter @acm/examples demo -- --provider ollama --model llama3.1 --goal refund

# Using vLLM
pnpm --filter @acm/examples demo -- --provider vllm --model qwen2.5:7b --goal issues

# With different engine (runtime is default)
pnpm --filter @acm/examples demo -- --engine runtime --goal refund

# Save replay bundle
pnpm --filter @acm/examples demo -- --save-bundle --goal refund
```

### CLI Options

```
--provider <ollama|vllm>    LLM provider (default: ollama)
--model <name>              Model name (default: llama3.1)
--base-url <url>            Override API base URL
--engine <runtime|langgraph|msaf>  Execution engine (default: runtime)
--goal <refund|issues>      Goal to execute (default: refund)
--no-stream                 Disable streaming output
--save-bundle               Save replay bundle to replay/<runId>/
-h, --help                  Show help
```

## Example Workflows

### 1. Refund Flow

**Goal:** Issue a refund for order O123 within 2 minutes, CC supervisor

**Context:**
- Order ID: O123
- Region: EU
- Customer tier: GOLD
- Refund amount: $49.99

**Steps:**
1. Search for order details
2. Extract entities from results
3. Assess risk based on order data
4. Create refund transaction (if risk acceptable)
5. Notify supervisor via email

**Features demonstrated:**
- Multi-tool task composition
- Policy enforcement (amount limits)
- Risk assessment
- Verification assertions
- Side-effect operations
- Supervisor notifications

### 2. Issues Flow

**Goal:** Find top issues and trigger mitigation

**Context:**
- Product: ACME-X
- Region: EU
- Time range: Last 24 hours

**Steps:**
1. Search for issues
2. Analyze severity
3. Trigger appropriate mitigation

**Features demonstrated:**
- Read-only operations
- Data analysis
- Conditional branching
- Guard evaluation

## Sample Tools

The demo includes several reusable tools:

### SearchTool
```typescript
class SearchTool extends Tool<{ query: string }, { results: string[] }> {
  // Simulates search operation
}
```

### ExtractEntitiesTool
```typescript
class ExtractEntitiesTool extends Tool<{ text: string }, { entities: string[] }> {
  // Extracts structured data
}
```

### AssessRiskTool
```typescript
class AssessRiskTool extends Tool<{ context: any }, { riskTier: string; score: number }> {
  // Evaluates risk level
}
```

### CreateRefundTxnTool
```typescript
class CreateRefundTxnTool extends Tool<
  { orderId: string; amount: number },
  { transactionId: string; status: string }
> {
  // Creates refund transaction
}
```

### NotifySupervisorTool
```typescript
class NotifySupervisorTool extends Tool<
  { message: string; channel: string },
  { sent: boolean; messageId: string }
> {
  // Sends notifications
}
```

## Sample Tasks

### SearchTask
Simple task that wraps a single tool.

### EnrichAndActTask
Complex task that:
1. Searches for data
2. Extracts entities
3. Assesses risk
4. Decides action based on risk

Demonstrates:
- Multi-tool composition
- Policy input generation
- Verification expressions

### RefundFlowTask
End-to-end task that:
1. Creates refund transaction
2. Notifies supervisor
3. Returns confirmation

Demonstrates:
- Side-effect operations
- Error handling
- Verification assertions

## Registry Implementations

### SimpleCapabilityRegistry

Concrete implementation of `CapabilityRegistry`:
- Maps capability names to tasks
- Provides schema metadata
- Supports dynamic registration

### SimpleToolRegistry

Concrete implementation of `ToolRegistry`:
- Manages tool instances by name
- Provides tool discovery
- Thread-safe registration

## Policy Engine

### SimplePolicyEngine

Example policy implementation:
- Denies high-amount refunds (>$100)
- Allows all other operations
- Returns timeout and retry limits

Extension points for:
- OPA/Rego integration
- Database-backed rules
- External authorization services

## CLI Renderer

The `CLIRenderer` class provides:
- Real-time planner token streaming
- Task progress updates
- Ledger entry formatting
- Execution summary

Example output:
```
📋 Planning...

Analyzing goal... generating tasks...

✅ Plans generated: 2
Rationale: Plan-A focuses on speed, Plan-B includes additional checks

📋 Executing Plan: plan-a
Context Ref: 8f3a2b1c4d5e6f7a

[t1] Task started
[t1]   → search_complete
[t1] ✓ Task completed

[t2]   → entities_extracted
[t2]   → risk_assessed
[t2] ✓ Task completed

...

✅ Demo completed successfully!
```

## Streaming Integration

The demo fully integrates streaming:

```typescript
const stream = new DefaultStreamSink();

// Planner tokens
stream.attach('planner', chunk => {
  process.stdout.write(chunk.delta);
});

// Task updates
stream.attach('task', update => {
  console.log(`[${update.taskId}] ${update.status}`);
});

// Pass to planner and executor
await planner.plan({ ..., stream });
await executePlan({ ..., stream });
```

## Customization

### Adding New Tools

```typescript
// 1. Define your tool
class MyTool extends Tool<MyInput, MyOutput> {
  name() { return 'my-tool'; }
  async call(input: MyInput) {
    // Implementation
  }
}

// 2. Register it
toolRegistry.register(new MyTool());
```

### Adding New Tasks

```typescript
// 1. Define your task
class MyTask extends Task<MyInput, MyOutput> {
  constructor() {
    super('my-task-id', 'my-capability');
  }
  
  async execute(ctx: RunContext, input: MyInput) {
    // Implementation
  }
}

// 2. Register it
capabilityRegistry.register(
  { name: 'my-capability', sideEffects: false },
  new MyTask()
);
```

### Adding New Goals

```typescript
// In src/goals/index.ts
export const goals = {
  myGoal: {
    id: 'goal-my-1',
    intent: 'My custom goal',
    constraints: { /* ... */ },
  },
};

export const contexts = {
  myGoal: {
    id: 'ctx-my-1',
    facts: { /* ... */ },
  },
};
```

## Prerequisites

To run the demo with LLM integration:

### Option 1: Ollama
```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.1
ollama serve
```

### Option 2: vLLM
```bash
pip install vllm
vllm serve mistralai/Mistral-7B-Instruct-v0.2 --port 8000
```

## File Structure

```
packages/acm-examples/
├── bin/
│   └── acm-demo.ts        # CLI entry point
├── src/
│   ├── goals/
│   │   └── index.ts       # Goal and context definitions
│   ├── tasks/
│   │   └── index.ts       # Task implementations
│   ├── tools/
│   │   └── index.ts       # Tool implementations
│   ├── policy.ts          # Policy engine
│   ├── registries.ts      # Registry implementations
│   └── renderer.ts        # CLI output renderer
├── package.json
└── tsconfig.json
```

## Troubleshooting

### LLM Connection Failed
- Ensure Ollama/vLLM is running
- Check baseUrl matches your server
- Verify model is downloaded/loaded

### Build Errors
```bash
pnpm clean
pnpm install
pnpm build
```

### Module Not Found
```bash
# From monorepo root
cd framework/node
pnpm install
```

## Next Steps

- Extend with your own tools and tasks
- Integrate with external systems (databases, APIs)
- Add MCP tool support
- Implement LangGraph/MS AF adapters
- Create additional example workflows

## License

Apache-2.0
