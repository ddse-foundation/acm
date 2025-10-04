# ACM v0.5 Node Framework — Implementation Plan (code-first, zero-config)

Goal: ship a tiny library junior developers can use in minutes. Everything is plain TypeScript/JavaScript. No JSON/YAML files. No schema or policy DSLs. Keep the mental model: Tool → Task → Capability → Plan → Execute.

## Principles
- Full ACM v0.5 coverage: context lifecycle, plan alternatives/guards, policy & verification hooks, memory ledger, replay bundle, engine adapters.
- Ease-of-use, not reduced scope: code-first APIs and a simple CLI with flags/env (no YAML/JSON authoring required).
- Pluggable providers/adapters: LLM (Ollama/vLLM via OpenAI-compatible), MCP tools, engines (LangGraph, Microsoft Agent Framework).
- Observability and replay: streaming built-in, complete replay bundle export (JSON) optional via flag.
- Clear contracts: CapabilityRegistry (capabilities/tasks), ToolRegistry (tools), Task invariants (idemKey, retries, typed errors).
- Deterministic cognition: LLM reasoning flows through a Nucleus that owns a single `LLMCall`, manages internal context scope, and emits ledger entries.

## Scope (ACM v0.5 end-to-end)

- acm-sdk: abstract classes and types (Tool, Task, CapabilityRegistry, ToolRegistry, Stream, Types)
- acm-runtime: executePlan(), guards, retries/backoff, joins, policy/verification hooks, memory ledger
- acm-llm: provider-agnostic LLM client (OpenAI-compatible client for Ollama/vLLM), streaming support
- acm-nucleus: harness for deterministic `LLMCall` execution, pre/post hooks, internal context retrieval orchestration
- acm-planner: LLMPlanner (JSON plan emission with streaming) + safe linear fallback
- acm-mcp: MCP tool bridge and registry
- acm-adapters: LangGraph and Microsoft Agent Framework adapters (tasks→nodes, PDP hooks, streaming)
- acm-artifacts: emit/load/validate code-first artifacts; optional JSON export for replay
- acm-policy: policy engine interface + simple function PDP; adapter point for OPA later
- acm-verify: verification sheet evaluator (code expressions), adapter point for JSONLogic later
- acm-replay: memory ledger + replay bundle pack/unpack (JSON files) when enabled
- acm-cli: demo CLI to run end-to-end with flags (provider/model/goal/engine/stream/save-bundle)
- acm-examples: complete runnable example covering all features (two goals, plan A/B, streaming, engine switch)

## Core APIs (code-first, stable)

- Tool<I,O>
  - name(): string
  - call(input: I, idemKey?: string): `Promise<O>`
- Task<I,O>
  - constructor(id: string, capability: string)
  - execute(ctx, input): `Promise<O>`
  - optional: idemKey(ctx, input), policyInput(ctx, input), verification()
- CapabilityRegistry (tasks registry)
  - list(): { name: string }[]
  - resolve(name: string): Task
- ToolRegistry (tools registry)
  - get(name: string): Tool | undefined
  - list(): string[]
- executePlan({ goal, context, plan, tasks, registry, tools, policy?, verify?, stream?, ledger? })
  - returns { outputsByTask, ledger }

## Data shapes (plain JS objects)

- Goal: { id, intent, constraints? }
- Context: { id, facts, version? }
- TaskSpec: { id, capability, input?, retry? }
- Plan: { id, contextRef, capabilityMapVersion, tasks: TaskSpec[], edges: { from, to, guard? }[] }
- LedgerEntry: { id, ts, type, details }
- NucleusSpec: { id, binding, llmCall: { provider, model, temperature, seed, promptDigest }, internalTools?, hooks?, telemetry }
- InternalContextArtifact: { digest, provenance, scope: 'internal', createdAt }

Note: contextRef = context.id in v1 for simplicity.

## Developer ergonomics

- No YAML/JSON authoring. Define everything in code; the CLI uses flags/env only.
- Optional JSON export for Replay Bundle when `--save-bundle` is passed.
- One consistent execution signature across runtime and engine adapters.

## Milestones (phased delivery)

