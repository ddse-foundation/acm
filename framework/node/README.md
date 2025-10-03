# ACM v0.5 Node.js Framework

A complete, code-first implementation of the Agentic Contract Model (ACM) v0.5 specification for Node.js developers.

## Overview

The ACM Node.js Framework provides a comprehensive toolkit for building deterministic, auditable AI agents. It's designed to be easy to use for developers of all skill levels while maintaining full ACM v0.5 specification compliance.

### Key Features

- **Code-First**: No YAML/JSON authoring required - everything is defined in TypeScript/JavaScript
- **Full ACM v0.5 Coverage**: Context lifecycle, plan alternatives, guards, policy hooks, verification, memory ledger, and replay bundles
- **Resumable Execution** (NEW): Checkpoint and resume support for fault-tolerant long-running workflows
- **LLM Integration**: OpenAI-compatible client supporting local providers (Ollama, vLLM)
- **MCP Tool Integration**: Connect to any MCP server for tool discovery and execution
- **Framework Adapters**: Built-in adapters for LangGraph and Microsoft Agent Framework
- **Replay Bundles**: Complete execution artifact export for audit and compliance
- **BM25 Search**: Built-in full-text search with synthetic test data
- **Streaming Support**: Real-time progress updates for planning and execution
- **Multiple Execution Engines**: Built-in runtime with adapters for LangGraph and Microsoft Agent Framework
- **Deterministic Execution**: Reproducible runs with complete audit trails
- **Policy & Verification**: Hook points for authorization and validation
- **Memory Ledger**: Complete decision history capture
- **Comprehensive Tests**: Unit and integration test suites included

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

# With LangGraph engine
pnpm --filter @acm/examples demo -- --engine langgraph --goal refund

# With MS Agent Framework engine
pnpm --filter @acm/examples demo -- --engine msaf --goal refund

# Save replay bundle for audit
pnpm --filter @acm/examples demo -- --save-bundle --goal refund

# Use MCP tools (e.g., filesystem server)
pnpm --filter @acm/examples demo -- --use-mcp --mcp-server 'npx -y @modelcontextprotocol/server-filesystem /tmp' --goal issues

# NEW: Run with automatic checkpointing
pnpm --filter @acm/examples demo -- --goal refund --checkpoint-dir ./checkpoints

# NEW: Resume from a checkpoint
pnpm --filter @acm/examples demo -- --resume run-1234567890 --checkpoint-dir ./checkpoints

# Run tests
pnpm --filter @acm/examples test
pnpm --filter @acm/examples test:bm25
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
├── acm-mcp/          # MCP tool integration
├── acm-adapters/     # LangGraph and MS Agent Framework adapters
├── acm-replay/       # Replay bundle export/import
├── acm-aicoder/      # AI Coder demo - production-ready developer workflows (NEW)
└── acm-examples/     # Demo CLI and sample implementations
```

### AI Coder Demo (NEW)

The **AI Coder** package (`@acm/aicoder`) showcases ACM's capabilities for real developer workflows:

```bash
# Run the interactive demo (no LLM required)
pnpm --filter @acm/aicoder demo

# Analyze a codebase
acm-aicoder --goal analyze

# Fix bugs with AI assistance
acm-aicoder --goal fixBug --dry-run

# Implement new features
acm-aicoder --goal implementFeature

# Run tests
acm-aicoder --goal runTests

# Full help
acm-aicoder --help
```

**Features:**
- **Code Intelligence Tools**: Read, edit, analyze code with safety checks
- **AI-Powered Tasks**: Analyze, fix bugs, implement features, run tests
- **Safety First**: Dry-run mode, approval workflows, policy enforcement
- **Checkpointing**: Resume long-running operations from any point
- **Beautiful CLI**: Interactive prompts and streaming progress updates

See [`packages/acm-aicoder/README.md`](packages/acm-aicoder/README.md) for detailed documentation.

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

### @acm/mcp

MCP tool integration:

- `McpClientManager`: Connect to MCP servers
- `McpToolRegistry`: Tool registry for MCP tools
- `CombinedToolRegistry`: Merge local and MCP tools

### @acm/adapters

Framework adapters:

- `asLangGraph(options)`: Create LangGraph adapter
- `wrapAgentNodes(options)`: Create MS Agent Framework adapter

### @acm/replay

Replay bundle management:

- `ReplayBundleExporter.export(options)`: Export execution bundle
- `ReplayBundleExporter.load(dir)`: Load existing bundle
- `ReplayBundleExporter.validate(dir)`: Validate bundle structure

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
--use-mcp                   Enable MCP tool integration
--mcp-server <command>      MCP server command
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
- ✅ Replay Bundle: Complete JSON export for audit
- ✅ Engine integration: Adapters for LangGraph and MS AF
- ✅ MCP tool integration: Connect to any MCP server
- ✅ BM25 search: Full-text search with test data

## Development

### Building

```bash
pnpm build          # Build all packages
pnpm clean          # Clean build artifacts
pnpm dev            # Watch mode for development
pnpm test           # Run all tests
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
3. **Synthetic Data**: Sample documents, orders, and issues for testing
4. **BM25 Search**: Full-text search implementation with test data
5. **Integration Tests**: Unit and integration test suites
6. **MCP Integration**: Example MCP server usage
7. **Framework Adapters**: LangGraph and MS Agent Framework examples

See `packages/acm-examples/` for complete implementations.

## Roadmap

- [x] MCP tool integration (acm-mcp package)
- [x] LangGraph adapter implementation
- [x] Microsoft Agent Framework adapter
- [x] Replay bundle export/import
- [x] BM25 search with synthetic data
- [x] Unit and integration tests
- [ ] Advanced guard expression DSL
- [ ] OPA/Rego policy integration
- [ ] Verification DSL (JSONLogic)
- [ ] Distributed tracing integration

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT

## Resources

- [ACM Specification v0.5](../../spec/acm-spec%20v0.5.md)
- [Framework Guide](../basic%20guide.md)
- [Implementation Plan](./framework-implementation-plan-node.md)
