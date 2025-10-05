

# ACM aiCoder Demo CLI — Phase 3 Implementation Plan (Production Ready)

The goal of Phase 3 is to ship an aiCoder CLI that convincingly demonstrates ACM’s end-to-end capabilities on real developer workflows: deep code analysis, safe automated edits, rich approvals, replayable telemetry, and adapter parity. This plan equips a cloud agent (or any contributor) with an actionable, quality-focused roadmap.

---

## Objectives & Non-Negotiables

- **Demonstrate full ACM stack** (planner, runtime with checkpoint/resume, adapters, MCP, replay) in one cohesive CLI experience.
- **Solve developer-grade tasks**: fix a bug, generate a feature skeleton, refactor code, summarize changes, and surface diffs/tests automatically.
- **Guarantee user trust** via approvals, diffs, policy checks, and repeatable replays.
- **Be production ready**: deterministic builds, CI coverage, telemetry hooks, documentation, and roll-back strategy.
- **Work offline-first** using local MCP providers (filesystem, git) with optional hosted LLM backends.

### Out-of-Scope / Non-goals

- Replacing a full IDE; we focus on terminal-first developer journeys.
- Implementing hosted multi-user services; Phase 3 targets single-developer environments.
- Building custom LLM models; we rely on existing provider clients (`@acm/llm`).

---

## Key User Journeys to Support

1. **Bug fix with guardrails**: analyze failing test output, locate offending module, craft patch, run targeted tests, present diff, and await approval before write-back.
2. **Feature scaffolding**: gather requirements, draft files via templates, auto-fill TODO comments, ensure compilation, create summary & follow-up tasks.
3. **Large refactor**: plan multi-step change with checkpoints, execute incrementally with resume support, track ledger entries, and offer manual override or back-out.
4. **Codebase audit**: crawl folders, produce architecture summaries, detect hotspots (lint/test failures), output Markdown report without modifying files.

Success will be measured by completing these journeys in guided demos and automated integration tests.

---

## Success Criteria & Quality Gates

| Area | Criteria |
| --- | --- |
| **UX** | CLI helps complete all key journeys with clear prompts, streaming updates, and actionable summaries. |
| **Safety** | All write operations require user approval with diff preview; policy engine blocks forbidden paths; resumable checkpoints guard partial progress. |
| **Observability** | Every run generates replay bundle, structured logs, and optional OpenTelemetry traces. |
| **Reliability** | `pnpm lint`, `pnpm build`, `pnpm test`, and scenario smoke tests (feature run, bugfix run) pass locally and in CI matrix. |
| **Docs** | README, quickstart, troubleshooting, and runbook sections published with screenshots/gifs. |
| **Performance** | Interactive latency under 1s for prompt to stream, and checkpoint overhead <10% vs baseline. |

Release is gated on an acceptance demo showing bugfix + feature journeys end-to-end with resume + replay.

---

## Cross-Cutting Pillars

- **Secure Operations**: sandbox MCP processes, enforce allow-list for file edits, redact secrets in outputs.
- **Testing Strategy**: unit tests for tools/tasks, contract tests for MCP bridges, integration suites with snapshot comparison, and golden replays.
- **Telemetry & Analytics**: optional `--telemetry-endpoint` flag, structured events for plan selection, approvals, edits, tests, failures.
- **Developer Experience**: `--analysis-only`, `--auto-approve`, `--dry-run`, `--resume <checkpoint>` flags; config file support (`~/.acm-ai-coderrc`).
- **Resilience**: automatic resume on failure, user prompt to continue; background git stash/branch management to protect working tree.

---

## Implementation Roadmap

### Phase 0 — Discovery & Workspace Bootstrapping

- Scaffold `packages/acm-aicoder-demo-cli/` (mirroring other workspace packages) with build/test scripts and typed entrypoints.
- Add dependencies (`enquirer`, `chalk`, `ora`, `execa`, `node-pty`, ACM packages) and update `pnpm-workspace.yaml`, root scripts, and CI configuration.
- Define configuration schema (flags + `aicoder.config.json`), environment loading, and guardrails (min Node version, feature flags).
- Deliverables: compiling TypeScript project, baseline README, lint/build wired into repo automation.

### Phase 1 — Code Intelligence Toolkit

- Implement core tools registered with ACM:
  - `CodeReadTool` (structured file/directory reads with size limits and syntax highlighting).
  - `CodeEditTool` (diff-based edits with git integration, fallback to MCP patch). Includes dry-run + conflict detection.
  - `TemplateGenerateTool` (prompt LLM via `@acm/llm` to emit boilerplate with guardrails).
  - `CodeReviewTool` (static analysis summary using LLM + optional lint command output).
- Bridge to MCP: auto-launch filesystem server, optional git server, discovery + caching of remote tools.
- Define reusable run contexts and tool metadata (mutating vs read-only, requires approval, recommended guard). Document usage.
- Acceptance: unit tests for each tool, verifying guard flags and error handling; mocks for MCP interactions.

### Phase 2 — Capability Graphs & Task Library

- Create high-level ACM tasks/capabilities aligned to user journeys:
  - `AnalyzeCodebaseTask`
  - `FixBugTask`
  - `ImplementFeatureTask`
  - `RefactorModuleTask`
  - `SummarizeChangesTask`
