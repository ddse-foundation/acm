---
id: replay-bundles
sidebar_position: 3
title: Replay Bundle Assembly
---

Replay Bundles replicate a full agent run for audit, debugging, or regression testing. Every production execution SHOULD emit an archive that satisfies the normative checklist in the ACM v0.5 specification.

## Bundle structure

```text
replay/
  goal/
    goal-card.yaml
  context/
    context-packet.yaml
    augmentations/
  plan/
    plan-set.yaml
    planner-telemetry.json
  runtime/
    task-specs/
    outputs/
    policy/
    verification/
  ledger/
    entries.jsonl
    manifest.json
  nucleus/
    prompt-digests.json
    completions/
  metadata.json
```

## Minimum contents

- **Goal Card** matching the executed goal ID.
- **Context Packet** with immutable digests and provenance metadata.
- **Plan Set** with selected plan ID and alternatives.
- **Task Specs** referenced by the plan, frozen to the execution versions.
- **Ledger Entries** covering planner, runtime, policy, verification events.
- **Nucleus Artifacts** capturing prompts, responses, and randomness seeds.
- **Policy & Verification Bundles** including rulesets, model versions, and result assertions.

## Packaging workflow

1. Runtime signals `REPLAY_PREPARE` when all tasks reach a terminal state.
2. Replay builder process gathers artifacts from registries and object storage using correlation IDs.
3. Builder validates schema conformity, signs digests, and emits `REPLAY_PACKAGE_CREATED` ledger entry.
4. Archive is persisted to long-term storage (S3, Azure Blob) with lifecycle policies.
5. Optional: push bundle metadata to catalog service for discovery and re-run scheduling.

## Quality gates

- Validate against JSON Schema templates shipped in `@ddse/acm-replay`.
- Ensure bundle builds complete within SLA (default 120 seconds) to avoid blocking feedback loops.
- Run smoke replay after packaging for critical workflows (refunds, onboarding, etc.).

## Usage patterns

- **Audit:** Provide auditors read-only access and run guided replays using CLI (`pnpm replay --bundle path`).
- **Regression:** Reuse bundles as fixtures in integration tests to detect planner or runtime regressions.
- **Analytics:** Mine ledger manifests for optimization opportunities (latency, policy hits).

## References

- `spec/acm-spec v0.5.md` — Section 0 Scope, Replay Bundle obligations
- `framework/node/docs/tdr/RUNBOOK_RESUMABLE.md`
