# ACM v0.5 Node.js Framework

A developer-first, code-centric implementation of the Agentic Contract Model (ACM) v0.5 specification for building deterministic, auditable AI agents in Node.js.

> **Latest release: v0.5.2** (2026-02-14) — Browser compatibility fixes, nucleus round caps, universal hashing. See [CHANGELOG.md](./CHANGELOG.md) for details.

## Overview

The ACM Node.js Framework gives engineers a coherent set of SDKs, runtime services, and reference tooling to implement ACM-compliant agents without wrestling with bespoke YAML or ad-hoc orchestration. Everything is authored in TypeScript/JavaScript, wired to the formal ACM contracts, and designed to run locally or inside existing CI/CD pipelines.

### Core Capabilities

- **Spec-Accurate Contracts**: Implements ACM v0.5 Goal, Context Packet, Plan, Task, and Ledger artifacts with validation utilities.
- **Structured Planning**: Deterministic planner abstraction that emits tool-call envelopes, rationale, and auditable prompt hashes.
- **Deterministic Runtime**: Enforces guard evaluation, policy hooks, typed errors, and replay bundle generation for every execution.
- **Resumable Execution**: Built-in checkpointing and resume mechanics for long-running workflows (Phase 2 complete).
- **Tool Discipline**: Uniform `ToolCallEnvelope` instrumentation across native tools, MCP integrations, and LLM-backed utilities.
- **Nucleus Abstraction**: Shared reasoning core that standardizes LLM calls, internal context retrieval, and ledger recording.
- **Built-in Context Tools**: `query_context` for reading scoped data and `request_context_retrieval` for fetching external context — both auto-injected into the Nucleus tool loop.
- **Anti-Hallucination Grounding**: Prompts include GROUNDING RULES, VALIDATION RULES, and GROUNDING CONSTRAINT warnings that force the LLM to cite context keys and refuse to fabricate.
- **Token Budget Enforcement**: `maxContextTokens` on NucleusConfig lets infrastructure pass the model's context window size; the callLLM loop estimates cumulative prompt tokens and forces a final answer at 85% capacity.
- **Task Scope Filtering**: `taskScope` on the resumable executor restricts which tasks execute in a DAG, enabling partial re-runs and targeted task execution.
- **Open LLM Support**: OpenAI-compatible client with presets for Ollama and vLLM; bring your own provider via configuration.
- **MCP Integration**: Discover and invoke Model Context Protocol servers as first-class tools.
- **High-Level Orchestration**: Ship the `@ddse/acm-framework` helper for wiring planning + execution behind a single call while preserving ACM v0.5 guarantees.
- **Replay & Validation**: Export/import replay bundles with ledger verification, tool-call inspection, and test fixtures.
- **Reference Implementations**: `@ddse/acm-examples` package with refund and issue-resolution workflows; `@ddse/acm-aicoder` developer experience built on the framework.

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

The primary entry point for learning the framework is the `@ddse/acm-examples` package. It ships with refund and issue-resolution workflows that exercise the runtime, planner, ledger, and replay tooling.

```bash
# Run the refund workflow with vLLM (tested with Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8)
pnpm --filter @ddse/acm-examples demo -- --provider vllm --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 --base-url http://localhost:8001/v1 --goal refund

# Switch to vLLM
pnpm --filter @ddse/acm-examples demo -- --provider vllm --model mistralai/Mistral-7B-Instruct-v0.2 --goal issues

# Inspect replay bundle output
pnpm --filter @ddse/acm-examples demo -- --goal refund --save-bundle --checkpoint-dir ./checkpoints

# Execute package tests
pnpm --filter @ddse/acm-examples test
pnpm --filter @ddse/acm-examples test:bm25
```

You can also target alternative engines via `--engine langgraph` or `--engine msaf`, relying on the adapters that ship with the monorepo.

### Shortcut: Run Planning + Execution with `@ddse/acm-framework`

When you're ready to leave the canned demos, the `@ddse/acm-framework` package gives you a typed wrapper around the planner, runtime, adapters, and nucleus wiring:

