`docs/ACM-Framework-Guideline.md`.

# ACM Developer Framework Creation Guideline (code-first, Node.js primary)

This is a practical guide for building an agent framework that conforms to the ACM spec, updated for ACM v0.5. It’s library-style (no HTTP), uses abstract classes, and lets a developer:

- plug in their own tools or MCP tools,
- compose Tasks that pipe several tools,
- define a CapabilityRegistry,
- support streaming,
- connect multiple LLM providers,
- generate Goal → Plan (with alternatives),
- and execute with policy/verification/replay hooks and a Memory Ledger.

ACM v0.5 alignment at-a-glance:

- Artifacts: Goal Card, Capability Map, Context Packet, Plan Graph (with alternatives), Task Spec, Tool Catalog, Policy Sheet, Verification Sheet, Memory Ledger, Replay Bundle.
- Planning: MUST operate on immutable Context Packet; Plans MUST reference `contextRef` and `capabilityMapVersion`.
- Execution: MUST log policy pre/post decisions, verification results, branch choices, errors/compensation into the Memory Ledger and include all artifacts/IO in a Replay Bundle.

---

## 0) Package layout (mono-repo)

```text
/packages
  /acm-sdk           # types, abstract classes, tiny guard/verify DSL
  /acm-runtime       # executePlan(), guards, retries, joins, policy/verify hooks
  /acm-llm           # provider-agnostic LLM client + planner interface
  /acm-mcp           # MCP client + Tool bridge
  /acm-adapters      # langgraph/ms-af/temporal wrappers (optional)
  /acm-artifacts     # emit/load/validate ACM v0.5 artifacts (goal, plan, ctx, task, tools)
  /acm-policy        # policy engine adapters (OPA/Rego, custom PDP); request/response capture
  /acm-verify        # verification sheet loader + evaluator (JSONLogic-like)
  /acm-replay        # memory ledger + replay bundle pack/unpack; content-addressed storage
  /acm-examples      # runnable examples
  /acm-cli           # CLI: acm validate, plan, execute, replay-bundle assemble
```

---

## 1) Abstract classes (the backbone)

### 1.1 Tools (atomic executors)

```ts
// packages/acm-sdk/src/tool.ts
export abstract class Tool<I = any, O = any> {
  abstract name(): string;
  inputSchema?(): unknown;        // optional schema (zod/JSON-Schema)
  outputSchema?(): unknown;
  sideEffects?(): boolean;        // default false
  abstract call(input: I, idemKey?: string): Promise<O>;

  // Optional streaming
  supportsStream?(): boolean;
  stream?(
    input: I,
    onChunk: (chunk: any) => void,
    idemKey?: string
  ): Promise<O>; // return final O after stream completes
}
```

### 1.2 Task (logical unit; may call many tools)

```ts
// packages/acm-sdk/src/task.ts
import type { RunContext } from "./types";

export abstract class Task<I = any, O = any> {
  constructor(public id: string, public capability: string) {}
  // Required: implement end-to-end logic; may call multiple tools
  abstract execute(ctx: RunContext, input: I): Promise<O>;

  // Optional: idempotency / policy / verification
  idemKey?(ctx: RunContext, input: I): string | undefined;
  policyInput?(ctx: RunContext, input: I): Record<string, unknown>;
  verification?(): string[]; // tiny verify DSL expressions
}
```

### 1.3 Capability registry (what planners target)

```ts
// packages/acm-sdk/src/capability.ts
export type Capability = {
  name: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  sideEffects?: boolean;
};

export abstract class CapabilityRegistry {
  abstract list(): Capability[];
  abstract has(name: string): boolean;
  abstract inputSchema(name: string): unknown | undefined;
  abstract outputSchema(name: string): unknown | undefined;
}
```

### 1.4 Tool registry

```ts
// packages/acm-sdk/src/registry.ts
import { Tool } from "./tool";

export abstract class ToolRegistry {
  abstract get(name: string): Tool | undefined;
  abstract list(): string[];
}
```

### 1.5 Streaming abstractions

```ts
// packages/acm-sdk/src/stream.ts
export type StreamObserver<T = any> = {
  next: (chunk: T) => void;
  complete: () => void;
  error: (e: unknown) => void;
};

export interface StreamSink {
  attach(taskId: string, obs: StreamObserver): void;
  detach(taskId: string): void;
}
```

---

## 2) LLM integration (multi-provider) & planning

### 2.1 Provider-agnostic LLM client

```ts
// packages/acm-llm/src/llm.ts
export interface ChatMessage { role: 'system'|'user'|'assistant'; content: string }
export interface LLMResponse { text: string; tokens?: number; raw?: any }

export interface LLM {
  name(): string;
  generate(messages: ChatMessage[], opts?: { temperature?: number; seed?: number }): Promise<LLMResponse>;
}

export class OpenAIClient implements LLM { /* ... */ }
export class AzureOpenAIClient implements LLM { /* ... */ }
export class AnthropicClient implements LLM { /* ... */ }
// Add others similarly
```

