# ACM Node Framework — Phase 2 Implementation Plan

_Tracks_: `acm-aicoder-demo-cli` (developer-first CLI) and `ResumableExecutor` (checkpoint + resume support)

## 1. Snapshot

| Track | Goal | Primary Owner | Target Outcome |
| --- | --- | --- | --- |
| CLI | Deliver an installable `acm-aicoder-demo` CLI that exercises the full ACM flow with provider/model/engine flags, live streaming, MCP toggles, and replay bundle exports. | Runtime DX | GA-ready CLI published to npm with documentation, examples, and CI coverage. |
| Resumable Executor | Add checkpointing and resume semantics to `@ddse/acm-runtime`, enabling executions to pause/restart with deterministic replay safety. | Runtime Core | Stable `ResumableExecutor` class with pluggable stores, adapter integrations, and acceptance tests. |

### Cross-cutting success criteria

- TypeScript strict builds green (`pnpm lint`, `pnpm build`, `pnpm test`).
- Documentation audited/updated (`README`, `GETTING_STARTED`, `TESTING`).
- Replay bundles backward-compatible; existing SDK/runtime APIs remain source-compatible for current adopters.

## 2. Workstream Roadmaps

### 2.1 Resumable Executor Track

| Phase | Scope | Exit Criteria |
| --- | --- | --- |
| **R0 – Design & contracts** | ADR covering checkpoint cadence, storage contract, ledger alignment, failure semantics. | Stakeholders sign off; no breaking API changes pending. |
| **R1 – Checkpoint generation** | Emit deterministic checkpoints after each task/guard via MemoryLedger snapshots and serializer. | `pnpm --filter @ddse/acm-runtime test` passes; checkpoints stable across re-runs. |
| **R2 – Resume semantics** | Implement `ResumableExecutor` that hydrates from checkpoint and continues execution with feature flag. | Resumed runs yield identical outputs/ledger as uninterrupted run. |
| **R3 – Adapter integration** | Update LangGraph/MSAF adapters to accept resume metadata with safe fallbacks. | Cross-adapter tests green; fallback path documented. |
| **R4 – Hardening & DX** | Provide store implementations, CLI resume flag, tracing/docs, replay compatibility tests. | Manual smoke resumes succeed; docs and runbook approved. |

#### Key deliverables by phase (Resumable)

- **R0**: ADR (`docs/adr/00X-resumable-executor.md`), `CheckpointStore` interface (`put`, `get`, `list`, `prune`), execution options draft (`resumeFrom`, `checkpointInterval`).
- **R1**: `@ddse/acm-runtime/checkpoint.ts`, tests covering success/guard failure/retry/policy denial snapshots, overhead benchmarks.
- **R2**: `ResumableExecutor` class + factory, option validation with `executePlan`, resume integration tests (mid-plan, after failure).
- **R3**: Adapter updates with `resumeFrom` support, contract tests for adapters, documentation on limitations.
- **R4**: `FileCheckpointStore`, `MemoryCheckpointStore`, CLI `--resume <runId>` flag, replay bundle update notes, operational runbook.

#### Resumable Risks & Mitigations

- _State divergence_: enforce deterministic serialization via schema validation.
- _Storage costs_: implement retention policy via `CheckpointStore.prune`.
- _Adapter incompatibility_: keep resume optional; surface warning rather than hard fail.
- _Regression risk to existing runtime_: ship ResumableExecutor behind an opt-in flag, keep `executePlan` as default path, and extend regression tests to cover legacy flows.

### 2.2 CLI Track (`acm-aicoder-demo-cli`)

| Phase | Scope | Exit Criteria |
| --- | --- | --- |
| **C0 – Scaffolding** | Bootstrap package, command runner, flag parsing, telemetry hooks. | CLI command runs `--help`; snapshots locked; lint/build/test pass. |
| **C1 – Planner & Provider wiring** | Integrate `@ddse/acm-llm`, planner orchestration, provider presets, streaming sink. | Running CLI prints planner stream and final plan summary. |
| **C2 – Execution engines** | Support runtime and LangGraph/MSAF adapters, structured event stream. | CLI completes refund/issues flows against runtime + LangGraph smoke tests. |
| **C3 – MCP & replay** | Add MCP toggles, tool discovery feedback, replay bundle export. | CLI run with `--save-bundle` writes bundle matching spec; tests assert structure. |
| **C4 – Polish & release** | Documentation, packaging, release automation. | Dry-run publish success; GA release tagged; docs merged. |

#### Key deliverables by phase (CLI)

- **C0**: `packages/acm-cli` workspace, `bin/acm-demo.ts` entry point, flag schema (`--provider`, `--model`, `--engine`, `--goal`, `--stream`, `--save-bundle`, `--mcp`), argument-parsing tests.
- **C1**: `providers.ts` presets, `plan.ts` orchestrator returning Plan-A/B + rationale, streaming renderer skeleton.
- **C2**: `run.ts` bridging plan → engine/ledger/policy/verification hooks, adapter wiring tests (mocks).
- **C3**: `--mcp-server` flag + config loader, replay bundle writer hooked to `StreamSink`, documentation on bundle structure.
- **C4**: README updates, `pnpm --filter @ddse/acm-cli demo` script, release checklist and CI integration.

#### CLI Risks & Mitigations

- _Streaming UX regressions_: add integration test capturing sample output.
- _Adapter drift_: pin adapter versions; add sanity tests in CI env matrix.
- _Local LLM availability_: document fallback instructions and mock provider option.

## 3. Dependencies & Alignment

| Dependency | Needed By | Notes |
| --- | --- | --- |
| Updated planner streaming hooks | CLI C1, Resumable R1 | Ensure streaming payload includes checkpoint-ready metadata. |
| MemoryLedger event schema stability | Resumable R1+ | Introduce versioned ledger entries; add compatibility tests. |
| Adapter API reviews (LangGraph/MSAF) | CLI C2, Resumable R3 | Schedule joint review to avoid duplicate effort. |
| Replay bundle schema update | CLI C3, Resumable R4 | Add checkpoint references without breaking existing consumers. |

## 4. Testing Strategy

- Unit: comprehensive coverage per package (`vitest`/`jest` depending on package).
- Integration: CLI invocation against mock providers + golden output; ResumableExecutor multi-stage resume tests.
- Regression: reuse `acm-examples` data sets; add fixtures for interrupted runs.
- Performance: benchmark checkpoint overhead (<10% added time vs baseline) and document results.

## 5. Documentation & Release Checklist

- Update `GETTING_STARTED.md`, `TESTING.md`, and package READMEs with new flags and resume instructions.
- Add troubleshooting section for resume failures and checkpoint pruning.
- Provide sample `runbook.md` describing operational steps (export/import checkpoints, bundle review).
- Release notes summarizing new CLI + Resumable capabilities, including migration guidance and feature flags.

## 7. Acceptance Gate

- ✅ All milestones C0–C4 and R0–R4 completed.
- ✅ pnpm workspace builds/tests green in CI (Linux + macOS matrix).
- ✅ Docs reviewed; release notes drafted.
- ✅ Stakeholders sign off on demo run (CLI) and interrupted-run resume scenario.

---

Revision 1 — October 2025
