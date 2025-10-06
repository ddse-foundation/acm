# ACM Framework

[![ACM Spec](https://img.shields.io/badge/ACM%20Spec-v0.5-0b7285.svg)](spec/acm-spec%20v0.5.md)
[![Release](https://img.shields.io/badge/release-v0.5.0-2563eb.svg)](framework/node/CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-22c55e.svg)](LICENSE)
[![Runtime](https://img.shields.io/badge/runtime-node%2018+-f59e0b.svg)](framework/node/README.md#prerequisites)
[![pnpm](https://img.shields.io/badge/pnpm-monorepo-eb6f92.svg)](framework/node/pnpm-workspace.yaml)

An industry-grade reference implementation of the **Agentic Contract Model (ACM) v0.5** - **A Spec‑First Contract Layer and Open Reference Runtime for Agentic Systems**, delivering contract-first planning, deterministic execution, and replayable decision memory across AI agent stacks. This monorepo hosts the canonical Node.js implementation, specification artifacts, and cross-language architecture guidance.

> 📢 **ACM v0.5** introduces fully typed capability maps, resumable execution, nucleus-governed LLM usage, and replay bundles engineered for regulated environments.

---

## Table of Contents

- [Why ACM?](#why-acm)
- [Feature Highlights](#feature-highlights)
- [Documentation Index](#documentation-index)
- [Monorepo at a Glance](#monorepo-at-a-glance)
- [Package Matrix](#package-matrix)
- [Quick Start](#quick-start)
- [Plan → Execute → Replay Flow](#plan--execute--replay-flow)
- [Architecture Overview](#architecture-overview)
- [Governance & Compliance](#governance--compliance)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Resources & Support](#resources--support)
- [License](#license)

---

## Why ACM?

Traditional agent stacks mix stochastic planning with imperative code, making audits and safety reviews brittle. ACM adds a **contract layer** that binds plans, tools, tasks, and policies into versioned artifacts so you can:

- ✅ **Prove compliance** &mdash; Ship append-only ledgers, guard evaluations, and replay bundles for every run.
- ✅ **Control tool access** &mdash; Curate capabilities and tool envelopes planners may target.
- ✅ **Standardize planning** &mdash; Preserve planner alternatives, rationale, and prompt hashes for reproducibility.
- ✅ **Resume safely** &mdash; Checkpoint deterministic runtime progress and restart mid-plan.
- ✅ **Integrate anywhere** &mdash; Bridge ACM contracts to LangGraph, Microsoft Agent Framework, MCP servers, or custom runtimes with minimal glue.

The framework follows the [ACM specification](spec/acm-spec%20v0.5.md), treating Goal, Context Packet, Plan, Capability, Task, Tool, Policy, and Ledger as first-class artifacts.

---

## Feature Highlights

| Pillar | What You Get | Key Packages |
|--------|---------------|---------------|
| **Contract-First SDK** | Typed contracts for tools, tasks, capabilities, ledger entries, guard expressions, policy hooks, and verification adapters. | [`@ddse/acm-sdk`](framework/node/packages/acm-sdk/README.md) |
| **Structured Planning** | Multi-plan generation with rationale, prompt digests, tool-call envelopes, and deterministic selectors. | [`@ddse/acm-planner`](framework/node/packages/acm-planner/README.md) |
| **Deterministic Runtime** | Guard evaluation, policy gates, retries/backoff, checkpointing, streaming sinks, and ledger emission. | [`@ddse/acm-runtime`](framework/node/packages/acm-runtime/README.md) |
| **High-Level Orchestrator** | Single-call helper that wires planner, runtime, nucleus, context providers, and adapters. | [`@ddse/acm-framework`](framework/node/packages/acm-framework/README.md) |
| **Adapters & Integrations** | LangGraph / Microsoft Agent Framework bridges plus Model Context Protocol tooling. | [`@ddse/acm-adapters`](framework/node/packages/acm-adapters/README.md), [`@ddse/acm-mcp`](framework/node/packages/acm-mcp/README.md) |
| **Replay & Analysis** | Export/import replay bundles with ledger verification and tool-call inspection. | [`@ddse/acm-replay`](framework/node/packages/acm-replay/README.md) |
| **Reference Experiences** | Deterministic demos and a production-style AI coding assistant with budgeting and streaming UX. | [`@ddse/acm-examples`](framework/node/packages/acm-examples/README.md), [`@ddse/acm-aicoder`](framework/node/packages/acm-aicoder/README.md) |

---

## Documentation Index

- 📘 **Specification:** [ACM Spec v0.5](spec/acm-spec%20v0.5.md)
- 🧭 **Architecture Narrative:** [framework/architecture.md](framework/architecture.md)
- 🏗️ **Implementation Plans:** [framework/node/docs/tdr/](framework/node/docs/tdr/)
- ⚙️ **Framework Guide:** [framework/node/README.md](framework/node/README.md)
- 🧾 **Use Cases & Capability Map:** [`ACM Usecases and Capabilities.md`](ACM%20Usecases%20and%20Capabilities.md)
- 📄 **Whitepaper:** [WHITEPAPER.md](WHITEPAPER.md)
- 🧪 **Testing Strategy:** [framework/node/TESTING.md](framework/node/TESTING.md)
- 🚀 **Getting Started:** [framework/node/GETTING_STARTED.md](framework/node/GETTING_STARTED.md)

---

## Monorepo at a Glance

```text
acm/
├── README.md                 # This document
├── LICENSE                   # MIT license for the project
├── spec/                     # ACM specifications and rationale
├── framework/
│   ├── architecture.md       # Cross-language architecture blueprint
│   ├── node/                 # Node.js reference implementation (pnpm workspace)
│   └── java/, python/        # Language ports (under active development)
└── WHITEPAPER.md             # Strategic positioning and vision
```

---

## Package Matrix

| Package | Description | Status |
|---------|-------------|--------|
| [`@ddse/acm-sdk`](framework/node/packages/acm-sdk/) | Base contracts, registries, policy/verification interfaces, ledger types. | ✅ Stable @ v0.5.0 |
| [`@ddse/acm-runtime`](framework/node/packages/acm-runtime/) | Deterministic runtime, checkpointing, resumable execution, guard evaluation. | ✅ Stable @ v0.5.0 |
| [`@ddse/acm-planner`](framework/node/packages/acm-planner/) | Structured LLM planner with plan alternatives, prompt hashing, tool envelopes. | ✅ Stable @ v0.5.0 |
| [`@ddse/acm-framework`](framework/node/packages/acm-framework/) | High-level façade combining planner + runtime + nucleus wiring. | ✅ Stable @ v0.5.0 |
| [`@ddse/acm-llm`](framework/node/packages/acm-llm/) | OpenAI-compatible clients for Ollama, vLLM, and custom providers. | ✅ Stable @ v0.5.0 |
| [`@ddse/acm-adapters`](framework/node/packages/acm-adapters/) | LangGraph/MSAF adapters preserving ACM contracts. | ✅ Stable @ v0.5.0 |
| [`@ddse/acm-mcp`](framework/node/packages/acm-mcp/) | Model Context Protocol tooling and registries. | ✅ Stable @ v0.5.0 |
| [`@ddse/acm-replay`](framework/node/packages/acm-replay/) | Replay bundle export/import, ledger validation utilities. | ✅ Stable @ v0.5.0 |
| [`@ddse/acm-examples`](framework/node/packages/acm-examples/) | CLI demos, refund/issue flows, replay bundle samples. | ✅ Stable @ v0.5.0 |
| [`@ddse/acm-aicoder`](framework/node/packages/acm-aicoder/) | Developer assistant with streaming TUI and budgeting. | ✅ Stable @ v0.5.0 |

> **Language Ports:** Python and Java bindings follow the same specification and architecture; see `framework/python/` and `framework/java/` for progress trackers.

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- [pnpm](https://pnpm.io/) ≥ 8
- Optional: [Ollama](https://ollama.ai) or [vLLM](https://docs.vllm.ai) for local LLM experiments

### Install & Build

```bash
git clone https://github.com/ddse-foundation/acm.git
cd acm/framework/node
pnpm install
pnpm build
```

### Run Reference Demo

```bash
# Refund workflow demo with vLLM (tested with Qwen)
pnpm --filter @ddse/acm-examples demo -- --provider vllm --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 --base-url http://localhost:8001/v1 --goal refund

# Export a replay bundle while running the issue-resolution flow
pnpm --filter @ddse/acm-examples demo -- --goal issues --save-bundle --checkpoint-dir ./checkpoints
```

### Launch the AI Coder Experience

```bash
pnpm --filter @ddse/acm-aicoder demo \
  --provider vllm \
  --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 \
  --base-url http://localhost:8001/v1 \
  --workspace $PWD/../../
```

### Build Your First Plan Programmatically

```typescript
import { ACMFramework, ExecutionEngine } from '@ddse/acm-framework';
import { SimpleCapabilityRegistry, SimpleToolRegistry } from '@ddse/acm-examples/registries';
import { createVLLMClient } from '@ddse/acm-llm';
import { MemoryLedger } from '@ddse/acm-runtime';

const registry = new SimpleCapabilityRegistry();
const tools = new SimpleToolRegistry();
const llm = createVLLMClient('Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8', 'http://localhost:8001/v1');

const framework = ACMFramework.create({
  capabilityRegistry: registry,
  toolRegistry: tools,
  nucleus: {
    call: llm.generateWithTools!,
    llmConfig: {
      provider: llm.name(),
      model: 'Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8',
      temperature: 0.1,
      baseUrl: 'http://localhost:8001/v1',
    },
    allowedTools: tools.listNames(),
  },
  planner: { planCount: 2 },
  execution: { engine: ExecutionEngine.ACM, checkpointInterval: 1 },
});

const ledger = new MemoryLedger();
const run = await framework.execute({
  goal: 'Resolve a priority refund ticket for order 1234.',
  context: { facts: { orderId: '1234', severity: 'P1' } },
  ledger,
});

console.log(run.plan.id);
console.log(run.execution.outputsByTask);
```

---

## Plan → Execute → Replay Flow

1. **Normalize Goal & Context** — IDs, provenance, and scope metadata are enforced before planning.
2. **Structured Planning** — `@ddse/acm-planner` generates multiple plan candidates with rationale, tool envelopes, and prompt hashes recorded in the ledger.
3. **Policy-Aware Execution** — `@ddse/acm-runtime` executes the selected plan, evaluates guards, invokes policy and verification hooks, and checkpoints progress.
4. **Ledger & Replay** — Every planner and runtime decision streams into the `MemoryLedger`, enabling replay bundle export via `@ddse/acm-replay` for audits, testing, or regression harnesses.
5. **Adapters & Integrations** — Optional hooks route execution through LangGraph/MSAF engines or hydrate context via MCP tools without breaking ACM contracts.

---

## Architecture Overview

- **Three-Layer Intent:** Planner (reasoning), Framework (coordination), Runtime (deterministic execution) &mdash; see [framework/architecture.md](framework/architecture.md).
- **Nucleus Gateway:** Centralized LLM governance with prompt hashing, deterministic tool allow-lists, and streaming support.
- **External Context Provider Adapter:** Bridges nucleus context directives (`request_context_retrieval`) to developer-owned retrieval tools.
- **Decision Memory:** Append-only ledger + checkpoints produce tamper-evident replay bundles for compliance and analytics.
- **Interoperability:** Adapters maintain parity with popular agent ecosystems while preserving ACM guarantees.

Refer to the sequence diagrams in [framework/architecture.md](framework/architecture.md#32-end-to-end-data-flow) for deep dives.

---

## Governance & Compliance

- **Policy Engine Hooks** — Connect Open Policy Agent (OPA/Rego) or custom evaluators via `PolicyEngine` interfaces.
- **Verification Grammar** — Enforce acceptance criteria separate from task logic through `VerificationEngine` adapters.
- **Tool & Capability Certification** — Registry-driven capability maps ensure planners only target approved execution paths.
- **Replay Bundles** — Capture planner outputs, runtime telemetry, policies, and checkpoints in one exportable artifact.
- **Audit Trails** — Ledger entries include plan IDs, guard outcomes, retries, verification results, and tool-call digests.

Runbook for resumable execution lives in [framework/node/docs/tdr/RUNBOOK_RESUMABLE.md](framework/node/docs/tdr/RUNBOOK_RESUMABLE.md).

---

## Roadmap

- ✅ **v0.5.0 (Current)** — Contract-complete Node implementation, resumable runtime, replay bundles, MCP integration, AI Coder experience.
- 🚧 **Python Port** — Tracking in `framework/python/` with parity milestones.
- 🚧 **Java Port** — Tracking in `framework/java/` aligned to the same spec artifacts.
- 🧭 **Future** — Unified CLI (`@ddse/acm-cli`), extended verification grammars, hosted replay dashboards.

Detailed plans live in:

- [Phase 1–4 Implementation Plans](framework/node/docs/tdr/)
- [TDR: Resumable Executor](framework/node/docs/tdr/001-resumable-executor.md)

---

## Contributing

We welcome contributions across contracts, runtime, adapters, and language ports.

- Read the [Contribution Guide](framework/node/CONTRIBUTING.md) for branching, coding standards, and CI tasks.
- Explore [framework/node/TESTING.md](framework/node/TESTING.md) to understand per-package test surfaces.
- Bug reports and feature ideas belong in [GitHub Issues](https://github.com/ddse-foundation/acm/issues).

Before submitting a PR, run `pnpm build` from `framework/node/` to ensure cross-package builds succeed.

---

## Resources & Support

- 📂 **Examples:** [framework/node/packages/acm-examples/](framework/node/packages/acm-examples/)
- 🧑‍💻 **AI Coder Docs:** [framework/node/packages/acm-aicoder/docs/](framework/node/packages/acm-aicoder/docs/)
- 🔌 **Adapters:** [framework/node/packages/acm-adapters/](framework/node/packages/acm-adapters/)
- 🧠 **LLM Gateway:** [framework/node/packages/acm-llm/](framework/node/packages/acm-llm/)
- 📝 **Change Log:** [framework/node/CHANGELOG.md](framework/node/CHANGELOG.md)
- 🙋 **Questions?** Open a discussion or ping the maintainers via GitHub Issues.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

**Author:** Mahmudur R. Manna — Founder & Principal Architect, DDSE Foundation (Dhaka, Bangladesh)
