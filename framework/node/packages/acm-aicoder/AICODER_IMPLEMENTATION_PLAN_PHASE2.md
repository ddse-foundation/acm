# ACM AI Coder — Phase 2 Implementation Plan

**Status:** Draft for engineering review  
**Date:** 2025-10-04  
**Owners:** AI Coder Squad (CLI + Runtime), ACM Runtime Team, Tooling Infrastructure

---

## 1. Objectives

Phase 2 evolves `@ddse/acm-aicoder` from the current Phase 1 showcase into an always-interactive, production-grade developer companion that runs entirely inside a full-screen terminal UI powered by the ACM v0.5 runtime. The primary objectives are:

1. **Interactive-only experience:** Launch exclusively in a full-screen TUI with a three-column layout (Chat ▸ Goal/Tasks ▸ Event Stream). No alternate modes.
2. **Environment provisioning at launch:** Require `--provider`, `--model`, and `--workspace` CLI parameters (with optional `--base-url`) and persist them in session metadata.
3. **Copilot-style streaming reasoning:** Surface planner and nucleus LLM thoughts as streaming messages in the Chat column with role-aware formatting.
4. **Adaptive ACM orchestration:** Enrich tools and tasks with nucleus-driven context building, retries, and structured tool-call telemetry.
5. **Budget governance:** Enforce live budget checks based on LLM metadata (token limits, price tables) before each inference and surface spend telemetry in the UI.
6. **Context lifecycle hygiene:** Reset internal state, caches, and context packets after each goal completes while preserving replay bundles for audit.
7. **Developer onboarding:** Document how Phase 2 uses ACM framework primitives, including instructions for extending tools, tasks, and planner behavior.
8. **Strict ACM alignment:** Implement every capability by composing existing ACM planner, runtime, nucleus, policy, and replay components—no bespoke substitutes.

---

## 2. Scope & Non-Goals

### In Scope

- Replacement of current CLI entry point with interactive-only TUI.
- Integration of structured planner/nucleus event streams into the UI.
- Budget enforcement layer referencing provider metadata (OpenAI, Anthropic, Azure, Ollama, etc.).
- Memory/context lifecycle management across goals and sessions.
- Documentation and examples describing how ACM runtime components power the experience.

### Out of Scope

- Building new external MCP adapters beyond what Phase 1 ships (reuse but harden existing toolset).
- Desktop GUI clients (focus on terminal).
- Multi-user collaboration inside the same session (single-user terminal only).
- Expanding replay bundle format beyond Phase 4 requirements (reuse ledger exports).
- Re-implementing planner, runtime, budget, or replay primitives outside the ACM framework surfaces.

---

## 3. Target Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Full-Screen Terminal                            │
│ ┌───────────────┐ ┌───────────────────────────────┐ ┌─────────────────────┐ │
│ │   Chat Pane   │ │   Goal / Tasks / Progress     │ │     Event Stream    │ │
│ │ (planner &    │ │ (Plan state, TODOs, budget)   │ │ (ledger, tool calls │ │
│ │ nucleus roll) │ │                               │ │  retries, context)  │ │
│ └─────▲─────────┘ └────────────┬──────────────────┘ └──────────▲──────────┘ │
│       │                        │                               │            │
└───────┼────────────────────────┼───────────────────────────────┼────────────┘
        │ Store events            │                               │
        ▼                        ▼                               ▼
  ┌──────────────┐       ┌────────────────────┐        ┌─────────────────────┐
  │ Chat Stream  │◄──────┤ Goal/Task Tracker  │◄───────┤ Event Bus / Ledger │
  └─────▲────────┘       └────────────────────┘        └───────▲────────────┘
        │                                                ACM Runtime Signals
        │    ┌─────────────────────────────────────────────────────┐
        └────┤ ACM Planner + Nucleus + Runtime (Phase 4 surfaces)   │
             └─────────────────────────────────────────────────────┘