- M0: Repo skeleton, SDK abstracts, package workspaces
- M1: Runtime core (executePlan, guards, retries, joins, memory ledger)
- M2: LLM client (OpenAI-compatible), streaming, and Planner with JSON Plan-A/B + fallback
- M3: Policy and verification hooks (pre/post, assertions) with code-first evaluators
- M4: Adapters: LangGraph and Microsoft Agent Framework (nodes, hooks, streaming)
- M5: Artifacts/replay: contextRef hashing, optional replay bundle exporter
- M6: CLI demo: provider/model/goal/engine flags; live streaming; optional save-bundle
- M7: Example and docs: end-to-end refund and issues flows, acceptance tests

## Conformance (ACM v0.5 mapping)

- Context lifecycle: immutable Context Packet built in code; `contextRef` computed (hash) and enforced in plans.
- Plan alternatives & branching: Planner emits Plan-A/B; guards evaluate deterministically on recorded facts.
- Task contracts: Tasks bind to Capability Map entries; idemKey, retry/backoff, typed errors, compensation edges.
- Policy & verification: pre/post PDP evaluated; verification assertions enforced; all logged to ledger.
- Memory ledger: ordered, append-only entries for plan selection, branches, policy, re-plans, compensations.
- Nucleus logging: every `LLMCall` yields a `NUCLEUS_INFERENCE` entry; internal context captures emit `CONTEXT_INTERNALIZED` records.
- Replay bundle: optional JSON export includes goal, context, plans, capability-map ref, task-specs, policy req/resp, verification results, ledger, engine trace, task IO, planner prompts.
- Internal context scope: replay export writes `planner/internal-context/` artifacts plus `planner/llm-calls.jsonl` for deterministic reproduction.
- Engine integration: adapters for LangGraph and Microsoft Agent Framework satisfy engine hooks and streaming.

## Constraints & Risks

- Node >= 18; minimal external deps (fetch/streams). No YAML/JSON schema libs.
- Local LLM availability (Ollama/vLLM) required for live planning; document fallbacks.
- Engine API drift (LangGraph/AF) mitigated by keeping adapters thin and version-pinned.

If this plan looks good, next step is to scaffold the packages and land the minimal example.

---

## CLI example: end-to-end with LLM + LangGraph + Streaming

Goal: a single command that runs an ACM v0.5-conformant flow end-to-end using a local LLM (vLLM or Ollama), with live streaming feedback, and optional LangGraph execution. Core remains code-first; the CLI is a thin wrapper and uses flags/env only (no JSON/YAML).

## CLI UX (no config files)

- Command: `acm-demo --provider ollama --model llama3.1 --goal refund --engine langgraph`
- Flags
  - `--provider`: `ollama` | `vllm`
  - `--model`: model name (e.g., `llama3.1`, `qwen2.5:7b`, `mixtral`)
  - `--base-url`: override API base (default: `http://localhost:11434/v1` for Ollama, `http://localhost:8000/v1` for vLLM)
  - `--engine`: `runtime` | `langgraph` | `msaf`
  - `--goal`: `refund` | `issues`
  - `--stream`: enable streaming output (default on)
  - `--save-bundle`: write a Replay Bundle to `replay/<runId>/` (optional JSON export)

## LLM providers (local-first, OpenAI-compatible)

- Implement `OpenAICompatClient` in acm-llm:
  - ctor: `{ baseUrl, apiKey?, name, model }`
  - methods: `name()`, `generate(messages, opts)` with streaming support (ReadableStream)
  - Works with both vLLM and Ollama (OpenAI-compatible endpoints)
- Provider presets:
  - Ollama: baseUrl `http://localhost:11434/v1`, model from `--model`
  - vLLM: baseUrl `http://localhost:8000/v1`, model from `--model`

## Example goals (two fixed choices)

1) `refund` (P1, side-effects)
   - Intent: "Issue a refund for order O123 within 2 minutes, CC supervisor"
   - Context facts: `{ orderId: 'O123', region: 'EU' }`
2) `issues` (read-mostly)
   - Intent: "Find top issues and trigger mitigation"
   - Context facts: `{ product: 'ACME-X', region: 'EU' }`

## Capabilities and tasks (sample set)

