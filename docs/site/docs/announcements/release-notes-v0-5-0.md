---
title: Release Notes — ACM Framework v0.5.0
slug: /announcements/release-notes-v0-5-0
description: Detailed highlights, compatibility notes, and roadmap items for the ACM Framework v0.5.0 release.
author: DDSE Foundation
---

**Release date:** October 06, 2025  
**Scope:** Node.js reference implementation of ACM Spec v0.5 (pnpm monorepo)  
**License:** MIT

---

## Overview

ACM v0.5.0 delivers a **Spec-First Contract Layer and Open Reference Runtime for Agentic Systems**—a contract-complete reference runtime that closes the loop from **structured planning** to **deterministic-style execution** and **replayable decision memory**. The release centers on spec-accurate artifacts (Goals, Context Packets, Plans, Capabilities, Tasks, Tools, Policy, Ledger) and provides a high-level façade to run ACM-compliant workflows with one call.

This is the **first public release**. Where we discuss fairness and enterprise readiness, we mean **enablement and design intent**. Guarantees depend on the policies, datasets, and orchestrators you configure around ACM.

---

## Highlights

### Contracts & Planning

- **Typed contracts** for Goals, Capabilities, Tasks, Tools, Policy hooks, Verification adapters, and Ledger events.
- **Structured planner** produces **plan candidates** with rationale, tool-call envelopes, and prompt digests; deterministic selectors are available for auditability.

### Runtime & Replay

- **Deterministic-style runtime** executes validated plans with **guard evaluation, retries/backoff, policy & verification hooks, checkpointing**, and **append-only decision ledger**.
- **Replay bundles** export a single audit-ready artifact combining planner outputs, ledger entries, policy outcomes, checkpoints, and task I/O.

### Interoperability & Tooling

- **Adapters** for **LangGraph** and **Microsoft Agent Framework** preserve ACM contracts while running on external engines.
- **MCP integration** (Model Context Protocol) treats external tools as first-class, discoverable capabilities.
- **`@ddse/acm-framework` façade** wires planner, runtime, nucleus config, context providers, and adapters for **one-call** execution.
- **Examples & AI Coder** demonstrate planning→execution→replay, budgeting, and streaming UX in real workflows.

---

## Quick Start

```bash
git clone https://github.com/ddse-foundation/acm.git
cd acm/framework/node
pnpm install
pnpm build
```

Run a reference demo with **vLLM** (OpenAI-compatible API on `:8001`) and **Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8**:

```bash
pnpm --filter @ddse/acm-examples demo \
  --provider vllm \  --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 \  --base-url http://localhost:8001/v1 \  --scenario entitlement
```

---

## Use-Case Samples Included

- **Entitlement Decisioning** — Policy-gated decisions with auditable rationale and supervisor notification branches.
- **Knowledge Acceleration** — Deterministic retrieval + LLM summarization under context snapshots with acceptance checks.
- **Incident Triage** — Explicit branching with `BRANCH_TAKEN` records and SLA policy hooks.
- **Invoice Reconciliation** — Idempotent compare/log flows with compensation branches and provenance.
- **Agent Coaching** — Transparent reasoning capture (nucleus inferences) with verified note storage.

Each ships as runnable examples and can export **Replay Bundles** for QA and RCA.

---

## Compatibility & Breaking Changes

- **Breaking changes:** None vs early internal 0.1.x tags. Public APIs debut in v0.5.0.
- **Node.js:** 18+
- **Monorepo:** pnpm workspace
- **Adapters:** LangGraph/MAF adapters warn when resumable flags are enabled; full checkpoint/resume parity is on the roadmap.

---

## Known Issues & Limitations (v0.5.0)

- **Adapter resumability** — Checkpoint/resume across external engines is **preview**; warnings are emitted where parity is incomplete.
- **CLI consolidation** — Package-specific CLIs remain; unified `@ddse/acm-cli` is planned.
- **Ledger enrichment** — Additional audit fields (phase markers, canonical prompt digests) are planned without API breakage.
- **Security posture** — Example policies and verification hooks are provided; threat model hardening and conformance tests are in progress.

---

## Upgrade & Migration

Fresh install for v0.5.0 is recommended.

1. **Install / build**

   ```bash
   cd acm/framework/node
   pnpm install
   pnpm build
   ```

2. **(Optional) Run with vLLM**

   ```bash
   python -m vllm.entrypoints.openai.api_server \
     --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 \
     --port 8001
   ```

3. **Execute sample workflows**

   ```bash
   pnpm --filter @ddse/acm-examples demo --scenario entitlement --save-bundle
   ```

---

## Roadmap (Post-v0.5)

- **Conformance suite** for Spec v0.5 (MUST/SHOULD tests).
- **Adapter parity** for checkpoint/resume and streaming across LangGraph/MAF.
- **Security hardening** — Policy packs, verification grammars, and example OPA/Rego recipes.
- **Python / Java ports** with spec-aligned contracts and façade.
- **Replay tooling** — Viewer/validator and OpenTelemetry export.

---

## Acknowledgments

Thanks to the DDSE Foundation engineering team and early users who validated planning→execution→replay end-to-end and contributed docs, adapters, and feedback.

---

**Project:** [github.com/ddse-foundation/acm](https://github.com/ddse-foundation/acm)  
**Contact:** [DDSE Foundation](https://ddse-foundation.github.io/)
