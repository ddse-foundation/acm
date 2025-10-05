# @acm/framework

High-level helper that wraps the ACM structured planner and runtime behind a single `setup`/`execute` flow. It is intended for developers who want to run the full ACM pipeline without manually orchestrating planners, registries, and the nucleus configuration.

## Installation

```bash
pnpm add @acm/framework
```

## Quick Usage

```typescript
import { ACMFramework } from '@acm/framework';
import { createOllamaClient } from '@acm/llm';
import { SimpleCapabilityRegistry, SimpleToolRegistry } from '@acm/aicoder';

const llm = createOllamaClient('llama3.1');

const framework = ACMFramework.create({
  capabilityRegistry,
  toolRegistry,
  policyEngine,
  nucleus: {
    call: async (prompt, tools, config) => llm.generateWithTools!(
      [{ role: 'system', content: prompt }],
      tools,
      config,
    ),
    llmConfig: {
      provider: llm.name(),
      model: 'llama3.1',
      temperature: 0.1,
      maxTokens: 512,
    },
  },
});

const result = await framework.execute({
  goal: 'Investigate login failures reported overnight.',
  engine: ExecutionEngine.ACM, // optional, ACM is the default
});

console.log(result.plan);
console.log(result.execution.outputsByTask);
```

### API Highlights

- `ACMFramework.create(options)` — configure registries, policy, nucleus call, and planner defaults.
- `framework.plan(request)` — generate plan(s) and inspect the planner ledger before execution.
- `framework.execute(request)` — end-to-end plan + execute with a single call.

Both methods accept either a plain string or a full `Goal` object and will synthesize goal/context identifiers automatically.

## Options Overview

- `capabilityRegistry`, `toolRegistry`, `policyEngine` — existing ACM registries you already configure for planners/runtimes.
- `nucleus.call` / `nucleus.llmConfig` — how to talk to your LLM provider. The helper constructs `DeterministicNucleus` instances by default.
- `planner.planCount`, `planner.selector` — override plan fan-out and selection logic.
- `defaultStream`, `verify` — reuse streaming sink or verification hooks across invocations.
- `execution.engine` — choose between the default resumable ACM runtime (`ACM`),
  the LangGraph adapter (`LANGGRAPH`), or the Microsoft Agent Framework adapter (`MSAF`).
  Per-call overrides are also supported via `execute({ engine: ... })`.
- `execution.resumeFrom`, `execution.checkpointInterval`, `execution.checkpointStore`, `execution.runId` — ACM-only resume controls.
- `plan({ ledger })` / `execute({ ledger })` — reuse an existing `MemoryLedger` so external observers (e.g., UI stores) can tap into log events while the wrapper runs.
- `execute({ existingPlan })` — skip re-planning by providing a preselected plan plus the original `PlannerResult`.

### Execution Engines

By default the wrapper uses the resumable ACM runtime, which supports checkpoints
and `resumeFrom` execution. You can opt into the adapter engines when you want
LangGraph or Microsoft Agent Framework compatibility:

```typescript
import { ACMFramework, ExecutionEngine } from '@acm/framework';

const framework = ACMFramework.create({
  // ...existing configuration
  execution: {
    engine: ExecutionEngine.LANGGRAPH,
  },
});

const result = await framework.execute({
  goal: 'Run the onboarding workflow',
  engine: ExecutionEngine.MSAF, // override per-call if desired
});
```

The adapter engines stream events, enforce policies, and honor tool guards, but
they **do not** currently support checkpoint/resume. For resumable executions,
keep `ExecutionEngine.ACM` (the default).

## Related Packages

- `@acm/sdk` — lower-level abstractions used by this helper.
- `@acm/planner` — structured planner leveraged internally.
- `@acm/runtime` — deterministic execution engine invoked by `execute()`.
- `@acm/adapters` — LangGraph and MS Agent Framework adapters optionally used by the wrapper.