### 2.2 Planner interface (Goal → Plan / PlanA-PlanB)

```ts
// packages/acm-llm/src/planner.ts
import type { Goal, Plan, Context, CapabilityRegistry } from "@acm/sdk";

export interface Planner {
  plan(goal: Goal, ctx: Context, caps: CapabilityRegistry): Promise<{ plans: Plan[]; rationale?: string }>; // all Plans MUST carry contextRef
}

// Default LLM-based planner (uses function-calling/JSON schema guidance)
export class LLMPlanner implements Planner {
  constructor(private llm: LLM, private systemPrompt: string) {}
  async plan(goal: Goal, ctx: Context, caps: CapabilityRegistry) { /* produce Plan-A/B with guarded edges, same contextRef */ }
}
```


## 3) Core data structures

```ts
// packages/acm-sdk/src/types.ts
export type Goal = { id: string; intent: string; constraints?: Record<string, any> };
export type Context = { id: string; facts: Record<string, any>; version?: string };

export type GuardExpr = string; // boolean over {context, outputs, policy}

export type TaskSpec = {
  id: string;
  capability: string;
  input: any; // resolved by planner or at runtime via "$from" wires
  retry?: { attempts: number; backoff: 'fixed'|'exp'; baseMs?: number; jitter?: boolean };
  verification?: string[];
};

export type Plan = {
  id: string;
  contextRef: string; // content-addressable ref to Context Packet per ACM v0.5
  capabilityMapVersion: string;
  tasks: TaskSpec[];
  edges: Array<{
    from: string;
    to: string;
    guard?: GuardExpr; // MUST evaluate deterministically using recorded data
    onError?: 'RETRYABLE_ERROR'|'FATAL_ERROR'|'COMPENSATION_REQUIRED'
  }>;
  join?: 'all'|'any'; // optional join semantics for fan-out
  alternatives?: string[]; rationale?: string;
};

export type PolicyDecision = { allow: boolean; limits?: { timeoutMs?: number; retries?: number }; reason?: string };
export interface PolicyEngine { evaluate(action: 'plan.admit'|'task.pre'|'task.post', payload: any): Promise<PolicyDecision>; }

export type RunContext = {
  goal: Goal;
  context: Context;
  outputs: Record<string, any>;
  metrics: { costUsd: number; elapsedSec: number };
  getTool(name: string): Tool<any, any>;
  getCapabilityRegistry(): CapabilityRegistry;
  stream?: StreamSink;
};

// Memory Ledger (append-only)
export type LedgerEntry = {
  id: string; ts: string; type: 'PLAN_SELECTED'|'BRANCH_TAKEN'|'POLICY_DECISION'|'REPLAN_TRIGGERED'|'COMPENSATION_APPLIED'|'GOAL_AMENDED';
  actor: 'human'|'llm'|'policy'|'engine'; details: any; hash: string; signature?: string;
};
export interface MemoryLedger { append(e: LedgerEntry): Promise<void>; }
```

---

## 4) MCP tools integration

```ts
// packages/acm-mcp/src/mcp-tool.ts
import { Tool } from "@acm/sdk";
import { MCPClient } from "model-context-protocol"; // any MCP client impl

export class McpTool extends Tool<any, any> {
  constructor(private client: MCPClient, private toolName: string) { super(); }
  name() { return `mcp:${this.toolName}`; }
  async call(input: any) { return this.client.callTool(this.toolName, input); }
}
```

```ts
// packages/acm-mcp/src/registry.ts
import { ToolRegistry } from "@acm/sdk";
export class McpToolRegistry extends ToolRegistry {
  constructor(private tools: Record<string, Tool>) { super(); }
  get(name: string) { return this.tools[name]; }
  list() { return Object.keys(this.tools); }
}
```

---

## 5) Building Tasks that **pipe several tools**

```ts
class EnrichAndActTask extends Task<{ q: string }, { actionId: string }> {
  constructor() { super('tEnrichAct', 'enrich_and_act'); }
  verification() { return ['exists(output.actionId)']; }

  async execute(rcx, input) {
    const search = rcx.getTool('search');
    const extract = rcx.getTool('extract_entities');
    const choose  = rcx.getTool('choose_action');
    const act     = rcx.getTool('perform_action');

    const docs = await search.call({ q: input.q }).then(r => r.docs);
    const entities = await extract.call({ docs }).then(r => r.entities);
    const action = await choose.call({ entities }).then(r => r.choice);

    // Optionally stream as we progress
    rcx.stream?.attach(this.id, {
      next: (chunk) => {/* forward */}, complete: () => {}, error: () => {}
    });

    const result = await act.call({ action }); // side-effectful
    rcx.stream?.detach(this.id);
    return { actionId: result.id };
  }

  idemKey(rcx, input) { return `enrichAct:${rcx.context.id}:${input.q}`; }
  policyInput(rcx, input) { return { task: this.id, cap: this.capability, q: input.q }; }
}
```