- Atomic capabilities: `search`, `extract_entities`, `assess_risk`, `choose_action`, `perform_action`, `notify_supervisor`, `create_refund_txn`, `void_refund_txn`
- Logical tasks: `enrich_and_act`, `refund_flow`

## Planning (live LLM, safe fallback)

- Prompt includes: goal intent/constraints, capability names, context facts; requests Plan-A and Plan-B in a tiny JSON (tasks[], edges[]). If parsing fails, fallback to a simple linear plan.
- Compute `contextRef = sha256(JSON.stringify(ContextPacket))` via Node `crypto` and set `capabilityMapVersion = 'v1'`.
- Record `PLAN_SELECTED` in Memory Ledger.

## Execution engines

- Default: acm-runtime `executePlan()`
- Nucleus orchestration: each Task hydrates its Nucleus (if defined); `preflight` responses trigger internal retrieval Tasks before primary tool invocation.
- Optional: LangGraph adapter (`asLangGraph({ plan, tasks, registry, tools, policy, stream, ledger })`) returns a runnable graph; nodes = ACM Tasks; edges follow guards.
- Optional: Microsoft Agent Framework adapter (`wrapAgentNodes(workflow, { tasks, registry, tools, policy, stream, ledger })`) to run under MS AF with PDP hooks and streaming.

## Streaming (end-to-end)

- Planner streaming: token chunks -> `StreamSink.attach('planner', obs)`; CLI renders live tokens.
- Task streaming: tools can stream progress; runtime multiplexes by task id.
- CLI renderer shows: current task, guard outcomes, policy decisions, verification results.

## Policy & verification (functions, not DSL)

- PolicyEngine: JS function denies `create_refund_txn` when `riskTier == 'HIGH'`.
- Verification: assertions like `exists(tasks.t3.output.transactionId)`.
- Both logged to Memory Ledger; optional JSON export if `--save-bundle`.

## Context Packet & hashing (spec-aligned, no extra deps)

- Build Context Packet in code; compute hash with Node `crypto` and store as `contextRef`.
- Include minimal provenance (provider name, model, temperature) in memory for the bundle.

## Replay Bundle (optional JSON export)

- When `--save-bundle` is passed, write:
  - goal/goal.json
  - context/context.json
  - plans/planA.json, plans/planB.json
  - task-specs/*.json
  - policy/{requests.jsonl,responses.jsonl}
  - verification/results.json
  - memory-ledger/ledger.jsonl
  - engine-trace/run.json
  - task-io/{tId.input.json,tId.output.json}
  - planner/llm-calls.jsonl and planner/internal-context/*.json (internal scope + deterministic `LLMCall` breadcrumbs)

## CLI file layout

```text
/packages
  /acm-examples
    /cli
      bin/acm-demo.ts    # parse flags, build provider, pick goal, run
      src/goals.ts       # two pre-defined goals and contexts (code)
      src/providers.ts   # OpenAICompatClient wrappers for ollama/vllm
      src/run.ts         # plan-and-execute orchestration with streaming
      src/render.ts      # CLI renderer for streams, tasks, ledger
```

## Acceptance checklist (ACM v0.5 coverage)

- Context discipline: `contextRef` computed and enforced
- Plan alternatives: Plan-A/B emitted; selection recorded
- Deterministic branching: guards evaluate on recorded facts; outcomes logged
- Task contracts: idemKey, retries, typed errors
- Policy hooks: pre/post evaluation recorded
- Verification hooks: assertions executed and routed
- Memory Ledger: JSONL entries for plan/branch/policy
- Replay Bundle: optional JSON export
- Streaming: planner tokens + per-task streams shown live in CLI
- Engines: runtime, LangGraph, and MS AF supported from same inputs
- Nucleus discipline: deterministic prompts/seeds captured; internal context retrieval routed through declared internal tools

## Developer flow (0 to first run)

1) Start local LLM server (Ollama or vLLM)
2) Run: `acm-demo --provider ollama --model llama3.1 --goal refund --engine runtime`
3) Observe streaming tokens, Nucleus pre/post decisions, and task progress
4) Optional: add `--engine langgraph` or `--save-bundle`