```

Key integrations:

- **ACM Planner:** Emits structured tool-call events streamed into Chat + Tasks panes.
- **Nucleus:** Provides adaptive context scope, retries, and reasoning transcripts.
- **Runtime Ledger:** Drives the Event Stream column via live subscriptions.
- **Budget Controller:** Wraps planner/nucleus LLM calls to check spend limits and annotate events.
- **ACM runtime primitives only:** All orchestration layers call into existing ACM planner, runtime, nucleus, policy, and replay modules—never custom substitutes.

---

## 4. Workstreams

| Workstream | Lead Packages | Deliverables | Dependencies |
|------------|---------------|--------------|--------------|
| Interactive TUI Shell | `packages/acm-aicoder` (bin + new `src/ui`), `@ddse/acm-sdk` (stream sinks) | Full-screen layout, command handling, streaming renderer | Ink/Blessed evaluation, planner event API |
| Model & Engine Provisioning | `packages/acm-aicoder/bin`, `src/config` | CLI parameter validation, session metadata persistence | TUI shell |
| Budget Governance | `packages/acm-aicoder/src/runtime`, `@ddse/acm-runtime` hooks | Provider metadata registry, spend estimator, enforcement hooks | Model provisioning, ledger access |
| Adaptive Tasks & Nucleus Integration | `packages/acm-aicoder/src/tasks-v2`, `src/tools-v2`, `@ddse/acm-sdk` | Context builder hooks, retry orchestration, envelope logging | Planner/Nucleus Phase 4 surfaces |
| Memory Lifecycle & Cleanup | `packages/acm-aicoder/src/runtime`, `packages/acm-replay` | Context teardown routines, replay snapshot generation | Adaptive tasks, budget controller |
| Documentation & ACM Usage Guide | `packages/acm-aicoder/README.md`, new `AICODER_IMPLEMENTATION_PLAN_PHASE2.md` | How-to guide for developers, ACM integration walkthrough | Completion of above workstreams |
| Capability Map & Task Expansion | `packages/acm-aicoder/src/tasks-v2`, `src/context`, `packages/acm-planner` | Industry-leading capability catalog, task library aligned to developer workflows, planner policy updates | Adaptive tasks, context engine |

---

## 5. Detailed Implementation Steps

### 5.1 Interactive-Only CLI & Layout

1. **Entry point integration**
   - Replace `bin/aicoder.ts` command execution with a single `runInteractiveApp(args)` function.
   - Validate presence of `--provider`, `--model`, and `--workspace` before bootstrapping; exit with helpful message otherwise.
   - Initialize planner, nucleus, and runtime via ACM framework factories—no custom forks of these services.
2. **TUI foundation**
   - Adopt `ink@5` with `ink-box`, `ink-divider`, and `ink-scrollbar` (or evaluate `blessed`).
   - Create root component orchestrating three flex columns with responsive widths (40% chat, 30% goal/tasks, 30% events by default).
   - Implement command palette at bottom (single-line input) supporting `/exit`, `/help`, `/retry`, `/set-budget`, `/context`, `/replay`.
3. **Streaming rendering**
   - Leverage `useInput` to capture keystrokes.
   - Implement incremental rendering components for streaming text (planner/nucleus tokens) and event logs.

### 5.2 Planner & Nucleus Streaming

1. **Chat channel wiring**
   - Subscribe to planner structured tool-call events from Phase 4 (`PlannerToolCall`, `ToolCallEnvelope`).
   - For each inference, push `PlannerThought` entries with role (`planner`, `nucleus`, `user`).
   - Stream tokens by hooking `stream?.emit('planner', chunk)` to Chat component.
   - Support `#path/to/file` mentions in chat; resolve against the active `--workspace` so planner/nucleus reasoning can reference multiple files inline.
2. **Goal/Task synchronization**
   - Extend the plan execution flow to broadcast `TaskStart`, `TaskProgress`, `TaskEnd` updates; update central store.
   - Display TODO checklist with statuses (Pending, Running, Succeeded, Retrying, Failed).
3. **Event stream**
   - Subscribe to runtime ledger (Phase 4). Render event type badges (`NUCLEUS_INFERENCE`, `TOOL_CALL`, `CONTEXT_INTERNALIZED`, `POLICY_DECISION`, etc.) with color coding.

### 5.3 Model Provisioning & Session Metadata

1. **Config module**
   - Add `src/config/session.ts` to normalize CLI args into a `SessionConfig` (model, engine, base URL, workspace root, budget limits, temperature, seed).
2. **Provider registry**
   - Maintain `src/config/providers.ts` with metadata (token costs, max context window, concurrency limits, recommended nucleus settings).
