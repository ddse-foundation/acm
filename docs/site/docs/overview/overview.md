---
id: overview
sidebar_position: 1
title: Why Agentic Contract Model?
---

The Agentic Contract Model (ACM) is a **spec-first contract layer** that makes AI agent systems auditable, resumable, and enterprise ready. The v0.5.0 release bundles a production grade Node.js reference implementation with typed contracts, replay bundles, and a governance surface designed for regulated industries.

## What problems does ACM solve?

- **Unverifiable plans** → Plans are generated as typed task graphs with context hashes, rationale, and verification guards.
- **Opaque execution** → The runtime records every guard, policy decision, and tool call inside an append-only ledger that can be replayed later.
- **LLM drift** → Planning is deterministic, alternatives are stored, and existing plans can be replayed without re-querying the LLM.
- **Compliance gaps** → Policy and verification engines enforce safety gates before and after every task, while replay bundles ship the entire audit trail.
- **Resume failures** → Checkpoints allow long-running flows to resume exactly where they stopped.

## v0.5.0 highlights

- ✅ Fully typed capability maps and registries
- ✅ Deterministic planner with Plan-A/Plan-B alternatives and safe fallbacks
- ✅ Resumable execution with checkpoint stores and replay bundles
- ✅ Nucleus governance layer for LLM usage, streaming, and context directives
- ✅ Reference experiences: five deterministic workflows and the ACM AI Coder TUI
- ✅ MCP, LangGraph, and Microsoft Agent Framework adapters

> **Versioning** — This documentation tracks ACM **v0.5.0**. Future versions will appear beside this one via Docusaurus doc versioning, so teams can adopt features at their own pace.

## How the docs are organised

| Section | What you will learn |
| ------- | ------------------- |
| [Get Started](../get-started/quickstart.md) | Install the framework, run demos, and ship your first agent. |
| [Core Concepts](../core-concepts/introduction.md) | Understand goals, capabilities, plans, tasks, tools, and ledgers. |
| [Packages](../packages/index.md) | Deep dives into each npm package in the monorepo. |
| [Scenarios](../scenarios/examples.md) | Five guided workflows that show ACM in action. |
| [AI Coder](../ai-coder/overview.md) | Operate the full interactive developer assistant. |
| [Integrations](../integrations/overview.md) | Wire ACM into LangGraph, MSAF, MCP servers, and custom context providers. |
| [Governance](../governance/overview.md) | Enforce policies, verification, replay, and resumable execution. |
| [Specification](../specification/overview.md) | Follow the spec, whitepaper, and implementation plans. |
| [Contribute](../contribute/overview.md) | Become a maintainer, run tests, and publish packages. |

## ACM pillars

1. **Plan** — Generate multiple plan candidates with structured tool-call envelopes and rationale.
2. **Execute** — Run plans deterministically with guard evaluation, policies, verification, and streaming.
3. **Replay** — Export full decision memories for compliance, analytics, and reproducibility.
4. **Integrate** — Plug into existing orchestrators (LangGraph/MSAF), retrieval layers (MCP), and developer tooling (AI Coder).

![Plan → Execute → Replay flow](/img/plan-execute-replay.svg)

## Next steps

- Follow the [Quick Start guide](../get-started/quickstart.md) to build and run the examples.
- Skim the [Core Concepts](../core-concepts/introduction.md) to map ACM artifacts to your use cases.
- Explore the [Scenario Playbook](../scenarios/examples.md) to see end-to-end flows you can copy into your organisation.