- Each task composes tools, defines policy inputs, verification expressions (e.g., `testsPassed === true`), retries, and metadata for streaming.
- Add fallback/branch tasks (e.g., `GatherAdditionalContextTask`, `RequestHumanApprovalTask`).
- Provide sample registry wiring + capability schemas (JSON Schema for inputs/outputs) to ensure typed prompts.
- Acceptance: scenario unit tests per task using fixture repositories; snapshot outputs for determinism.

### Phase 3 — Conversational CLI & Planner Integration

- Implement `bin/aicoder.ts` (ESM) using `enquirer`:
  - Parse flags (provider/model, engine, goal templates, analysis-only, auto-approve, resume, config file).
  - Kick off `StructuredLLMPlanner` with streaming structured tool-calls; render Plan A/B with rationale and risk scoring; allow regenerate or manual selection.
  - Manage approvals: require user ack for plan selection, branching, and any mutating tasks.
- Integrate `@acm/runtime` (resumable executor) with `FileCheckpointStore`, optional `--resume` flag, and progress persistence.
- Provide engine adapters (runtime, LangGraph, MSAF) with capability parity checks; warn when features degrade.
- Acceptance: integration test simulating interactive session (mock stdin/stdout) exercising plan selection and approvals.

### Phase 4 — Execution, Streaming & Reporting

- Attach `DefaultStreamSink` + custom renderer using `chalk`/`ora` for task lifecycle, policy checks, guard evaluations, test results, diffs.
- Capture metrics: elapsed time, LLM tokens/cost (when provided), tests run, files touched.
- Write rich summaries at run end (Markdown + JSON) including:
  - Files changed with diff stats.
  - Tests executed + results.
  - Outstanding TODOs or manual steps.
  - Links to replay bundle and checkpoints.
- Implement `ReplayBundleExporter` integration (`--save-bundle`, default location `replay/<runId>/`).
- Acceptance: golden snapshot tests on summary output, manual demo for streaming UI stability.

### Phase 5 — Safety, Quality & Automation

- Tighten policy engine rules (e.g., forbid edits outside project root, block destructive operations without override).
- Integrate git safeguards: auto-create work branch, stage changes, optional `--commit` flag with conventional commit message, ability to abort and restore.
- Hook into testing pipeline: discover package manager (pnpm/npm/yarn) and run targeted commands (`lint`, `test`, `build`) with structured streaming of output; prompt user if failure occurs.
- Add telemetry instrumentation and optional remote logging with privacy filters.
- Expand automated tests:
  - CLI smoke tests (bugfix, feature) using fixture repos + mock LLM responses.
  - Replay-based regression tests (run recorded bundle through CLI to ensure deterministic playback).

### Phase 6 — Documentation, Release & Adoption

- Produce docs: README with quickstart, walkthroughs, flag reference; GIF-based demo; troubleshooting (MCP setup, provider credentials).
- Update root docs (`MCP_EXAMPLES.md`, `TESTING.md`, framework README) with aiCoder references and sample commands.
- Add `pnpm --filter @acm-aicoder-demo-cli demo` script and optional `docker compose` recipe for sandboxed runs.
- Prepare changelog and release checklist, including semantic versioning and publish guard to npm (dry-run + provenance).
- Roll out CI jobs (lint/build/test, e2e scenarios, bundle validation) on Linux & macOS, with nightly replay regression run.

### Phase 7 — Operational Hardening

- Monitor telemetry dashboards, set alerts for failure spikes, and create runbook (`docs/runbooks/aicoder.md`) covering:
  - How to resume stuck runs.
  - How to rotate MCP secrets.
  - How to gather diagnostic bundles for support.
- Validate upgrade path: run aiCoder CLI against multiple sample repositories (frontend, backend, mono-repo) and document compatibility matrix.
- Final acceptance demo: live session performing bugfix + feature addition with mid-run resume, followed by replay inspection.

---

## Dependencies & Alignment

| Dependency | Needed By | Notes |
| --- | --- | --- |
| Resumable runtime API (`executeResumablePlan`, stores) | Phase 3+ | Already shipped in Phase 2; ensure typings consumed here. |
| Planner streaming rationale | Phase 3 | Confirm rationale payload includes risk/confidence scores. |
| MCP filesystem + git servers | Phase 1+ | Ship helper scripts/auto-launchers; document prerequisites. |
| Replay bundle schema update | Phase 4+ | Include plan metadata + approvals; maintain backward compatibility. |
| Telemetry pipeline | Phase 5 | Optional but recommended; provide noop logger by default. |

---

## Risks & Mitigations

- **LLM variability**: cache prompts, provide deterministic fixtures for tests, offer `--mock-llm` flag.
- **Filesystem mutations**: enforce diff preview + git branch; auto-rollback on failure.
- **Long-running commands**: stream output with timeouts and allow user to interrupt (`Ctrl+C` -> prompt to resume/abort).
- **Adapter drift**: run contract tests to ensure LangGraph/MSAF behaviors match baseline; document known gaps.
- **Usability regressions**: run regular usability reviews with developers, collect feedback via telemetry or CLI prompt.

---

Final acceptance requires:

- ✅ All success criteria satisfied and tracked in CI.
- ✅ Two end-to-end demo recordings (bugfix + feature) including resumes and replays.
- ✅ Documentation approved, runbook merged, and release candidate published to npm (tagged `next`).
- ✅ Stakeholder sign-off (Runtime DX + Runtime Core + Docs) following live walkthrough.

Once complete, aiCoder will serve as the hero showcase for ACM, proving the framework’s readiness for real developer workloads.

