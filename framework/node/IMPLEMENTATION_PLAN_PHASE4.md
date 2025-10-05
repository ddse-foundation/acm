# ACM v0.5 Node Framework — Implementation Plan (Phase 4)

**Status:** Draft for internal review  
**Date:** 2025-10-04  
**Owners:** Runtime & SDK Engineering (primary), Planner Team, Tooling/MCP Integrations, Policy & Replay Ops

---

## 1. Objectives

Phase 4 extends the code-first Node framework to satisfy the next tranche of ACM v0.5 requirements. The work is organized around eight concrete change requests informed by the latest implementation review:

### Recent Progress (2025-10-04)

- Runtime and resumable executors now instantiate a Nucleus per task, share the internal context scope, and expose the instance through `RunContext` so tools/tasks operate on the same scoped state.
- A shared tool-call instrumentation layer wraps every registry lookup, emitting structured `ToolCallEnvelope` entries into the ledger (`TOOL_CALL`) alongside digests and durations to reinforce tool-call discipline.
- SDK type surfaces were refreshed to include the additional ledger entry type, `RunContext.nucleus`, and `Nucleus.setInternalContext`, preventing downstream code from falling back to untyped casts.
- Documentation and build artifacts will continue to track these updates so downstream agents (including AI Coder) inherit the Nucleus-first tone without diverging fallbacks.

1. **Structured planner output & selection rigor:** Replace the current JSON-parsing planner flow with deterministic structured tool calls (ReAct-style), support configurable multi-plan generation (defaulting to a single plan), and capture rationale plus prompt digests whenever alternatives are produced.
2. **Tool-call discipline:** Ensure every tool invocation in the framework—including Nucleus internals—emits structured tool-call envelopes (no ad-hoc JSON parsing or string introspection).
3. **Spec-compliant SDK contracts:** Restore `Goal`, `Context`, `Plan`, `TaskSpec`, and `LedgerEntry` types to the full ACM v0.5 surface, enabling downstream components to produce auditable artifacts.
4. **Nucleus contract:** Introduce a shared abstract class/interface describing the Nucleus with a single auditable `LLMCall` member that itself conforms to the structured tool-call envelope (typed inputs/outputs) alongside deterministic configuration.
5. **Context orchestration:** Extend context-handling abstractions to manage internal scope, enforce provenance tracking, compute immutable content hashes, and gate execution on frozen Context Packets.
6. **Task/Planner integration:** Refactor Task and Planner abstractions to depend on the Nucleus contract rather than direct LLM clients, wiring pre/post hooks.
7. **Tool-native default execution:** Make MCP/LLM-backed tools the golden path in CLI/examples, replacing synthetic stubs while preserving deterministic fallbacks for tests.
8. **Runtime & replay telemetry:** Update execution engine, ledger, and replay packing to capture Nucleus inferences, structured tool calls, internal context artifacts, policy/verification exchanges, and tamper-evident hashes.

Out of scope: productionizing additional engines, expanding policy DSLs, or reworking Phase 3 artifacts beyond the pieces touched above.

---

## 2. Workstream Breakdown

| Workstream | Lead Package(s) | Key Deliverables | Dependencies |
|------------|-----------------|------------------|---------------|
| Spec Contract Restoration | `packages/acm-sdk`, `packages/acm-runtime`, `packages/acm-replay` | Expanded data types (Goal/Context/Plan/Task/Ledger), migration codemods, schema validators | Spec v0.5 requirements |
| Structured Planner Tool Calls | `packages/acm-planner`, `packages/acm-llm` | New tool-call schema, ReAct-style planner loop, multi-plan rationale capture, streaming integration | Spec contracts, `@acm/llm` streaming API |
| Tool-Call Discipline Everywhere | `packages/acm-runtime`, `packages/acm-sdk`, `packages/acm-mcp` | Tool registry updates, runtime adapters emitting tool-call envelopes, validation utilities | Spec contracts, structured planner schema, existing tool registry |
| Nucleus Contract Introduction | `packages/acm-sdk` | `Nucleus` abstract class/interface, `LLMCall` config types, helper factories | Spec contracts, tool-call schema |
| Context Orchestration Enhancements | `packages/acm-sdk`, `packages/acm-runtime` | Internal context scope data structures, provenance tracking, promotion APIs | Nucleus contract, spec contracts |
| Task/Planner Refactor | `packages/acm-sdk`, `packages/acm-planner`, `packages/acm-runtime` | Tasks accept Nucleus, planner uses Nucleus for reasoning, migration utilities | Nucleus contract, context orchestration |
| Tool-Native Default Execution | `packages/acm-cli`, `packages/acm-examples`, `packages/acm-mcp` | CLI defaults using MCP/LLM tools, deterministic test doubles, documentation updates | Tool-call discipline, task/planner refactor |
| Runtime & Replay Instrumentation | `packages/acm-runtime`, `packages/acm-replay`, `packages/acm-cli` | Ledger entry types, replay bundle updates (`planner/internal-context`, `llm-calls.jsonl`, policy/verifier artifacts), CLI surfacing | All prior workstreams |

