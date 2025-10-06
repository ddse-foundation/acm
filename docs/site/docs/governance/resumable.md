---
id: resumable
sidebar_position: 6
title: Resumable Execution Runbook
---

Resumable execution ensures long-running ACM workflows can pause, recover, and continue without losing deterministic guarantees.

## Responsibilities

- Persist checkpoints after every task boundary with ledger correlation IDs.
- Store checkpoint payloads in durable storage (S3, Blob, GCS) with retention aligned to replay bundles.
- Track resume tokens inside the decision ledger (`TASK_RESUMED`, `TASK_WAITING`).

## Recovery flow

1. Runtime detects failure or external pause signal.
2. Operator inspects ledger entries and selects a checkpoint via CLI (`pnpm --filter @ddse/acm-runtime run resume --from <id>`).
3. Policy and verification hooks re-evaluate before resuming downstream tasks.
4. Replay bundles merge original and resumed segments for full audit coverage.

## References

- `framework/node/docs/tdr/RUNBOOK_RESUMABLE.md`
- `framework/node/docs/tdr/RUNBOOK_RESUMABLE.md#decision-ledger` for event taxonomy
