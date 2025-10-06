---
id: overview
sidebar_position: 1
title: Governance Overview
---

ACM governance is the discipline that keeps stochastic planning aligned with deterministic execution, policy expectations, and audit controls. Every production deployment SHOULD treat governance as a first-class concern and budget engineering capacity for it.

## Governance goals for v0.5

- **Traceability** — every planner and runtime decision is anchored to artifacts captured in the Replay Bundle.
- **Reproducibility** — the same Goal and Context Packet MUST lead to the same Plan selection and execution path unless policy hooks override it.
- **Policy compliance** — Tasks execute only after policy decisions return `allow` and verdicts are durably recorded in the ledger.
- **Risk containment** — capability catalogs, guardrails, and rate policies are versioned so that unapproved tools never reach runtime.

## Responsibilities by role

| Persona | Responsibilities |
| --- | --- |
| **Platform engineer** | Maintain Capability Maps, Task Specs, replay pipelines, and retention schedules. |
| **Governance/risk** | Define policy evaluation rules, review ledger anomalies, and co-sign release templates. |
| **Solution team** | Contribute Goal/Plan templates, register Tasks, and surface new policy needs. |
| **Auditor** | Validate Replay Bundles, re-run deterministic checks, and sign off on major changes. |

## Runbook anchors

- [Decision ledger obligations](./decision-ledger.md)
- [Replay bundle assembly](./replay-bundles.md)
- [Policy and verification hooks](./policy-checks.md)
- [Compliance checklist](./compliance.md)

## Versioning stance

All governance assets (policies, schemas, ledger definitions, retention configs) MUST live under source control and reference the current release `v0.5.0`. Breaking changes SHALL be introduced alongside a version bump and follow the same change-management workflow as code.