---

## 6) CapabilityRegistry with Tasks

You keep **capabilities (names + schemas)** separate from **task implementations**. The planner and validator rely on the registry; the runtime binds task IDs to classes.

```ts
class MyCaps extends CapabilityRegistry {
  private caps: Record<string, Capability> = {
    search: { name: 'search' },
    extract_entities: { name: 'extract_entities' },
    choose_action: { name: 'choose_action' },
    perform_action: { name: 'perform_action', sideEffects: true },
    enrich_and_act: { name: 'enrich_and_act', sideEffects: true }, // logical task
  };
  list() { return Object.values(this.caps); }
  has(n: string) { return !!this.caps[n]; }
  inputSchema(n: string) { return this.caps[n].inputSchema; }
  outputSchema(n: string) { return this.caps[n].outputSchema; }
}
```

Bind **task IDs** to classes for execution:

```ts
const tasks = {
  tEnrichAct: new EnrichAndActTask(),
  // ... other tasks
};
```

---

## 7) Command pattern (optional ergonomics)

Offer a thin “Command” to make ad-hoc executions trivial:

```ts
export class Command {
  constructor(private runtime: typeof executePlan) {}
  async run(goal: Goal, ctx: Context, plan: Plan, deps: {
    tasks: Record<string, Task>, tools: ToolRegistry, caps: CapabilityRegistry,
    policy?: PolicyEngine, stream?: StreamSink, ledger?: MemoryLedger
  }) {
    return this.runtime({ goal, context: ctx, plan, tasks: deps.tasks, registry: deps.caps,
      policy: deps.policy, stream: deps.stream, tools: deps.tools, ledger: deps.ledger });
  }
}
```

---

## 8) Streaming end-to-end

- Tool may implement `supportsStream()` + `stream()`.
- Task can attach a `StreamObserver` to the runtime’s `StreamSink`.
- Runtime multiplexes stream events per task and surfaces to the host (e.g., WebSocket, CLI). Stream metadata SHOULD be captured into the Replay Bundle’s engine trace.

---

## 9) Goal → Plan (LLM planner)

```ts
const goal: Goal = { id: 'G-42', intent: 'Find top issues and trigger mitigation' };
const context: Context = { id: 'ctx-1', facts: { product: 'ACME-X', region: 'EU' } };
const caps = new MyCaps();

const planner = new LLMPlanner(new OpenAIClient(/* apiKey */), /*systemPrompt*/ 'You are a planner...');
const { plans, rationale } = await planner.plan(goal, context, caps); // all plans share contextRef

// Pick Plan-A (or run policy to choose)
const plan = plans[0];
```

---

## 10) Execute Plan (deterministic part)

```ts
import { executePlan } from '@acm/runtime';

await executePlan({
  goal,
  context,
  plan,
  tasks,                 // id -> Task class instances
  registry: caps,        // CapabilityRegistry
  policy: myPolicy,      // implements PolicyEngine (optional)
  stream: myStreamSink,  // optional streaming
  ledger: myLedger,      // Memory Ledger appender (required for full v0.5 conformance)
  // verification + replay are built-in to runtime; you can configure outputs
});
```

Runtime responsibilities (built-in):

- Validate `plan` against `capabilityMapVersion` (via `CapabilityRegistry`).
- Ensure `plan.contextRef` matches the Context Packet used by the planner.
- Topological run, evaluate `guard` expressions (branching) deterministically; record `BRANCH_TAKEN`.
- Policy pre-hook (`task.pre`) and optional post-hook (`task.post`); record `POLICY_DECISION` with request/response payloads.
- Execute, then run verification; route failures per Plan edges or policy.
- Retries/jitter/timeouts & idempotency keys if provided; type errors as RETRYABLE/FATAL/COMPENSATION_REQUIRED.
- Append Memory Ledger entries and export a Replay Bundle containing artifacts, task IO, policy/verification results, and engine traces.

---

## 11) Multi-engine adapters (optional)

 - **LangGraph**: `asLangGraph({ plan, tasks, registry, tools, policy, stream })` → returns a runnable graph (each node = ACM Task).
 - **Microsoft Agent Framework**: `wrapAgentNodes(workflow, { tasks, registry, tools, policy, stream })`.
 - **Temporal**: `withTemporal({ tasks, policy, verify })` returns activity wrappers calling your Task executor.

