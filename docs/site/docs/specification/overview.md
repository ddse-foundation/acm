---
id: overview
sidebar_position: 1
title: Specification Overview (v0.5)
---

The ACM specification `v0.5` is the canonical contract linking planning, deterministic execution, and governance. This page highlights the key elements and explains how to map them to framework components.

## What changed in v0.5

- Consolidated scope — previous v0.1 and v0.2 drafts merged into a single normative document.
- Context Lifecycle — explicit ingest → snapshot → augment → version phases; planners MUST use an immutable Context Packet.
- Decision Memory — mandatory ledger entries covering planner, runtime, and policy events.
- Replay Bundles — defined structure and conformance checks to guarantee deterministic or near-deterministic reproduction.
- Plan Alternatives — normative guidance on multiple plan candidates and selection rationale.

## Core abstractions

| Artifact | Responsibility | Framework mapping | Spec section |
| --- | --- | --- | --- |
| **Goal Card** | Captures business intent, constraints, acceptance criteria. | `@ddse/acm-sdk` goal helpers; `docs/site/docs/get-started/quickstart.md` for creation flow. | §5.1 |
| **Capability Map** | Catalog of approved capabilities with IO schemas and invariants. | `packages/acm-sdk` capability registry. | §5.2 |
| **Context Packet** | Immutable snapshot used for planning and policy. | `packages/acm-runtime` context builder + adapters. | §5.3 |
| **Plan Set** | DAG of tasks plus alternatives and guard semantics. | `packages/acm-planner` planner outputs. | §5.4 |
| **Task Spec** | Execution contract tied to capability and tools. | `packages/acm-runtime` task contracts. | §5.5 |

## Conformance artifacts

A system advertises ACM conformance when it can generate and validate:

- Goal, Plan, Capability, Context, Task, Tool artifacts following v0.5 schemas.
- Decision ledger entries for the lifecycle of every execution.
- Replay bundles satisfying the mandatory contents checklist.
- Policy and verification hooks that run before and after tasks.

## References

- [ACM Specification v0.5](https://github.com/ddse-foundation/acm/blob/main/spec/acm-spec%20v0.5.md)
- [Framework architecture](https://github.com/ddse-foundation/acm/blob/main/framework/architecture.md)
- [Governance checklist](../governance/compliance.md)