```typescript
import { ACMFramework, ExecutionEngine } from '@ddse/acm-framework';
import { createVLLMClient } from '@ddse/acm-llm';
import { SimpleCapabilityRegistry, SimpleToolRegistry } from '@ddse/acm-examples/registries';
import { MemoryLedger } from '@ddse/acm-runtime';

const llm = createVLLMClient('Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8', 'http://localhost:8001/v1');
const tools = new SimpleToolRegistry();
const capabilities = new SimpleCapabilityRegistry();
// Register your tools and capabilities here

const framework = ACMFramework.create({
  capabilityRegistry: capabilities,
  toolRegistry: tools,
  nucleus: {
    call: llm.generateWithTools!,
    llmConfig: {
      provider: llm.name(),
      model: 'Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8',
      temperature: 0.1,
      maxTokens: 512,
      baseUrl: 'http://localhost:8001/v1',
    },
    allowedTools: ['search', 'refund'],
  },
  planner: {
    planCount: 2,
    selector: ({ plans }) => plans.find((plan) => plan.id === 'plan-a') ?? plans[0],
  },
  execution: {
    engine: ExecutionEngine.ACM,
    checkpointInterval: 1,
  },
});

const ledger = new MemoryLedger();

const run = await framework.execute({
  goal: 'Investigate login failures reported overnight.',
  context: { facts: { severity: 'p1' } },
  ledger,
  engine: ExecutionEngine.LANGGRAPH, // override per-call
});

console.log(run.plan.id);
console.log(run.execution.outputsByTask);
console.log(ledger.getEntries());
```

Key behaviors surfaced by the helper:

- Automatic goal/context normalization compliant with ACM v0.5 (IDs, empty scope handling).
- Reusable `MemoryLedger` captures planner + runtime decisions for replay bundles.
- Opt-in context hydration via `ExternalContextProviderAdapter` to satisfy nucleus `request_context_retrieval` directives.
- Pluggable execution engines (`ACM`, `LANGGRAPH`, `MSAF`) with per-call overrides and resumable controls.
- Ability to skip replanning by supplying `existingPlan` or tune plan fan-out/selection.
- Hooks for verification (`verify`) and streaming sinks shared across runs.

### Local LLM Prerequisites

Most samples expect an OpenAI-compatible endpoint. We validate releases against vLLM running Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8:

- **vLLM (recommended)** — `pip install vllm`, then launch `python -m vllm.entrypoints.openai.api_server --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 --port 8001`.
- **Other providers** — Bring any OpenAI-compatible endpoint (for example, managed OpenAI, Ollama) and adjust `--provider`, `--model`, and `--base-url` accordingly.

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

- **`@ddse/acm-examples`** provides minimal, deterministic flows (refund, issues, BM25 search) that illustrate the framework fundamentals.
- **`@ddse/acm-aicoder`** demonstrates how the framework supports production-grade developer workflows (streaming UI, policy checks, resumable execution). Treat it as a case study; all surfaces still depend on the core SDK/runtime abstractions.

### Core Concepts

1. **Tool** — Typed primitive (e.g., search, create_refund) executed via a `ToolCallEnvelope`.
2. **Task** — Declarative contract binding inputs, outputs, retry policy, and tool usage.
3. **Capability** — Named task contract exposed in registries for planners to consume.
4. **Plan** — Directed acyclic graph of task nodes with guard expressions and rationale.
5. **Execution** — Runtime evaluation with policy gates, ledger capture, and replay artifacts.

## Building Your First Agent

### Option 1: Let `@ddse/acm-framework` orchestrate everything for you