---

## 12) Developer “happy path” checklist

1. **Implement Tools** (or load MCP tools).
2. **Implement Tasks** that call Tools (can pipe multiple).
3. **Define CapabilityRegistry** (what the planner can use).
4. **(Optional) Add PolicyEngine** (local rules or OPA-WASM).
5. **Pick an LLM provider**; create **LLMPlanner**.
6. **Create Goal & Context** in code.
7. **Planner produces Plan-A/B** (guards allowed).
8. **Execute** with `executePlan()`; optionally stream.
9. Inspect **Memory Ledger / Replay Bundle** artifacts; ensure completeness prior to marking runs finished.

---

## 13) Minimal example (glue)

```ts
const tools = new (class extends ToolRegistry {
  private t = { search: new SearchTool(), extract_entities: new ExtractTool(), choose_action: new ChooseTool(), perform_action: new PerformTool() };
  get(n: string) { return this.t[n]; }
  list() { return Object.keys(this.t); }
})();

const caps = new MyCaps();
const tasks = { tEnrichAct: new EnrichAndActTask() };

const { plans } = await new LLMPlanner(new OpenAIClient(), 'You plan using only declared capabilities.')
  .plan({ id:'G-42', intent:'Find issues and mitigate' }, { id:'ctx-1', facts:{ product:'ACME-X' } }, caps);

await executePlan({ goal:{ id:'G-42', intent:'Find issues and mitigate' }, context:{ id:'ctx-1', facts:{} },
  plan: plans[0], tasks, registry: caps, tools, ledger: myLedger });
```

---

## 14) Artifacts: emitters, validators, and storage

- Emitters: Provide helpers to serialize Goal Card, Context Packet (content-addressed, include digests/provenance), Plan Graphs (with `contextRef` and `capabilityMapVersion`), Task Specs, Tool Catalog entries, Policy/Verification sheets.
- Validators: JSON Schema-based linting for artifact shapes; referential integrity checks (Plans reference existing Tasks/Capabilities; Tasks reference tool names/versions).
- Storage: Local FS or pluggable store; ensure immutability via content hashing; expose `contextRef` and checksums on write.

CLI ergonomics (in `/packages/acm-cli`):

- `acm validate <path>` – static validation over artifacts and referential integrity.
- `acm plan <goal> <context>` – run planner, persist `plans/` with shared `contextRef`.
- `acm exec <plan>` – execute and assemble Replay Bundle under `replay/<run-id>/`.
- `acm replay <bundle>` – dry-run replay to validate bundle completeness.

## 15) Verification sheets

- Keep verification as declarative checks (JSONLogic-like) referenced by Task Spec IDs.
- Runtime evaluates checks after each Task; failures route via Plan edges or policy.

## 16) Policy sheets and PDP integration

- Support external policy-as-code (OPA/Rego) or custom PDP. The `policyInput` payloads MUST be serialized and stored alongside PDP responses.
- Deny decisions halt or re-route per Plan; allow decisions may include limits (timeouts, retries) applied at runtime.

## 17) Memory Ledger and Replay Bundle

- Memory Ledger: append-only, ordered entries with content hashes; record plan selection, branches, policy decisions, verifications, re-plans, compensations, goal amendments.
- Replay Bundle: assemble complete set of artifacts: goal/, context/, plans/, capability-map/, task-specs/, policy/{requests,responses}/, verification/, memory-ledger/, engine-trace/, task-io/, planner/.
- Engines MUST guarantee bundle completeness before marking a run finished.

## 18) Conformance mapping to ACM v0.5

- Context discipline: Planner operates on frozen Context Packet and emits `contextRef` into Plans. Runtime enforces matching `contextRef`.
- Alternatives & branching: Planner may emit Plan-A/B with guards; runtime evaluates guards deterministically and records branch choices.
- Task contracts: Tasks bind to Capability Map entries; declare `idemKey`, retries, typed errors, policy/verification hooks.
- Policy & verification: PDP pre/post hooks recorded; verification outcomes captured and routed.
- Memory & replay: Ledger entries appended; Replay Bundle assembled with all required directories and checksums.

Use the conformance checklist in the ACM v0.5 spec to validate your implementation before claiming compatibility.

---

### Notes

- No YAML is required for authoring; everything is code-first. Artifacts are exported for audits and replay.
- The abstract classes keep user code tight: implement `Tool.call()` and `Task.execute()`.
- MCP support means devs can “just point at a server” to get tools without changing task code.
- The same runtime signature works for adapters (LangGraph/MS AF) if teams already use them.

If you want, I can turn this into a minimal runnable repo scaffold (with a tiny planner stub) so your team can `pnpm i && pnpm dev` and see an agent run with two tools and a multi-tool task.