---

## 3. Detailed Implementation Steps

### 3.1 Spec Contract Restoration

- Expand `GoalCard`, `ContextPacket`, `PlanArtifact`, `TaskSpec`, and `LedgerEntry` types in `@acm/sdk` to match ACM v0.5 definitions, including provenance lists, policy/verifier references, retry policies, and typed error routes.
- Provide migration codemods and adapter utilities so existing examples/tests can supply the richer shapes with minimal manual edits.
- Rework hash utilities so `contextRef` is a SHA-256 of the normalized Context Packet and ensure ledger entries carry content digests and optional signatures.
- Update replay and runtime validators to fail fast when required fields are missing or malformed.

### 3.2 Structured Planner Tool Calls

- Define `PlannerToolCall` schema (`packages/acm-sdk/src/tooling.ts`) capturing tool name, input payload, expected output types, prompt digests, and alternative ids.
- Enhance `LLM` interface to support a "tool-call" generation mode returning typed call results instead of raw text, including streaming rationale tokens.
- Ship `StructuredLLMPlanner` operating in a ReAct loop:
  - Assemble prompts referencing allowed planner tool names: `emit_plan`, `ask_policy`, `fetch_context_internal`.
  - Allow developers to configure the number of plan candidates (default 1) while capturing rationales/tool traces whenever additional alternatives are requested.
  - Feed user/assistant messages to `llm.generateToolCalls(...)` (new helper) and handle streaming.
  - Convert tool responses into strongly typed `PlanCandidate` structures and persist prompts/results for replay.
- Provide fallback deterministic planner when tool-call execution fails while still using typed structures and logging the failure mode.
- Update examples and CLI to reflect streaming tool-call events instead of raw JSON chunks.

### 3.3 Tool-Call Discipline Everywhere

- Extend `ToolRegistry` to register tool metadata including schema references, deterministic version IDs, and capability bindings.
- Introduce a `ToolCallEnvelope` type in `@acm/sdk` and require runtime adapters to emit tool calls using this structure, writing envelopes into the ledger before execution and on completion.
- Audit existing tool invocations (`task.execute`, MCP adapters, replay rehydration) and wrap them through a helper that enforces schema validation, ledger logging, and trace correlation.
- Add lint rules/tests ensuring no module parses JSON strings from LLM responses directly or bypasses the envelope helper.

### 3.4 Nucleus Contract Introduction

- Create `packages/acm-sdk/src/nucleus.ts` defining:
  - `NucleusConfig` (binding info, llmCall settings, hook definitions, allowed tools, prompt seeds).
  - Abstract class `Nucleus` with `preflight`, `invoke`, `postcheck`, `recordInference`, and `getInternalContext` methods wired to ledger events.
  - A typed `LLMCall` method signature that consumes and returns the shared tool-call envelope structures, ensuring structured IO parity with planner/tool usage.
- Provide a base implementation `DeterministicNucleus` handling ledger writes, prompt hashing, and internal context storage via dependency-injected adapters.
- Export new artifacts via `@acm/sdk` barrel and retrofit planner/runtime constructors to demand a Nucleus factory.

### 3.5 Context Orchestration Enhancements

- Introduce a `ContextBuilder` service that records sources, augmentations, provenance metadata, and produces immutable Context Packets with computed hashes.
- Extend `RunContext` with `internalContext` accessor and `enqueueInternalRetrieval` capability bound to specific tools and provenance entries.
- Implement `InternalContextScope` utility for storing content-addressed artifacts, linking them to ledger events, and exposing promotion APIs.
- Provide promotion API `promoteInternalContext()` that spins a new Context Packet revision when necessary, enforces hash recalculation, and records ledger events.
- Update runtime to evaluate Nucleus `preflight` results and execute declared internal retrieval tasks prior to main task execution, failing runs if the context was not frozen.

