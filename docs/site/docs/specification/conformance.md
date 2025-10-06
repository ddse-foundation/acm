---
id: conformance
sidebar_position: 3
title: Conformance Checklist
---

Use this conformance checklist to verify implementations of ACM `v0.5` across languages.

## Planner requirements

- [ ] Plans reference an immutable `contextRef` and include rationale and prompt digests.
- [ ] Planner alternatives recorded with selection metadata and guard coverage.
- [ ] Planner generates tool-call envelopes referencing Capability and Task IDs only.

## Runtime requirements

- [ ] Tasks execute with idempotency keys and typed error taxonomy (`RETRYABLE`, `FATAL`, `COMPENSATION_REQUIRED`).
- [ ] Policy hooks invoked before and after tasks; denial triggers compensations or manual approvals.
- [ ] Verification hooks run synchronously and log structured outcomes.
- [ ] Ledger records all lifecycle events with schema version `v0.5`.

## Artifact management

- [ ] Capability Maps, Task Specs, Tool Catalog entries version-controlled with semantic versions.
- [ ] Context Packet builder emits digests, provenance, and augmentation metadata.
- [ ] Replay bundles produced for every non-development run.

## Governance & operations

- [ ] Retention policies documented for ledger and replay artifacts (≥180 days production).
- [ ] Policy bundles and verification rules peer-reviewed and signed by governance leads.
- [ ] Automated drift detection monitors schema changes and plan/ledger anomalies.

## Certification workflow

1. Run `pnpm acm-spec validate` to check artifact schemas.
2. Execute smoke scenario (`pnpm acm-examples run refund`) and ensure replay bundle passes verification.
3. Capture governance sign-off in release notes referencing bundle IDs.
4. Tag release with `v0.5.x` and publish documentation updates.
