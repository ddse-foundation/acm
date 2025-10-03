# ACM v0.5 Node.js Framework

A complete, code-first implementation of the Agentic Contract Model (ACM) v0.5 specification for Node.js developers.

## Overview

The ACM Node.js Framework provides a comprehensive toolkit for building deterministic, auditable AI agents. It's designed to be easy to use for developers of all skill levels while maintaining full ACM v0.5 specification compliance.

### Key Features

- **Code-First**: No YAML/JSON authoring required - everything is defined in TypeScript/JavaScript
- **Full ACM v0.5 Coverage**: Context lifecycle, plan alternatives, guards, policy hooks, verification, memory ledger, and replay bundles
- **LLM Integration**: OpenAI-compatible client supporting local providers (Ollama, vLLM)
- **Streaming Support**: Real-time progress updates for planning and execution
- **Multiple Execution Engines**: Built-in runtime with adapters for LangGraph and Microsoft Agent Framework
- **Deterministic Execution**: Reproducible runs with complete audit trails
- **Policy & Verification**: Hook points for authorization and validation
- **Memory Ledger**: Complete decision history capture

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/ddse-foundation/acm.git
cd acm/framework/node

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Running the Demo

The framework includes a complete CLI demo with two example workflows:

```bash
# Run with Ollama (requires Ollama running locally)
pnpm --filter @acm/examples demo -- --provider ollama --model llama3.1 --goal refund

# Run with vLLM
pnpm --filter @acm/examples demo -- --provider vllm --model qwen2.5:7b --goal issues

# With LangGraph engine (when available)
pnpm --filter @acm/examples demo -- --engine langgraph --goal refund

# Save replay bundle for audit
pnpm --filter @acm/examples demo -- --save-bundle --goal refund
```

### Prerequisites

To run the LLM-powered demo, you need a local LLM server:

**Option 1: Ollama**
```bash
# Install Ollama from https://ollama.ai
ollama pull llama3.1
ollama serve
```

**Option 2: vLLM**
```bash
pip install vllm
vllm serve <model-name> --port 8000
```

## Architecture

The framework is organized as a monorepo with focused packages:

```
packages/
├── acm-sdk/          # Core abstracts and types
├── acm-runtime/      # Plan execution engine
├── acm-llm/          # LLM client (OpenAI-compatible)
├── acm-planner/      # LLM-based plan generation
└── acm-examples/     # Demo CLI and sample implementations
```

### Core Concepts

1. **Tool**: Atomic operations (e.g., search, create_refund)
2. **Task**: Logical units that may call multiple tools
3. **Capability**: Named task contracts in the registry
4. **Plan**: Directed graph of tasks with guards
5. **Execute**: Deterministic runtime with policy/verification

## Building Your First Agent

### 1. Define Tools

```typescript
import { Tool } from '@acm/sdk';

class SearchTool extends Tool<{ query: string }, { results: string[] }> {
  name() { return 'search'; }
  
  async call(input: { query: string }) {
    // Your implementation
    return { results: ['result1', 'result2'] };
  }
}
```

### 2. Create Tasks

```typescript
import { Task, type RunContext } from '@acm/sdk';

class MyTask extends Task<{ query: string }, { data: any }> {
  constructor() {
    super('my-task-id', 'my-capability');
  }
  
  async execute(ctx: RunContext, input: { query: string }) {
    const tool = ctx.getTool('search');
    const result = await tool.call({ query: input.query });
    return { data: result };
  }
}
```

### 3. Setup Registries

```typescript
import { SimpleCapabilityRegistry, SimpleToolRegistry } from '@acm/examples/registries';

const tools = new SimpleToolRegistry();
tools.register(new SearchTool());

const capabilities = new SimpleCapabilityRegistry();
capabilities.register(
  { name: 'my-capability', sideEffects: false },
  new MyTask()
);
```

### 4. Plan and Execute

