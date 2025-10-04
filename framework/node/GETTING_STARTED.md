# Getting Started with the ACM Node.js Framework

This quickstart walks through installing the framework, running the canonical examples, and authoring your first ACM-compliant agent. The emphasis is on the core SDK/runtime experience; AI Coder is referenced as an optional case study rather than the primary onboarding path.

## Prerequisites

- Node.js ≥ 18.0.0
- pnpm ≥ 8.0.0
- An OpenAI-compatible LLM endpoint (Ollama or vLLM are the most common local choices)

## 1. Clone & Build the Framework

```bash
git clone https://github.com/ddse-foundation/acm.git
cd acm/framework/node
pnpm install
pnpm build
```

> **Tip** — `pnpm build` compiles every package in the monorepo. Use `pnpm --filter <package> build` when iterating on a specific module.

## 2. Start a Local LLM Provider

The example workflows expect an OpenAI-compatible API. Choose the provider that best suits your environment.

### Option A: Ollama (Recommended for laptops)

```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.1
ollama serve
```

### Option B: vLLM (Great for GPUs or remote hosts)

```bash
pip install vllm
vllm serve mistralai/Mistral-7B-Instruct-v0.2 --port 8000
```

Confirm the server is reachable:

```bash
curl http://localhost:11434/v1/models   # Ollama default
# or
curl http://localhost:8000/v1/models    # vLLM default
```

## 3. Run the Canonical Examples

The `@acm/examples` package demonstrates refund and issue-resolution workflows with full ledger output, policy enforcement, and replay bundle generation.

```bash
# Refund workflow with Ollama
pnpm --filter @acm/examples demo -- --provider ollama --model llama3.1 --goal refund

# Issue workflow with vLLM
pnpm --filter @acm/examples demo -- --provider vllm --model mistralai/Mistral-7B-Instruct-v0.2 --goal issues

# Disable streaming or switch execution engines
pnpm --filter @acm/examples demo -- --no-stream --engine runtime --goal refund
pnpm --filter @acm/examples demo -- --engine langgraph --goal refund
pnpm --filter @acm/examples demo -- --engine msaf --goal refund
```

What you should observe:

1. **Planning phase** — Planner emits structured tool calls, rationale, and alternative plans (Plan-A/Plan-B when configured).
2. **Execution phase** — Runtime executes each task, records ledger entries, and surfaces checkpoint status.
3. **Summary** — Completion banner lists task outputs, ledger totals, and replay bundle artifacts when enabled.

## 4. Explore Resumable Execution & Replay

Resumable execution (Phase 2 feature) lets you checkpoint progress. Replay bundles package the full ledger for audit and verification.

```bash
# Enable checkpointing during execution
pnpm --filter @acm/examples demo -- --goal refund --checkpoint-dir ./checkpoints

# Resume after an interruption
pnpm --filter @acm/examples demo -- --resume <run-id> --checkpoint-dir ./checkpoints

# Export replay bundles (includes plans, ledger, tool-call envelopes)
pnpm --filter @acm/examples demo -- --goal refund --save-bundle --checkpoint-dir ./checkpoints
```

✅ **Benefits**: Restart from the last successful task, inspect intermediate state, and validate execution offline.

⚠️ **Adapters**: LangGraph and MSAF adapters currently warn when checkpoint flags are provided; resumable support will follow the Phase 4 roadmap.

## 5. Inspect Planner & Runtime Output

Understanding the console output helps when wiring custom tasks:

```text
📋 Planning...
✅ Plans generated: 2
Rationale: Plan-A emphasizes speed; Plan-B adds manual review

📋 Executing Plan: plan-a
[t1] → search_complete
[t1] ✓ Task completed (duration: 2.1s)
[t2] → risk_assessed
[t2] ✓ Task completed

===============================================================
EXECUTION SUMMARY
===============================================================
Total tasks: 3
Ledger entries: 12
Replay bundle: ./checkpoints/run-1759529575221
```