```typescript
import { ACMFramework } from '@ddse/acm-framework';
import { StructuredLLMPlanner } from '@ddse/acm-planner';
import { MemoryLedger } from '@ddse/acm-runtime';
import { createVLLMClient } from '@ddse/acm-llm';
import { SimpleCapabilityRegistry, SimpleToolRegistry } from '@ddse/acm-examples/registries';

const tools = new SimpleToolRegistry();
const capabilities = new SimpleCapabilityRegistry();
// Register your tools/capabilities as shown in Option 2

const llm = createVLLMClient('Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8', 'http://localhost:8001/v1');

const framework = ACMFramework.create({
  capabilityRegistry: capabilities,
  toolRegistry: tools,
  planner: { instance: new StructuredLLMPlanner({ planCount: 3 }) },
  nucleus: {
    call: llm.generateWithTools!,
    llmConfig: {
      provider: llm.name(),
      model: 'Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8',
      baseUrl: 'http://localhost:8001/v1',
    },
  },
});

const ledger = new MemoryLedger();

const { plan, execution } = await framework.execute({
  goal: { intent: 'Greet the user in a friendly tone.' },
  context: { facts: { userName: 'Alice' } },
  ledger,
});

console.log(plan.rationale);
console.log(execution.outputsByTask['task-1']);
```

This path keeps you compliant with the spec while avoiding boilerplate. You can still override:

- `planSelector` to pick among multiple plans or reuse a cached plan.
- `existingPlan` to skip replanning during resume flows.
- `execution` options (engine, `resumeFrom`, `checkpointStore`, `runId`).
- `contextProvider` to hydrate context packets when the nucleus issues retrieval directives.

### Option 2: Work directly with SDK building blocks

#### 1. Define Tools

```typescript
import { Tool } from '@ddse/acm-sdk';

class SearchTool extends Tool<{ query: string }, { results: string[] }> {
  name() { return 'search'; }
  
  async call(input: { query: string }) {
    // Your implementation
    return { results: ['result1', 'result2'] };
  }
}
```

#### 2. Create Tasks

```typescript
import { Task, type RunContext } from '@ddse/acm-sdk';

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

#### 3. Setup Registries

```typescript
import { SimpleCapabilityRegistry, SimpleToolRegistry } from '@ddse/acm-examples/registries';

const tools = new SimpleToolRegistry();
tools.register(new SearchTool());

const capabilities = new SimpleCapabilityRegistry();
capabilities.register(
  { name: 'my-capability', sideEffects: false },
  new MyTask()
);
```

#### 4. Plan and Execute

```typescript
import { StructuredLLMPlanner } from '@ddse/acm-planner';
import { executePlan } from '@ddse/acm-runtime';
import { createVLLMClient } from '@ddse/acm-llm';

const llm = createVLLMClient('Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8', 'http://localhost:8001/v1');
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

`@ddse/acm-sdk` exports the formal ACM contracts plus helpers for building reusable components:

- `Tool<I, O>` — Base class enforcing schema-aware tool execution.
- `Task<I, O>` — Abstract task with retry policy, capability metadata, and optional Nucleus injection.
- `CapabilityRegistry` / `ToolRegistry` — Registries that planners and runtimes consume.
- `PolicyEngine`, `VerificationEngine` — Interfaces for plugging in governance logic.
- `LedgerEntry`, `ToolCallEnvelope` — Typed artifacts for audit trails and replay.
- `ExternalContextProviderAdapter` — Bridges Nucleus `request_context_retrieval` directives to developer-supplied tools and auto-promotes resulting artifacts.
- `estimateTokens(text)` — Heuristic token estimator aligned with production BudgetManager (code-aware char/token ratios).
- `NucleusConfig.maxContextTokens` — Pass the model's context window; the callLLM loop enforces an 85% safety threshold.
- `NucleusInvokeResult.metrics` — Reports `rounds`, `estimatedPromptTokens`, and `budgetExhausted` for observability.

### Runtime

`@ddse/acm-runtime` executes plans deterministically:

- `executePlan(options)` — Core engine with resumable execution and checkpointing.
- `MemoryLedger` — Append-only decision log with tamper-evident hashes.
- `evaluateGuard(expr, context)` — Guard evaluation utilities.
- `withRetry(fn, config)` — Deterministic retry/backoff.
- `taskScope` — Restrict DAG execution to a subset of tasks for partial re-runs.

### Planner

`@ddse/acm-planner` handles structured plan generation:

- `StructuredLLMPlanner.plan(options)` — Generates one or more plan candidates backed by tool-call envelopes.
- Streaming hooks and prompt digests recorded for replay bundles.