3. **Persistence**
   - Save resolved config to `.aicoder/session.json` for re-use in the same workspace (with explicit confirmation prompt on reuse).

### 5.4 Budget Governance

1. **Budget controller**
   - Implement `BudgetManager` that calculates projected cost per request using provider metadata and message token counts.
   - Expose `checkBudget(estimation)` hook; block call if exceeding user-defined hard limit and prompt for override.
   - Leverage ACM policy hooks and ledger for enforcement; avoid parallel budgeting logic.
2. **UI integration**
   - Show running spend, remaining budget, and per-call estimates in Goal/Tasks column.
   - Emit budget-related events (warnings, blocks) to Event stream.
3. **Ledger logging**
   - Attach spend metadata to `NUCLEUS_INFERENCE` entries for deterministic replay.

### 5.5 Adaptive Context & Retry Enhancements

1. **Context builder upgrades**
   - Integrate `ContextBuilder` from Phase 4 to gather additional artifacts before each task execution based on nucleus preflight results.
   - Provide interactive prompts in Chat when nucleus requests manual confirmation for expensive retrievals.
2. **Retry orchestration**
   - Honor `retryPolicy` fields in `TaskSpec`; display attempt counts and next backoff time in Goal/Tasks column.
   - Offer `/retry` command to force another attempt and `/skip` to abort.
3. **Tool instrumentation**
   - Ensure every tool uses `ToolCallEnvelope` helper, recording `metadata.digest`, `duration_ms`, and error info for the Event stream column.

### 5.6 Memory Cleanup & Context Lifecycle

1. **Goal completion handler**
   - On final `Plan` completion, flush internal context scope, clear caches (`workspace-indexer`, search results), and reset Chat/Tasks panes while retaining session summary in Event column.
2. **Replay bundle**
   - Automatically persist replay bundle under `.aicoder/replays/${timestamp}` including `planner/llm-calls.jsonl` and session config.
3. **Resource finalization**
   - Close file handles, stop watchers, dispose of streaming subscriptions to prevent memory leaks.

### 5.7 Documentation & ACM Usage Guide

1. **Developer-facing instructions**
   - Produce `docs/interactive-cli.md` detailing architecture, command list, and ACM relationships.
   - Update `README.md` with Phase 2 quick start, including provider configuration and budget flags.
2. **Extensibility chapter**
   - Document how to add new tools/tasks using ACM SDK (with sample code snippets referencing `Tool` and `Task` subclasses).
3. **Plan usage**
   - Include in this plan an appendix with step-by-step instructions for running the interactive CLI and highlighting ACM framework touchpoints.

### 5.8 Capability Map & Task Expansion

1. **Capability catalog refresh**
   - Audit leading AI coding assistants (GitHub Copilot, Cursor, Replit, etc.) and compile a coverage matrix spanning code understanding, refactoring, testing, debugging, security, dependency management, release engineering, and compliance.
   - Map each capability to existing ACM tasks/tools and identify gaps; create new Task/Tool combinations within `src/tasks-v2` and `src/tools-v2` to close each gap.
   - Define capability metadata (domain, preconditions, verification strategy, policy considerations) for planner consumption.
2. **Planner policy updates**
   - Extend capability map registration so planner can prioritize best-fit tasks per goal; incorporate policy hooks for high-risk operations (e.g., mass refactor, dependency upgrades).
3. **Benchmarking & validation**
   - Create a benchmark suite of real-world developer scenarios (bug fixes, feature additions, build/test triage, security patching) and ensure AI Coder completes them with minimal user intervention.
   - Instrument success metrics (time-to-completion, tool usage, retries) and display comparative performance to industry tools in documentation.

---

## 6. Timeline (Indicative)

| Week | Milestone | Description |
|------|-----------|-------------|
| Week 0 | Kickoff & Design | Finalize TUI library choice, budget model requirements, and integration plan |
| Week 1 | TUI Shell Foundations | Implement full-screen layout, chat streaming skeleton, CLI parameter validation |
| Week 2 | Planner/Nucleus Streaming | Wire structured events into Chat/Tasks/Event panes; add command palette |
| Week 3 | Budget & Adaptive Context | Deliver BudgetManager, context builder integration, retry surfaces |
| Week 4 | Memory Lifecycle & Replay | Implement teardown routines, replay persistence, stability fixes |
| Week 5 | Documentation & Hardening | Update README/docs, add integration tests, user acceptance session |

