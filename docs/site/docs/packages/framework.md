---
id: framework
sidebar_position: 2
title: "@ddse/acm-framework"
---

`@ddse/acm-framework` wraps planning, plan selection, runtime execution, streaming, and replay wiring behind a single API. Use it when you want to execute ACM-compliant runs without orchestrating each package manually.

## Installation

```bash
pnpm add @ddse/acm-framework @ddse/acm-sdk @ddse/acm-planner @ddse/acm-runtime
```

## Create the framework

```typescript
import {ACMFramework, ExecutionEngine} from '@ddse/acm-framework';
import {createVLLMClient} from '@ddse/acm-llm';
import {MemoryLedger} from '@ddse/acm-runtime';
import {SimpleCapabilityRegistry, SimpleToolRegistry} from '@ddse/acm-examples/registries';

const llm = createVLLMClient('Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8', 'http://localhost:8001/v1');
const capabilityRegistry = new SimpleCapabilityRegistry();
const toolRegistry = new SimpleToolRegistry();

const framework = ACMFramework.create({
  capabilityRegistry,
  toolRegistry,
  nucleus: {
    call: llm.generateWithTools!,
    llmConfig: {
      provider: llm.name(),
      model: 'Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8',
      temperature: 0.1,
      baseUrl: 'http://localhost:8001/v1'
    },
    allowedTools: toolRegistry.listNames()
  },
  planner: { planCount: 2 },
  execution: {
    engine: ExecutionEngine.ACM,
    checkpointInterval: 1
  }
});
```

## Execute end-to-end

```typescript
const ledger = new MemoryLedger();
const { plan, execution } = await framework.execute({
  goal: 'Investigate login failures reported overnight.',
  context: { facts: { severity: 'P1' } },
  ledger
});

console.log(plan.id, execution.outputsByTask);
```

## Advanced usage

- **Existing plan** — Skip replanning by providing a cached plan result.
- **Engine override** — Switch between `ExecutionEngine.ACM`, `ExecutionEngine.LANGGRAPH`, and `ExecutionEngine.MSAF` per call.
- **Resume** — Supply `resumeFrom`, `checkpointStore`, and `runId` for resumable executions.
- **Context provider** — Pass an `ExternalContextProviderAdapter` to satisfy nucleus directives automatically.
- **Custom selector** — Provide `planner.selector` when creating the framework to choose between plan alternatives deterministically.

## When to use the helper vs. raw packages

| Use case | Recommendation |
| -------- | -------------- |
| Quick proof of concept | `@ddse/acm-framework` |
| Large-scale orchestration or custom telemetry | Raw packages (`sdk`, `planner`, `runtime`) |
| Embedding into LangGraph or MSAF | Use adapters from `@ddse/acm-adapters` |

## References

- Package [README](https://github.com/ddse-foundation/acm/blob/main/framework/node/packages/acm-framework/README.md)
- [Core Concepts](../core-concepts/introduction.md)
- [Integrations → LangGraph](../integrations/langgraph.md)