### LLM Integration

`@ddse/acm-llm` provides OpenAI-compatible clients with presets:

- `createOllamaClient(model, baseUrl?)`
- `createVLLMClient(model, baseUrl?)`
- `OpenAICompatClient` for custom providers.

### Context Retrieval Adapter

Use the `ExternalContextProviderAdapter` when you want the Nucleus preflight to hydrate missing context automatically instead of throwing an error:

```typescript
import { ExternalContextProviderAdapter, Tool } from '@ddse/acm-sdk';
import { executePlan } from '@ddse/acm-runtime';

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

- `@ddse/acm-mcp`: `McpClientManager`, `McpToolRegistry`, `CombinedToolRegistry`.
- `@ddse/acm-adapters`: `asLangGraph`, `wrapAgentNodes` to embed ACM runtime into external orchestrators.

### Replay & Tooling

- `@ddse/acm-replay`: Export/import bundles, validate ledger traces, and inspect tool-call envelopes.
- `@ddse/acm-cli` *(coming soon)*: Consolidated CLI experience that defaults to tool-native execution paths.

## Configuration

The example CLI exposes code-first flags that mirror ACM concepts:

```text
--provider <ollama|vllm>           LLM provider preset
--model <name>                     Model name to load
--base-url <url>                   Override LLM API endpoint
--engine <runtime|langgraph|msaf>  Execution engine adapter
--goal <refund|issues|...>         Example goals provided by @ddse/acm-examples
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
- ✅ Nucleus contract, structured planner tool calls, enriched telemetry (Node v0.5.0).
- ✅ Built-in `query_context` and `request_context_retrieval` tools with auto-injection and mid-invoke fulfillment.
- ✅ Anti-hallucination prompt grounding (GROUNDING RULES, VALIDATION RULES, GROUNDING CONSTRAINT).
- ✅ Token budget enforcement via `maxContextTokens` with 85% safety threshold and per-invoke metrics.
- ✅ Task scope filtering on resumable executor for partial DAG execution.

## Development Workflow

```bash
pnpm build          # Compile all packages
pnpm clean          # Remove build artefacts
pnpm dev            # Watch mode for active development
pnpm test           # Run monorepo test suites
```

Each package follows the same layout (`src/`, `dist/`, `package.json`, `tsconfig.json`) to simplify contribution and cross-package development.

## Example Library Highlights

The `@ddse/acm-examples` package showcases:

1. **Refund Flow** — Multi-step workflow with risk scoring, policy enforcement, and notifications.
2. **Issues Flow** — Read-only analysis pipeline demonstrating guard and policy evaluation.
3. **Synthetic Data & BM25** — Search utilities and deterministic test data.
4. **Replay Artifacts** — Inspectable bundles illustrating ledger fidelity.
5. **MCP Integration** — Turn-key filesystem MCP server example.

## Roadmap

Completed in Node v0.5.0 (see [`IMPLEMENTATION_PLAN_PHASE4.md`](./IMPLEMENTATION_PLAN_PHASE4.md)):

- Restored ACM v0.5 contracts across SDK/runtime/replay.
- Delivered structured planner tool calls with deterministic selection.
- Introduced the Nucleus contract and enforced tool-call discipline.
- Enhanced context orchestration with immutable internal scope handling.
- Expanded replay bundles with Nucleus inferences, policy transcripts, and tamper-evident hashes.

Next up (post v0.5.0):

- CLI consolidation (`@ddse/acm-cli`).
- Adapter improvements for checkpoint/resume in LangGraph/MSAF.
- Additional audit metadata in ledger entries (phase/decision fields, fuller LLM params).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for coding standards, testing expectations, and governance details.

## License

MIT

## Resources

- [ACM Specification v0.5](../../spec/acm-spec%20v0.5.md)
- [Implementation Plan (Phase 4) — Completed for Node v0.5.0](./IMPLEMENTATION_PLAN_PHASE4.md)
- [Resumable Executor Runbook](./docs/RUNBOOK_RESUMABLE.md)
- [Monorepo Implementation Guide](./framework-implementation-plan-node.md)