### 3.6 Task & Planner Refactor

- Update `Task` abstract class to accept optional `nucleusFactory` or `getNucleus()` hook for per-task instances, plus explicit `toolBindings`, `policyRefs`, and `retryPolicy` parameters.
- Adjust planner options to inject a Nucleus factory, drop direct `LLM` dependency, and reference the restored spec types for plan/task outputs.
- Migrate existing tasks/planner implementations to new signatures with backward compatibility shims and automated codemods where reasonable.
- Update CLI/demo flows and tests to configure Nucleus with seeds, prompt digests, tool restrictions, and to emit structured ledger entries.

### 3.7 Tool-Native Default Execution

- Replace synthetic demo tools with MCP-backed or LLM-backed implementations in `@acm/examples` while keeping deterministic fixtures for tests behind feature flags.
- Wire the CLI (`acm-demo`, `aicoder`) to register MCP transports by default, surfacing configuration templates for common hosts (Ollama, OpenAI, Azure).
- Provide guardrails for offline/test scenarios by supplying documented fallbacks that still route through the `ToolCallEnvelope` helper.
- Update onboarding docs to walk through configuring real tools and highlight deterministic replay expectations.

### 3.8 Runtime & Replay Instrumentation

- Add ledger entry types `NUCLEUS_INFERENCE`, `CONTEXT_INTERNALIZED`, `BRANCH_TAKEN`, `POLICY_DECISION`, and verification artifacts; ensure they carry prompt digest, seed, tool calls, signatures, and artifact digests.
- Extend `MemoryLedger` append/read APIs to validate the new entry shapes, enforce tamper-evident hashing, and expose filters for replay export.
- Update replay bundle exporter to include:
  - `planner/llm-calls.jsonl`
  - `planner/internal-context/` directory with artifact manifests
  - Policy request/response transcripts
  - Verification inputs/outputs and task IO aligned to spec contracts
- Modify CLI `--save-bundle` path to incorporate new artifacts, compute bundle-level checksums, and surface Nucleus decisions in interactive mode.

### 3.9 Nucleus Authored Narratives & Streaming Presentation

- Extend the planner’s `emit_plan` schema so the Nucleus can emit `title`, `objective`, and `successCriteria` metadata per task alongside rationale. Surface these optional fields on `TaskSpec` without falling back to static capability names unless the Nucleus declines to provide a label.
- During execution, capture the task-level Nucleus `reasoning` plus postcheck observations and store them on the `TASK_END` ledger record and in `outputsByTask`. Promote a follow-up, Nucleus-driven “wrap-up” call that synthesizes an overall goal summary, persisted as a `GOAL_SUMMARY` ledger entry.
- Introduce a shared `ExecutionTranscript` helper within the framework runtime that watches ledger append events (`NUCLEUS_INFERENCE`, `TASK_END`, `GOAL_SUMMARY`) and streams human-readable updates. UI shells and API consumers can subscribe once to obtain labels, task narratives, and goal summaries in real time.

### 3.10 External Context Provider Adapter

- Design an adapter that binds Nucleus `request_context_retrieval` directives to developer supplied tools built on the standard `Tool` base class. The adapter will route directives to registered handlers, normalize tool outputs into `InternalContextScope` artifacts, and enforce provenance metadata.
- Provide default matching semantics (e.g., directive prefixes) plus overridable input mappers so teams can plug arbitrary retrieval backends without reimplementing orchestration glue.
- Automatically promote successful artifacts into the active context packet when configured, logging `CONTEXT_INTERNALIZED` ledger entries and preventing duplicate promotions across retries.
- Expose adapter hooks through runtime `executePlan` options so tasks automatically attempt retrieval before failing preflight. Re-run Nucleus preflight after each adapter pass and surface actionable errors when directives remain unresolved.
- Document adapter usage patterns, including registering filesystem/knowledge-base tools, customizing directive schemas, and emitting deterministic fixtures for tests.

## 4. Testing & Validation

