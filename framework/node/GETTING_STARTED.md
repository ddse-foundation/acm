# Getting Started with ACM Node.js Framework

This guide will walk you through creating your first ACM agent from scratch.

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- A local LLM (Ollama or vLLM)

## Step 1: Setup

Clone and build the framework:

```bash
git clone https://github.com/ddse-foundation/acm.git
cd acm/framework/node
pnpm install
pnpm build
```

## Step 2: Start Your LLM

### Using Ollama (Recommended)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama3.1

# Start server (in a separate terminal)
ollama serve
```

### Using vLLM

```bash
# Install vLLM
pip install vllm

# Start server (in a separate terminal)
vllm serve mistralai/Mistral-7B-Instruct-v0.2 --port 8000
```

## Step 3: Run the Demo

```bash
# Run the refund workflow example
pnpm --filter @acm/examples demo -- --provider ollama --model llama3.1 --goal refund
```

You should see:
1. **Planning phase**: LLM generates Plan-A and Plan-B
2. **Execution phase**: Tasks run with live progress
3. **Summary**: Results and ledger entries

## Step 4: Try Different Options

```bash
# Try the issues workflow
pnpm --filter @acm/examples demo -- --goal issues

# Use vLLM instead
pnpm --filter @acm/examples demo -- --provider vllm --model mistral --goal refund

# Disable streaming for cleaner output
pnpm --filter @acm/examples demo -- --no-stream --goal refund

# Save replay bundle for audit
pnpm --filter @acm/examples demo -- --save-bundle --goal refund

# Try resumable execution (NEW in Phase 2)
pnpm --filter @acm/examples demo -- --goal refund --checkpoint-dir ./my-checkpoints
```

## Step 5: Resumable Execution (Phase 2 Feature)

The ACM runtime now supports checkpointing and resume functionality, enabling fault-tolerant long-running workflows:

```bash
# Run with automatic checkpointing (checkpoints after each task)
pnpm --filter @acm/examples demo -- --goal refund --checkpoint-dir ./checkpoints

# If execution is interrupted, resume from the latest checkpoint
# Use the run ID from the original execution (shown in the output)
pnpm --filter @acm/examples demo -- --resume run-1234567890 --checkpoint-dir ./checkpoints
```

**Key Benefits:**
- ✅ Resume interrupted executions without re-running completed tasks
- ✅ Fault tolerance for long-running workflows
- ✅ Cost optimization by avoiding duplicate expensive operations
- ✅ State inspection via checkpoint files

**Note:** Resume functionality is currently only supported with the `runtime` engine (default). LangGraph and MSAF adapters will show a warning if resume flags are used.

## Step 6: Understand the Output

### Planning Output
```
📋 Planning...

Analyzing the goal... Creating two alternative execution plans...

✅ Plans generated: 2
Rationale: Plan-A prioritizes speed, Plan-B includes extra validation
```

### Execution Output
```
📋 Executing Plan: plan-a
Context Ref: 8f3a2b1c

[t1] Task started
[t1]   → search_complete
[t1] ✓ Task completed
  Output: { "results": ["..."] }

[t2]   → entities_extracted
[t2]   → risk_assessed
[t2] ✓ Task completed
  Output: { "riskTier": "LOW", "score": 35 }
```

### Summary
```
===============================================================
EXECUTION SUMMARY
===============================================================
Total tasks: 3
Ledger entries: 12

Outputs:
  t1: { results: [...] }
  t2: { action: "PROCEED", details: {...} }
  t3: { transactionId: "TXN-...", notified: true }

✅ Demo completed successfully!
```

## Step 6: Build Your First Agent

Create a new file `my-agent.ts`:

```typescript
import { Tool, Task, type RunContext } from '@acm/sdk';
import { executePlan, MemoryLedger } from '@acm/runtime';
import { createOllamaClient } from '@acm/llm';
import { LLMPlanner } from '@acm/planner';
import { SimpleCapabilityRegistry, SimpleToolRegistry } from '@acm/examples/registries';

// 1. Define a simple tool
class GreetTool extends Tool<{ name: string }, { greeting: string }> {
  name() { return 'greet'; }
  
  async call(input: { name: string }) {
    return { greeting: `Hello, ${input.name}!` };
  }
}

// 2. Define a task
class GreetTask extends Task<{ name: string }, { greeting: string }> {
  constructor() {
    super('greet-task', 'greet-capability');
  }
  
  async execute(ctx: RunContext, input: { name: string }) {
    const tool = ctx.getTool('greet');
    if (!tool) throw new Error('Greet tool not found');
    return await tool.call(input);
  }
}

// 3. Setup registries
const tools = new SimpleToolRegistry();
tools.register(new GreetTool());

const capabilities = new SimpleCapabilityRegistry();
capabilities.register(
  { name: 'greet-capability', sideEffects: false },
  new GreetTask()
);

// 4. Create goal and context
const goal = {
  id: 'goal-1',
  intent: 'Greet the user',
};

const context = {
  id: 'ctx-1',
  facts: { userName: 'Alice' },
};

// 5. Plan and execute
const llm = createOllamaClient('llama3.1');
const planner = new LLMPlanner();

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

Run it:
```bash
npx tsx my-agent.ts
```

## Step 7: Explore the Examples

Look at the sample implementations:

```bash
# View sample tools
cat packages/acm-examples/src/tools/index.ts

# View sample tasks
cat packages/acm-examples/src/tasks/index.ts

# View goals
cat packages/acm-examples/src/goals/index.ts
```

## Next Steps

1. **Read the docs**: Check out package READMEs in `packages/*/README.md`
2. **Extend the examples**: Add your own tools and tasks
3. **Integrate external APIs**: Connect to databases, web services, etc.
4. **Add policy rules**: Implement custom authorization logic
5. **Build complex workflows**: Create multi-step, branching plans

## Common Issues

### "Cannot connect to LLM"
- Ensure Ollama/vLLM is running
- Check the port matches (11434 for Ollama, 8000 for vLLM)
- Try: `curl http://localhost:11434/v1/models`

### "Module not found"
- Run `pnpm install` from `framework/node`
- Run `pnpm build` to compile TypeScript

### "Planning failed"
- The planner will fall back to a safe plan
- Check LLM logs for errors
- Try a different model or temperature

## Resources

- [Full README](./README.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [ACM v0.5 Specification](../../spec/acm-spec%20v0.5.md)
- [Package Documentation](./packages/)

## Get Help

- Open an issue on GitHub
- Check existing issues and discussions
- Review the examples in `packages/acm-examples/`

Happy building! 🚀
