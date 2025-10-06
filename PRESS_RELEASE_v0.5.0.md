# Press Release

**For Immediate Release**  
**October 06, 2025**

## DDSE Foundation Announces Agentic Contract Model (ACM) Framework v0.5.0 — A Spec‑First Contract Layer and Open Reference Runtime for Agentic Systems

**Dhaka, Bangladesh** — The DDSE (Decision Driven Software Engineering) Foundation today announced **ACM Framework v0.5.0**, the first public release of its open, spec‑first contract layer for agentic systems and the accompanying Node.js reference implementation. Version 0.5.0 focuses on **contract‑complete artifacts, deterministic‑style execution, and replayable decision memory**, enabling engineering teams to build AI‑assisted workflows that are **auditable, reproducible, and integrable** with existing orchestrators.

“Agents only become enterprise‑friendly when their plans, tools, and decisions are first‑class artifacts,” said **Mahmudur R. Manna**, Founder of the DDSE Foundation. “With ACM v0.5, we make those artifacts **typed, versioned, and replayable** so that teams can reason about agent behavior the same way they reason about software.”

### What’s in v0.5.0

- **Contract‑first model (Spec v0.5)** — Goals, Context Packets, Plans, Capabilities, Tasks, Tools, Policy and Ledger are treated as **versioned artifacts**. Plans are validated against **capability maps** before execution to reject hallucinated steps.
- **Structured planning → deterministic‑style runtime** — A structured planner emits plan candidates with rationale, prompt digests, and tool‑call envelopes. The runtime executes plans with **guards, retries/backoff, policy/verification hooks, checkpointing**, and **append‑only decision ledger**.
- **Replay bundles** — Every run can export a **single bundle** containing planner outputs, tool envelopes, ledger entries, policy decisions, checkpoints, and task I/O — supporting audits, RCA, and regression testing.
- **Adapters & interoperability** — Bridges to **LangGraph** and **Microsoft Agent Framework** preserve ACM contracts while executing in external engines. **MCP (Model Context Protocol)** tools are discoverable as first‑class integrations.
- **Developer experience** — A high‑level `@acm/framework` façade wires planner, runtime, nucleus configuration, context providers, and adapters so teams can execute ACM‑compliant workflows with **one call**. Reference demos and an **AI Coder** TUI illustrate end‑to‑end planning→execution→replay.

### Reference Use Cases (included in repo)

- **Entitlement Decisioning** — Policy‑gated decisions with auditable rationale and supervisor notification paths.  
- **Knowledge Acceleration** — Deterministic retrieval + LLM summarization under context snapshots with acceptance checks.  
- **Incident Triage** — Branching plans with explicit `BRANCH_TAKEN` records and SLA policy hooks.  
- **Invoice Reconciliation** — Idempotent compare/log flows with compensation branches and provenance.  
- **Agent Coaching** — Transparent reasoning capture (nucleus inferences) with verified storage of coaching notes.

These showcase ACM’s contract layer converting stochastic planning into **reproducible execution** across common enterprise workflows.

### Availability & Quick Start

ACM Framework v0.5.0 is available today under the **MIT License**. The reference implementation targets **Node.js 18+** in a **pnpm** monorepo. Quick start:

```bash
git clone https://github.com/ddse-foundation/acm.git
cd acm/framework/node
pnpm install
pnpm build

# Run a reference demo with vLLM/Qwen (OpenAI-compatible server on :8001)
pnpm --filter @acm/examples demo -- \
  --provider vllm \  --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 \  --base-url http://localhost:8001/v1 \  --scenario entitlement
```

### Notes on v0.5

This is the **first public release** of the ACM spec and reference runtime. Claims in this announcement describe **current capabilities** and a **clear roadmap** toward enterprise‑readiness. In particular, ACM v0.5 **enables** auditability, policy enforcement points, and reproducibility; **fairness guarantees** depend on the policies and datasets organizations configure.

### Call to Action

- **Explore the repo** — Read the spec, architecture notes, and examples; export a replay bundle from a demo run. 
- **Integrate** — Use adapters to execute ACM plans on your preferred orchestrator or agent engine.
- **Collaborate** — Join us on GitHub to contribute adapters, verification grammars, or conformance tests.
- **Pilot** — Partner with the DDSE Foundation on regulated‑industry pilots and evidence‑building benchmarks.

**Media Contact** 
manna.mahmud.bd@gmail.com
[DDSE Foundation](https://ddse-foundation.github.io/)
**Project**  
https://github.com/ddse-foundation/acm