---

## 7. Testing & Validation Strategy

- **Unit tests**: Cover store reducers, BudgetManager calculations, context lifecycle hooks, and CLI parameter parsing.
- **Integration tests**: Use pseudo-terminal harness (e.g., `node-pty`) to simulate user interactions, ensuring layout renders and commands function.
- **Budget simulations**: Provide fixtures for different provider metadata and assert enforcement is triggered.
- **Memory leak checks**: Run repetitive goal execution in CI with heap snapshots to verify cleanup.
- **Manual QA**: Cross-provider smoke tests (OpenAI, Anthropic, local Ollama) verifying streaming output and UI responsiveness.

---

## 8. Deployment & Rollout

1. Feature branch per workstream; merge behind `interactive_cli_phase2` feature flag toggled via CLI env var until stable.
2. Pre-release `0.2.0-beta` for internal testers with documentation preview.
3. Collect feedback, adjust ergonomics (keybindings, layout).
4. Final release `0.2.0` with changelog and migration notes.

---

## 9. Using the ACM Framework in Phase 2

Phase 2 exists to showcase the ACM framework at production scale; every subsystem below is consumed directly from ACM packages with no bespoke reimplementations.

### Planner & Nucleus

- The interactive Chat pane visualizes ACM planner tool-call loops and nucleus inferences in real time.
- Developers can hook into `StructuredLLMPlanner` and custom `Nucleus` implementations by editing `src/runtime/planner-registry.ts` (to be added).

### Tools & Tasks

- All tools remain subclasses of `Tool<I, O>`; Phase 2 ensures they emit `ToolCallEnvelope` entries for deterministic ledger logging.
- Tasks extend `Task<I, O>` and leverage the new context builder to fetch relevant artifacts dynamically.
- Capability maps are expanded to include code understanding, automated refactoring, dependency reasoning, end-to-end test scaffolding, security audits, and CI integration tasks—providing coverage beyond current industry AI coders.

### Context Packets

- Context orchestration uses Phase 4 `ContextBuilder` to produce immutable packets with provenance.
- Users can view current context via `/context` command, which dumps the latest packet digest and sources.

### Ledger & Replay

- Event Stream pane visualizes ledger entries; replay bundles stored automatically allow running `acm replay --bundle <path>` for postmortems.

### Policy & Budget Enforcement

- Policy hooks from ACM runtime continue to vet tool executions; BudgetManager sits alongside policy decisions to prevent overspend before inference.

---

## 10. Appendix — Quick Start (Planned)

1. `pnpm install`
2. `pnpm --filter @ddse/acm-aicoder run build`
3. `pnpm --filter @ddse/acm-aicoder acm-aicoder --provider vllm --model gpt-4o --base-url https://api.openai.com --workspace /path/to/project`
4. Interact via TUI:
   - Left column: chat with reasoning stream
   - Middle column: goal, tasks, budget metrics
   - Right column: event feed (tool calls, context, ledger)
5. End goal ➜ session summary persisted under `.aicoder/replays/`.

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| TUI performance issues on slow terminals | Medium | Offer minimal rendering mode, benchmark before release |
| Provider metadata drift | High | Maintain static metadata file with versioning and update CI check |
| Budget blocking legitimate operations | Medium | Provide override prompt with logging + policy approval |
| Memory leaks causing process bloat | High | Write teardown tests, monitor with heap snapshots |
| User confusion migrating from Phase 1 | Medium | Update README, add migration guide, provide screencast |

---

## 12. Acceptance Criteria

- CLI refuses to start without model/base-url/engine parameters.
- Full-screen TUI launches with three columns and supports streaming chat/events.
- Planner and nucleus reasoning appear live in Chat pane with role-specific styling.
- BudgetManager blocks or warns when estimated spend exceeds configured limits; UI displays running totals.
- Tasks leverage context builder + retry policies, visible in middle column with real-time status.
- Goal completion clears internal caches, resets UI panes, and writes replay bundle.
- Documentation explains architecture, ACM integration points, and extension pathways.

---

Prepared for internal review. Feedback welcome before implementation kickoff.