- **Unit tests:**
  - New tests for `DeterministicNucleus`, planner tool-call loop, context builder hashing, and ledger entry validation.
  - Ensure tasks executed with and without Nucleus produce identical outputs (where expected) and enforce required TaskSpec fields.
  - Validate `ToolCallEnvelope` helper rejects ad-hoc JSON parsing and records envelopes before/after execution.
- **Integration tests:**
  - Extend `acm-examples` flows to run with structured tool calls, multi-plan selection, and real MCP-backed tools in CI (with deterministic mocks for offline mode).
  - Add regression for `--save-bundle` ensuring `llm-calls.jsonl`, `internal-context/`, policy transcripts, and verification artifacts exist and match ledger records.
  - Verify replay import round-trips newly added ledger types and detects tampering.
- **Manual validation:**
  - Run CLI with vLLM/Ollama providers to observe live Nucleus decisions, ensure zero raw JSON output parsing, and confirm default configs exercise real tools.
  - Perform doc-driven walkthrough to confirm migration guide instructions succeed end to end.

---

## 5. Documentation & Developer Experience

- Update Phase 3 docs plus `framework-implementation-plan-node.md` to reference Nucleus APIs, restored spec contracts, and structured tool-call requirements.
- Provide migration guide for custom tasks/planners built on Phase 3 surfaces, including codemod instructions and before/after examples of Goal/Context/Plan/Task shapes.
- Refresh README snippets to show new planner usage, default MCP/LLM setup, and configuration of Nucleus plus tool-call envelopes.
- Document replay bundle schema changes and quality gates in `docs/RUNBOOK_RESUMABLE.md`, adding checklists for verifying new artifacts and hashes.
- Add an honesty/roadmap banner to public docs until all acceptance criteria are met, clarifying temporary limitations and linking to progress trackers.

---

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tool-call schema churn | Medium | Lock schema early, review with planner/runtime/tooling teams before implementation |
| Performance regressions due to additional hooks | Medium | Benchmark planner/runtime before/after; provide caching for internal context artifacts |
| Backward incompatibility for early adopters | High | Ship compatibility layer for existing planner consumers, communicate breaking changes via changelog and migration guides |
| Spec contract migration fatigue | Medium | Deliver codemods, phased warnings, and clear upgrade cookbook to minimize manual edits |
| Replay bundle bloat | Low | Compress internal context artifacts, store digests instead of raw payloads when feasible |
| Documentation perception gap | Medium | Add honesty banner, keep status matrix updated, and announce milestones via changelog/blog |

---

## 7. Dependencies & Coordination

- Align with spec updates in `spec/acm-spec v0.5.md` (Nucleus contract, ledger requirements).
- Coordinate with Phase 3 owners to deprecate JSON parsing paths gradually.
- Ensure MCP tool adapters adopt structured tool-call envelopes.
- Confirm policy and verification teams are aware of new ledger entry types.
- Partner with SDK and examples maintainers to land codemods simultaneously and keep deterministic fixtures behind feature flags.
- Synchronize CLI documentation and onboarding flows with marketing/documentation owners for honesty banner rollout.

---

## 8. Acceptance Criteria

- SDK exports full ACM v0.5 contracts for Goal, Context, Plan, Task, and Ledger artifacts, and validators reject partial payloads.
- Planner emits plans exclusively through structured tool-call results, allowing a configurable number of alternatives (default 1) with recorded rationale and no string parsing when multiple plans are requested.
- All runtime tool invocations flow through `ToolCallEnvelope` and log to ledger with deterministic metadata and hashes.
- Tasks and planners instantiate Nucleus instances, record `NUCLEUS_INFERENCE` entries, enforce frozen Context Packets before execution, and ensure the Nucleus `LLMCall` uses the shared tool-call envelope.
- Internal context retrievals captured in `planner/internal-context/` and ledger `CONTEXT_INTERNALIZED` entries with artifact digests.
- Replay bundle produced by CLI includes new artifacts (policy transcripts, verification IO, hashes) and passes validation script.
- CLI/examples default to MCP/LLM-backed tools while offering documented deterministic fallbacks for tests.
- Documentation and examples updated to illustrate new flows and include an honesty banner until full compliance is shipped.

---

## 9. References

- `framework/node/framework-implementation-plan-node.md` (Phase 3 baseline)
- `spec/acm-spec v0.5.md` (Nucleus and replay requirements)
- `docs/adr/001-resumable-executor.md`
- `IMPLEMENTATION_PLAN_PHASE3.md` (for historical context)
