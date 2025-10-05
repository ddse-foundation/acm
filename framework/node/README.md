# ACM v0.5 Node.js Framework

A developer-first, code-centric implementation of the Agentic Contract Model (ACM) v0.5 specification for building deterministic, auditable AI agents in Node.js.

## Overview

The ACM Node.js Framework gives engineers a coherent set of SDKs, runtime services, and reference tooling to implement ACM-compliant agents without wrestling with bespoke YAML or ad-hoc orchestration. Everything is authored in TypeScript/JavaScript, wired to the formal ACM contracts, and designed to run locally or inside existing CI/CD pipelines.

### Core Capabilities

- **Spec-Accurate Contracts**: Implements ACM v0.5 Goal, Context Packet, Plan, Task, and Ledger artifacts with validation utilities.
- **Structured Planning**: Deterministic planner abstraction that emits tool-call envelopes, rationale, and auditable prompt hashes.
- **Deterministic Runtime**: Enforces guard evaluation, policy hooks, typed errors, and replay bundle generation for every execution.
- **Resumable Execution**: Built-in checkpointing and resume mechanics for long-running workflows (Phase 2 complete).
- **Tool Discipline**: Uniform `ToolCallEnvelope` instrumentation across native tools, MCP integrations, and LLM-backed utilities.
- **Nucleus Abstraction** *(Phase 4 roadmap)*: Shared reasoning core that standardizes LLM calls, internal context retrieval, and ledger recording.
- **Open LLM Support**: OpenAI-compatible client with presets for Ollama and vLLM; bring your own provider via configuration.
- **MCP Integration**: Discover and invoke Model Context Protocol servers as first-class tools.

> **Status Banner** — Phase 4 work is underway. Structured planner tool calls, the Nucleus contract, and enriched replay artifacts are actively being integrated (see `IMPLEMENTATION_PLAN_PHASE4.md`). Public docs call out any in-progress surfaces so you can opt into previews deliberately.

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

### Explore the Framework Examples

The primary entry point for learning the framework is the `@acm/examples` package. It ships with refund and issue-resolution workflows that exercise the runtime, planner, ledger, and replay tooling.

```bash
# Run the refund workflow with Ollama (ensure Ollama is serving locally)
pnpm --filter @acm/examples demo -- --provider ollama --model llama3.1 --goal refund

# Switch to vLLM
pnpm --filter @acm/examples demo -- --provider vllm --model mistralai/Mistral-7B-Instruct-v0.2 --goal issues

# Inspect replay bundle output
pnpm --filter @acm/examples demo -- --goal refund --save-bundle --checkpoint-dir ./checkpoints

# Execute package tests
pnpm --filter @acm/examples test
pnpm --filter @acm/examples test:bm25
```

You can also target alternative engines via `--engine langgraph` or `--engine msaf`, relying on the adapters that ship with the monorepo.

### Local LLM Prerequisites

Most samples expect an OpenAI-compatible endpoint. The framework provides helper factories for common local setups:

- **Ollama** — Instal from [ollama.ai](https://ollama.ai), run `ollama pull llama3.1`, then `ollama serve` (default port `11434`).
- **vLLM** — `pip install vllm`, then `vllm serve mistralai/Mistral-7B-Instruct-v0.2 --port 8000`.

## Architecture

The framework is organized as a monorepo with focused packages:

```text
packages/
├── acm-sdk/          # Core abstracts and types
├── acm-runtime/      # Deterministic execution engine and resumable runtime
├── acm-framework/    # High-level wrapper combining planning and execution
├── acm-llm/          # OpenAI-compatible LLM client utilities
├── acm-planner/      # Structured planning via tool-call envelopes
├── acm-mcp/          # Model Context Protocol integrations and tooling
├── acm-adapters/     # LangGraph and Microsoft Agent Framework adapters
├── acm-replay/       # Replay bundle export/import + validation
├── acm-aicoder/      # Reference developer experience built on the framework
└── acm-examples/     # CLI and sample workflows
```

### Reference Implementations

- **`@acm/examples`** provides minimal, deterministic flows (refund, issues, BM25 search) that illustrate the framework fundamentals.
- **`@acm/aicoder`** demonstrates how the framework supports production-grade developer workflows (streaming UI, policy checks, resumable execution). Treat it as a case study; all surfaces still depend on the core SDK/runtime abstractions.

### Core Concepts

1. **Tool** — Typed primitive (e.g., search, create_refund) executed via a `ToolCallEnvelope`.
2. **Task** — Declarative contract binding inputs, outputs, retry policy, and tool usage.
3. **Capability** — Named task contract exposed in registries for planners to consume.
4. **Plan** — Directed acyclic graph of task nodes with guard expressions and rationale.
5. **Execution** — Runtime evaluation with policy gates, ledger capture, and replay artifacts.

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
import { StructuredLLMPlanner } from '@acm/planner';
import { executePlan } from '@acm/runtime';
import { createOllamaClient } from '@acm/llm';

const llm = createOllamaClient('llama3.1');
const planner = new StructuredLLMPlanner();

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

## Developer Surface Area

### SDK

`@acm/sdk` exports the formal ACM contracts plus helpers for building reusable components:

- `Tool<I, O>` — Base class enforcing schema-aware tool execution.
- `Task<I, O>` — Abstract task with retry policy, capability metadata, and optional Nucleus injection.
- `CapabilityRegistry` / `ToolRegistry` — Registries that planners and runtimes consume.
- `PolicyEngine`, `VerificationEngine` — Interfaces for plugging in governance logic.
- `LedgerEntry`, `ToolCallEnvelope` — Typed artifacts for audit trails and replay.
- `ExternalContextProviderAdapter` — Bridges Nucleus `request_context_retrieval` directives to developer-supplied tools and auto-promotes resulting artifacts.

### Runtime

`@acm/runtime` executes plans deterministically:

- `executePlan(options)` — Core engine with resumable execution and checkpointing.
- `MemoryLedger` — Append-only decision log with tamper-evident hashes.
- `evaluateGuard(expr, context)` — Guard evaluation utilities.
- `withRetry(fn, config)` — Deterministic retry/backoff.

### Planner

`@acm/planner` handles structured plan generation:

- `StructuredLLMPlanner.plan(options)` — Generates one or more plan candidates backed by tool-call envelopes.
- Streaming hooks and prompt digests recorded for replay bundles.

### LLM Integration

`@acm/llm` provides OpenAI-compatible clients with presets:

- `createOllamaClient(model, baseUrl?)`
- `createVLLMClient(model, baseUrl?)`
- `OpenAICompatClient` for custom providers.

### Context Retrieval Adapter

Use the `ExternalContextProviderAdapter` when you want the Nucleus preflight to hydrate missing context automatically instead of throwing an error:

```typescript
import { ExternalContextProviderAdapter, Tool } from '@acm/sdk';
import { executePlan } from '@acm/runtime';

const crmClient = createCrmClient();

class CustomerProfileTool extends Tool<{ customerId: string }, { type: string; content: any; promote?: boolean }> {
  name() {
    return 'crm-profile';
  }

  async call(input: { customerId: string }) {
    const record = await crmClient.lookupCustomer(input.customerId); // your backing service
    return {
      type: 'crm.profile',
      content: record,
      promote: true,
    };
  }
}

const contextProvider = new ExternalContextProviderAdapter();
contextProvider.register(new CustomerProfileTool(), {
  match: directive => directive.startsWith('crm:'),
  buildInput: directive => ({ customerId: directive.slice(4) }),
});

const result = await executePlan({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  nucleusFactory,
  nucleusConfig,
  contextProvider,
});
```

By default the adapter matches directives whose prefix equals the tool name (e.g. `filesystem:/tmp/report.json`). Override `match`/`buildInput` to implement richer routing schemes, and the adapter will add artifacts to the internal scope and promote them for you.

### MCP + Adapters

- `@acm/mcp`: `McpClientManager`, `McpToolRegistry`, `CombinedToolRegistry`.
- `@acm/adapters`: `asLangGraph`, `wrapAgentNodes` to embed ACM runtime into external orchestrators.

### Replay & Tooling

- `@acm/replay`: Export/import bundles, validate ledger traces, and inspect tool-call envelopes.
- `@acm/cli` *(coming in Phase 4)*: Consolidated CLI experience that defaults to tool-native execution paths.

## Configuration

The example CLI exposes code-first flags that mirror ACM concepts:

```text
--provider <ollama|vllm>           LLM provider preset
--model <name>                     Model name to load
--base-url <url>                   Override LLM API endpoint
--engine <runtime|langgraph|msaf>  Execution engine adapter
--goal <refund|issues|...>         Example goals provided by @acm/examples
--no-stream                        Disable streaming output
--save-bundle                      Export replay bundle artifacts
--use-mcp                          Enable MCP tool discovery
--mcp-server <command>             Spawn an MCP server for tooling
```

```bash
pnpm build          # Compile all packages
pnpm clean          # Remove build artefacts
pnpm dev            # Watch mode for active development
pnpm test           # Run monorepo test suites
```

## ACM v0.5 Compliance Snapshot

- ✅ Context lifecycle with content-addressable references and provenance tracking.
- ✅ Plan alternatives with recorded rationale and prompt digests.
- ✅ Guarded execution with typed retries, policy hooks, and verification.
- ✅ Memory ledger + replay bundle exports for every run.
- ✅ MCP tool integration alongside deterministic local tools.
- ✅ Resumable runtime (checkpoint/resume) with hash-verified artifacts.
- 🚧 **In Progress (Phase 4)** — Nucleus contract, structured planner tool calls, enriched telemetry.

## Development Workflow

```bash
pnpm build          # Compile all packages
pnpm clean          # Remove build artefacts
pnpm dev            # Watch mode for active development
pnpm test           # Run monorepo test suites
```

Each package follows the same layout (`src/`, `dist/`, `package.json`, `tsconfig.json`) to simplify contribution and cross-package development.

## Example Library Highlights

The `@acm/examples` package showcases:

1. **Refund Flow** — Multi-step workflow with risk scoring, policy enforcement, and notifications.
2. **Issues Flow** — Read-only analysis pipeline demonstrating guard and policy evaluation.
3. **Synthetic Data & BM25** — Search utilities and deterministic test data.
4. **Replay Artifacts** — Inspectable bundles illustrating ledger fidelity.
5. **MCP Integration** — Turn-key filesystem MCP server example.

## Roadmap (Phase 4 Focus)

According to [`IMPLEMENTATION_PLAN_PHASE4.md`](./IMPLEMENTATION_PLAN_PHASE4.md):

- Restore full ACM spec contracts across SDK/runtime/replay.
- Deliver structured planner tool calls with deterministic selection.
- Introduce the Nucleus contract and enforce tool-call discipline throughout.
- Enhance context orchestration with immutable internal scope handling.
- Default CLI/examples to tool-native execution backed by MCP/LLM providers.
- Expand replay bundles with Nucleus inferences, policy transcripts, and tamper-evident hashes.

Expect incremental updates as each workstream lands; the roadmap banner at the top of this README will be updated accordingly.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for coding standards, testing expectations, and governance details.

## License

MIT

## Resources

- [ACM Specification v0.5](../../spec/acm-spec%20v0.5.md)
- [Implementation Plan (Phase 4)](./IMPLEMENTATION_PLAN_PHASE4.md)
- [Resumable Executor Runbook](./docs/RUNBOOK_RESUMABLE.md)
- [Monorepo Implementation Guide](./framework-implementation-plan-node.md)
