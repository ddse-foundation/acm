# ACM AI Coder - Phase 2 Interactive CLI Guide

## Architecture

The Phase 2 AI Coder is built entirely on ACM v0.5 framework primitives:

```
┌─────────────────────────────────────────────────────────┐
│              Full-Screen Terminal UI (Ink)              │
├───────────────┬─────────────────────────┬───────────────┤
│ Chat Pane     │ Goals/Tasks/Budget      │ Event Stream  │
│ (40% width)   │ (30% width)             │ (30% width)   │
├───────────────┴─────────────────────────┴───────────────┤
│                   Command Input                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │   InteractiveRuntime    │
              └─────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  ┌──────────┐      ┌──────────┐      ┌──────────┐
  │ Planner  │      │ Runtime  │      │  Budget  │
  │ (LLM)    │      │ (Tasks)  │      │ Manager  │
  └──────────┘      └──────────┘      └──────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                    ┌────────────┐
                    │   Ledger   │
                    │ (Replay)   │
                    └────────────┘
```

## Quick Start

### Start Interactive Mode

```bash
acm-aicoder \
  --llm-model gpt-4o \
  --llm-base-url https://api.openai.com \
  --llm-engine langgraph \
  --workspace /path/to/your/project \
  --budget-usd 10
```

### Available Commands

| Command | Description |
|---------|-------------|
| `/exit`, `/quit` | Exit the application |
| `/help` | Show available commands |
| `/budget` | Display detailed budget information |
| `/context` | Show current context packet info |
| `/reset` | Reset session (clear goal, tasks) |
| `#path/to/file` | Reference workspace files in chat |

## Components

### Budget Governance
- Pre-inference cost checks using provider metadata
- Live spend tracking with warnings
- Hard limits with override prompts
- Token estimation: ~4 chars per token

### Streaming Reasoning
- Planner thoughts appear in Chat pane as they generate
- Nucleus inferences show reasoning process
- Real-time task status updates

### Memory Lifecycle
After each goal:
- Replay bundle saved to `.aicoder/replays/{timestamp}/`
- Budget reset for next goal
- Chat and events preserved

## Configuration

### Required Parameters
- `--llm-model` - Model name (e.g., gpt-4o, llama3.1)
- `--llm-base-url` - API endpoint
- `--llm-engine` - Runtime engine (langgraph, msaf, runtime)
- `--workspace` - Project root directory

### Optional Parameters
- `--budget-usd` - Spending limit (default: unlimited)
- `--temperature` - LLM temperature 0-2 (default: 0.7)
- `--seed` - Random seed for reproducibility
- `--plans` - Number of plans to generate, 1 or 2 (default: 1)

## Extending

### Add a New Task

```typescript
export class MyTask extends Task<{ input: string }, { output: string }> {
  constructor() {
    super('my-task', 'my_capability');
  }

  async execute(ctx: RunContext, input: { input: string }) {
    // Implementation
    return { output: 'result' };
  }
}
```

Register in `bin/interactive.tsx`:
```typescript
capabilityRegistry.register(
  { name: 'my_capability', sideEffects: false },
  new MyTask()
);
```

### Add a New Tool

```typescript
export class MyTool extends Tool<{ input: string }, { result: string }> {
  name() { return 'my_tool'; }
  description() { return 'My custom tool'; }

  async _call(args: { input: string }) {
    return { result: 'processed' };
  }
}
```

Register in `bin/interactive.tsx`:
```typescript
toolRegistry.register(new MyTool());
```

## Example Sessions

### Local Ollama
```bash
ollama serve
ollama pull llama3.1

acm-aicoder \
  --llm-model llama3.1 \
  --llm-base-url http://localhost:11434 \
  --llm-engine runtime \
  --workspace ~/project
```

### OpenAI
```bash
export OPENAI_API_KEY="sk-..."

acm-aicoder \
  --llm-model gpt-4o \
  --llm-base-url https://api.openai.com \
  --llm-engine langgraph \
  --workspace ~/project \
  --budget-usd 5
```

## Capabilities

### Analysis (No Side Effects)
- `analyze_workspace` - Deep codebase analysis
- `collect_context_pack` - Generate context for planning
- `search_code` - BM25-based code search
- `find_symbol_definition` - Locate symbols

### Development (Side Effects)
- `implement_function` - Create implementations
- `refactor_rename_symbol` - Rename with tracking
- `fix_type_error` - Fix TypeScript errors
- `generate_unit_tests` - Generate test scaffolding

## Troubleshooting

### Missing Parameters
Ensure all required flags are provided. Check error message for details.

### Budget Exceeded
- Increase: `--budget-usd 20`
- Use local: `--llm-model llama3.1 --llm-base-url http://localhost:11434`

### Layout Issues
- Terminal must be ≥80 columns wide
- Use standard terminal emulators

For more details, see [AICODER_IMPLEMENTATION_PLAN_PHASE2.md](../AICODER_IMPLEMENTATION_PLAN_PHASE2.md)
