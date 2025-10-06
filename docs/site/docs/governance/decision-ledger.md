---
id: decision-ledger
sidebar_position: 2
title: Decision Ledger Obligations
---

The **Decision Ledger** is the canonical audit trail for ACM deployments. It combines planner events, runtime lifecycle, policy verdicts, verification outcomes, context promotions, and streaming updates into an append-only log.

## Required events

Every execution MUST record the following entries:

- `PLAN_GENERATED` — planner outputs with plan IDs, rationale, prompt hashes, and context references.
- `PLAN_SELECTED` — final choice with selector metadata and approvals.
- `TASK_*` — lifecycle entries for each task (`SCHEDULED`, `STARTED`, `SUCCEEDED`, `FAILED`, `COMPENSATED`). Include capability version, idempotency key, and ledger correlation IDs.
- `GUARD_EVALUATED` — guard expressions evaluated with captured inputs and boolean result.
- `POLICY_DECISION` — policy engine verdict, policy bundle digest, decision rationale, and SLA latency.
- `VERIFICATION_RESULT` — verification hook outcomes and referenced acceptance criteria.
- `CONTEXT_PROMOTION` — artifacts promoted from the internal scope to the Context Packet.
- `REPLAY_PACKAGE_CREATED` — path or identifier of the archived bundle.

## Schema contract

Ledger entries SHOULD conform to an Avro or JSON Schema. The reference schema shipped with `@ddse/acm-runtime` includes:

```json title="ledger-entry.schema.json" description="Simplified"{}
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["id", "timestamp", "type", "payload", "version"],
  "properties": {
    "id": {"type": "string"},
    "timestamp": {"type": "string", "format": "date-time"},
    "type": {"type": "string"},
    "version": {"type": "string", "const": "v0.5"},
    "actor": {"type": "string"},
    "payload": {"type": "object"},
    "correlationId": {"type": "string"}
  }
}
```

Teams MAY extend payload definitions with domain-specific metadata, but MUST preserve the base fields to remain replay-compatible.

## Storage and retention

- **Persistence:** Default backing store is append-only object storage or a managed ledger (e.g., DynamoDB streams, Kafka compacted topics).
- **Retention:** Minimum retention period is 180 days for production workloads. Align with regulatory requirements per jurisdiction.
- **Integrity:** Ledger segments SHOULD be content-addressed and optionally signed. Store digest manifests alongside replay bundles.

## Operational practices

- Automate drift detection (schema diffs, missing event types).
- Stream ledger events to observability tools for near-real-time policy monitoring.
- Provide redaction workflows for privacy requests without breaking hash chains (store tombstone receipts).

## References

- `spec/acm-spec v0.5.md` — Sections 4.0 and 5.3 (Context lifecycle) and 5.4 (Plan obligations)
- `framework/node/docs/tdr/RUNBOOK_RESUMABLE.md` — Resumable execution and ledger recovery procedure
