---
id: glossary
sidebar_position: 3
title: Glossary
---

Key terms used throughout the ACM documentation.

| Term | Definition |
| --- | --- |
| **ACM** | Agentic Contract Model — the specification governing planning, execution, and governance contracts. |
| **Context Packet** | Immutable snapshot of facts, augmentations, and provenance used for planning. |
| **Capability Map** | Catalog of system-guaranteed capabilities, each with schemas and invariants. |
| **Task Spec** | Execution contract for a task, including policy/verification hooks and tool bindings. |
| **Decision Ledger** | Append-only log capturing planner, runtime, policy, and verification events. |
| **Replay Bundle** | Archive of artifacts sufficient to reproduce or audit an execution. |
| **Nucleus** | Deterministic LLM gateway used by planners to generate plans. |
| **Policy Hook** | Externalized rule evaluation invoked before/after task execution. |
| **Verification Hook** | Post-task assertion ensuring acceptance criteria are satisfied. |
| **Capability Drift** | Scenario where planner references a capability version not deployed in runtime; detected via registries. |