```typescript
import { LLMPlanner } from '@acm/planner';
import { executePlan } from '@acm/runtime';
import { createOllamaClient } from '@acm/llm';

const llm = createOllamaClient('llama3.1');
const planner = new LLMPlanner();

// Generate plans
const { plans } = await planner.plan({
  goal: { id: 'g1', intent: 'Find and analyze data' },
  context: { id: 'ctx1', facts: { domain: 'research' } },
  capabilities: capabilities.list(),
  llm,
});

// Execute
const result = await executePlan({
  goal,
  context,
  plan: plans[0],
  capabilityRegistry: capabilities,
  toolRegistry: tools,
});
```

## API Reference

### @acm/sdk

Core types and abstract classes:

- `Tool<I, O>`: Abstract tool class
- `Task<I, O>`: Abstract task class
- `CapabilityRegistry`: Task registry interface
- `ToolRegistry`: Tool registry interface
- `PolicyEngine`: Policy decision point interface
- `StreamSink`: Streaming output interface

### @acm/runtime

Execution engine:

- `executePlan(options)`: Execute a plan with full ACM v0.5 semantics
- `MemoryLedger`: Append-only decision log
- `evaluateGuard(expr, context)`: Guard expression evaluator
- `withRetry(fn, config)`: Retry logic with backoff

### @acm/llm

LLM integration:

- `OpenAICompatClient`: OpenAI-compatible client
- `createOllamaClient(model, baseUrl?)`: Ollama preset
- `createVLLMClient(model, baseUrl?)`: vLLM preset

### @acm/planner

Plan generation:

- `LLMPlanner.plan(options)`: Generate Plan-A and Plan-B from goal

## Configuration

The framework uses code-first configuration. The CLI demo accepts flags:

```
--provider <ollama|vllm>    LLM provider
--model <name>              Model name
--base-url <url>            Override API endpoint
--engine <runtime|langgraph|msaf>  Execution engine
--goal <refund|issues>      Example goal
--no-stream                 Disable streaming
--save-bundle               Export replay bundle
```

## ACM v0.5 Compliance

This framework implements all normative requirements from ACM v0.5:

- ✅ Context lifecycle: Immutable Context Packet with content-addressable refs
- ✅ Plan alternatives: LLM generates Plan-A and Plan-B
- ✅ Deterministic branching: Guards evaluated on recorded facts
- ✅ Task contracts: idempotency keys, retry/backoff, typed errors
- ✅ Policy hooks: Pre/post evaluation with PDP integration
- ✅ Verification: Assertion-based validation
- ✅ Memory Ledger: Complete decision history
- ✅ Replay Bundle: Optional JSON export for audit
- ✅ Engine integration: Adapters for LangGraph and MS AF

## Development

### Building

```bash
pnpm build          # Build all packages
pnpm clean          # Clean build artifacts
pnpm dev            # Watch mode for development
```

### Package Structure

Each package follows a consistent structure:

```
package/
├── src/            # TypeScript source
├── dist/           # Compiled output
├── package.json    # Package manifest
└── tsconfig.json   # TypeScript config
```

## Examples

The `@acm/examples` package includes:

1. **Refund Flow**: Multi-step workflow with risk assessment, policy gates, and notifications
2. **Issues Flow**: Read-only workflow for finding and mitigating issues

See `packages/acm-examples/` for complete implementations.

## Roadmap

- [ ] MCP tool integration (acm-mcp package)
- [ ] LangGraph adapter implementation
- [ ] Microsoft Agent Framework adapter
- [ ] Replay bundle export/import
- [ ] Advanced guard expression DSL
- [ ] OPA/Rego policy integration
- [ ] Verification DSL (JSONLogic)
- [ ] Distributed tracing integration

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

Apache-2.0

## Resources

- [ACM Specification v0.5](../../spec/acm-spec%20v0.5.md)
- [Framework Guide](../basic%20guide.md)
- [Implementation Plan](./framework-implementation-plan-node.md)