The ledger entries recorded here are the same artifacts exported in replay bundles and consumed by downstream auditors.

## 6. Author Your First Agent

Create `my-agent.ts` alongside the monorepo packages to experiment with the SDK directly.

```typescript
import { Tool, Task, type RunContext } from '@acm/sdk';
import { executePlan, MemoryLedger } from '@acm/runtime';
import { createOllamaClient } from '@acm/llm';
import { StructuredLLMPlanner } from '@acm/planner';
import { SimpleCapabilityRegistry, SimpleToolRegistry } from '@acm/examples/registries';

class GreetTool extends Tool<{ name: string }, { greeting: string }> {
  name() { return 'greet'; }

  async call(input: { name: string }) {
    return { greeting: `Hello, ${input.name}!` };
  }
}

class GreetTask extends Task<{ name: string }, { greeting: string }> {
  constructor() {
    super('greet-task', 'greet-capability');
  }

  async execute(ctx: RunContext, input: { name: string }) {
    const tool = ctx.getTool('greet');
    if (!tool) throw new Error('Greet tool not found');
    return tool.call(input);
  }
}

const tools = new SimpleToolRegistry();
tools.register(new GreetTool());

const capabilities = new SimpleCapabilityRegistry();
capabilities.register(
  { name: 'greet-capability', sideEffects: false },
  new GreetTask()
);

const goal = { id: 'goal-1', intent: 'Greet the user' };
const context = { id: 'ctx-1', facts: { userName: 'Alice' } };

const llm = createOllamaClient('llama3.1');
const planner = new StructuredLLMPlanner();

const { plans } = await planner.plan({
  goal,
  context,
  capabilities: capabilities.list(),
  llm,
});

const result = await executePlan({
  goal,
  context,
  plan: plans[0],
  capabilityRegistry: capabilities,
  toolRegistry: tools,
  ledger: new MemoryLedger(),
});

console.log('Result:', result.outputsByTask);
```

Run it in place:

```bash
npx tsx my-agent.ts
```

### Where to Go Next

- Swap in your own `Tool` subclasses for real APIs or databases.
- Implement policy and verification checks via `PolicyEngine`/`VerificationEngine`.
- Experiment with structured planner overrides once the Phase 4 Nucleus contract lands.

## 7. Dive Deeper into the Monorepo

```bash
# Inspect tool registry used in examples
cat packages/acm-examples/src/tools/index.ts

# Inspect task definitions
cat packages/acm-examples/src/tasks/index.ts

# Explore goal definitions
cat packages/acm-examples/src/goals/index.ts

# Run package-level tests
pnpm --filter @acm/examples test
```

## 8. Optional: Review the AI Coder Reference Experience

`@acm/aicoder` showcases how the framework scales to a full developer assistant with streaming TUI, policy gates, and resumable execution. Treat it as an end-to-end example wired entirely through the same SDK/runtime surfaces.

```bash
# Launch the interactive demo (no LLM required for the walkthrough)
pnpm --filter @acm/aicoder demo

# View detailed documentation
cat packages/acm-aicoder/README.md
```

## Troubleshooting

- **"Cannot connect to LLM"** — Ensure your provider is running and the port matches the CLI flags.
- **"Module not found"** — Re-run `pnpm install` inside `framework/node`, then `pnpm build`.
- **"Planning failed"** — The planner falls back to deterministic plans; inspect LLM logs and adjust model/temperature.

## Additional Resources

- [Framework README](./README.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [ACM v0.5 Specification](../../spec/acm-spec%20v0.5.md)
- [Phase 4 Implementation Plan](./IMPLEMENTATION_PLAN_PHASE4.md)
- [Resumable Executor Runbook](./docs/RUNBOOK_RESUMABLE.md)

Questions or ideas? Open an issue on GitHub or hop into the discussions tab. Happy building! 🚀
