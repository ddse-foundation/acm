# ACM AI Coder - Phase 2

<!-- markdownlint-disable MD024 MD032 -->

An advanced AI-powered developer workflow automation tool with an interactive full-screen TUI that showcases the complete ACM (Agentic Contract Model) framework v0.5.

## Overview

The ACM AI Coder Phase 2 introduces an **interactive-only experience** with a three-column terminal UI:

- **Left Column**: Chat interface with streaming planner and nucleus reasoning
- **Middle Column**: Current goal, tasks with live status, and budget metrics
- **Right Column**: Event stream showing ledger entries, tool calls, and context updates

### Key Features

- ✅ **Interactive-Only TUI**: Full-screen terminal interface with real-time updates
- ✅ **Mandatory Configuration**: Requires `--provider`, `--model`, and `--workspace` flags with optional `--base-url`
- ✅ **Budget Governance**: Pre-inference cost checks with live spend tracking
- ✅ **Streaming Reasoning**: Watch planner and nucleus think in real-time
- ✅ **File Mentions**: Reference workspace files with `#path/to/file` syntax
- ✅ **Memory Lifecycle**: Automatic cleanup and replay bundle persistence
- ✅ **ACM Framework Integration**: Built entirely on ACM primitives (planner, runtime, nucleus, ledger)

## Installation

```bash
# From the workspace root
pnpm install

# Build the package
pnpm --filter @acm/aicoder build
```

## Quick Start

### Phase 2 Interactive Mode (Recommended)

```bash
# Start the interactive AI Coder
acm-aicoder \
  --provider vllm \
  --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 \
  --base-url http://localhost:8001/v1 \
  --workspace /path/to/your/project
```

**Required Parameters:**

- `--provider <ollama|vllm>` - LLM provider (default: ollama)
- `--model <name>` - Model identifier provided by the selected provider
- `--workspace <path>` - Project workspace root directory

**Optional Parameters:**

- `--base-url <url>` - Override provider base URL when using a custom endpoint
- `--temperature <0-2>` - LLM temperature (default: 0.7)
- `--seed <number>` - Random seed for reproducibility
- `--plans <1|2>` - Number of alternative plans to generate (default: 1)

### Commands in Interactive Mode

Once running, you can use these commands:

- `/exit`, `/quit` - Exit the application
- `/help` - Show available commands
- `/budget` - Display detailed budget information
- `/context` - Show current context information
- `/reset` - Reset the session (clear goal and tasks)
- `#path/to/file` - Mention files from your workspace in chat

**Example Session:**

```text
> Analyze the src/index.ts file and find potential bugs

[Planner will reason about the task, select appropriate capabilities]
[Tasks will execute with live status updates]
[Events will stream in the right column]
```

## ACM Framework Integration

Phase 2 is built strictly on ACM v0.5 components:

### Planner & Nucleus

- Chat pane visualizes ACM planner tool-call loops and nucleus inferences in real-time
- Streaming tokens show reasoning as it happens
- Budget checks run before each inference

#### Nucleus configuration requirements

- Every runtime invocation now passes a `nucleusFactory` and `nucleusConfig` to `executePlan`. The CLI wires these from the `--llm-provider`, `--llm-model`, `--llm-base-url`, and `--llm-engine` flags to build a shared `DeterministicNucleus` instance.
- If you embed AI Coder components elsewhere, supply your own factory that returns a `Nucleus` subclass and include at minimum an `llmCall` block with `provider`, `model`, and token limits.
- Tests and examples provide lightweight stub nuclei; use them as a reference when authoring new scripts or integrations.

### Tools & Tasks

- All tools extend `Tool<I, O>` from `@acm/sdk`
- Tasks extend `Task<I, O>` and leverage context builder
- Tool call envelopes logged to ledger for determinism

### Context Packets

- Context orchestration uses Phase 4 `ContextBuilder`
- Immutable packets with provenance and sources
- View current context with `/context` command

### Ledger & Replay

- Event stream pane visualizes ledger entries
- Replay bundles saved automatically to `.aicoder/replays/`
- Includes session config, ledger, and budget summary

### Budget Enforcement

- BudgetManager enforces spending limits before inference
- Provider metadata for OpenAI, Anthropic, Ollama, and more
- Real-time budget display in Tasks column

## Architecture

The ACM AI Coder is built on the ACM framework and showcases all its capabilities:

### ACM Framework Integration

1. **SDK Layer**: All tools and tasks extend `Tool<I, O>` and `Task<I, O>` from `@acm/sdk`
2. **Context Engine**: Intelligent repository understanding feeds into planning
3. **Planning Phase**: LLM analyzes goal + context, generates Plan-A and Plan-B
4. **Runtime Execution**: `@acm/runtime` executes plans with streaming, checkpoints, and verification
5. **Policy Engine**: Safety guards with path restrictions and action gating
6. **Replay Bundle**: Complete audit trail via `@acm/replay`

### Workflow

1. **Indexing**: Scan workspace, extract symbols, dependencies, and tests
2. **Context Generation**: Create context pack with relevant files and symbols
3. **Planning**: Feed context to LLM planner for multi-step plan generation
4. **Approval**: User approves plan and operations that modify code
5. **Execution**: ACM runtime executes with streaming progress
6. **Checkpointing**: Automatic checkpoints after each task
7. **Verification**: Tasks verify outputs match expectations

### Safety Features

- **Dry Run Mode**: Preview all changes without modifying files
- **Approval Workflow**: User approval required for file modifications
- **Policy Engine**: Path allowlists and action restrictions
- **Automatic Backups**: `.backup` files created before edits
- **Checkpointing**: Resume from any point if execution is interrupted
- **Context Limits**: File size and result count limits prevent overload

## How It Showcases ACM

This tool demonstrates every aspect of the ACM framework:

- **Capability Model**: Tasks are registered as capabilities with clear contracts
- **Tool Composition**: Tasks compose multiple tools to accomplish goals
- **Context Packets**: Immutable context with content-addressable refs
- **Plan Alternatives**: Planner generates Plan-A and Plan-B with rationale
- **Deterministic Execution**: Runtime executes plans with guards and verification
- **Policy Integration**: Pre/post hooks for safety enforcement
- **Memory Ledger**: Complete audit trail of all decisions
- **Streaming**: Real-time progress via StreamSink
- **Resumability**: FileCheckpointStore enables resume from crashes

## Development

### Running Tests

```bash
# Run integration tests
pnpm --filter @acm/aicoder test
```

<!-- markdownlint-enable MD024 MD032 -->

### Building

```bash
# Build TypeScript
pnpm --filter @acm/aicoder build

# Watch mode for development
pnpm --filter @acm/aicoder dev
```

## Examples

### Example 1: Deep Workspace Analysis

```bash
pnpm --filter @acm/aicoder exec acm-aicoder --goal analyze --workspace .
```

This will:

1. Index all files in the workspace (respecting gitignore)
2. Extract symbols (functions, classes, interfaces)
3. Map dependencies from package.json
4. Identify test files and their targets
5. Generate a comprehensive report with statistics

Output includes:

- Total files scanned
- Code files by language
- Symbols extracted (functions, classes, etc.)
- Dependencies found
- Test file mappings

### Example 2: Search for Code Patterns

```bash
pnpm --filter @acm/aicoder exec acm-aicoder --goal custom
# Enter: "Search for all error handling patterns in the codebase"
```

This will:

1. Build BM25 index of code files
2. Search for "error handling try catch" patterns
3. Return top-k results with context
4. Show file paths, line numbers, and code snippets

### Example 3: Implement a New Function

```bash
pnpm --filter @acm/aicoder exec acm-aicoder --goal custom
# Enter: "Implement a function to validate email addresses in src/utils.ts"
```

This will:

1. Read the target file
2. Analyze existing code patterns
3. Generate function implementation (with LLM)
4. Show diff preview
5. Request approval
6. Apply changes with automatic backup

### Example 4: Refactor Symbol Names

```bash
pnpm --filter @acm/aicoder exec acm-aicoder --goal custom
# Enter: "Rename function getUserData to fetchUserData everywhere"
```

This will:

1. Search for all occurrences of the symbol
2. Generate list of affected files
3. Show preview of changes
4. Request approval
5. Apply rename across all files (with backup)

### Example 5: Fix TypeScript Errors

```bash
pnpm --filter @acm/aicoder exec acm-aicoder --goal custom
# Enter: "Fix all TypeScript compilation errors"
```

This will:

1. Run build to collect TypeScript errors
2. Analyze each error with context
3. Generate fixes (with LLM)
4. Show diffs for each fix
5. Request approval
6. Apply fixes and verify build succeeds

### Example 6: Generate Unit Tests

```bash
pnpm --filter @acm/aicoder exec acm-aicoder --goal custom
# Enter: "Generate unit tests for the validateEmail function in src/utils.ts"
```

This will:

1. Read and analyze the target function
2. Generate test cases (with LLM)
3. Create test file (e.g., `src/utils.test.ts`)
4. Show preview
5. Request approval
6. Apply and run tests to verify

### Example 7: Resume from Checkpoint

```bash
# Start a long operation
pnpm --filter @acm/aicoder exec acm-aicoder --goal implementFeature

# If interrupted (Ctrl+C), resume later:
pnpm --filter @acm/aicoder exec acm-aicoder --resume run-1696348800000
```

The resume will:

1. Load checkpoint from disk
2. Restore plan and completed tasks
3. Continue from the next task
4. Maintain all context and state

## Key Components

### Context Engine

Located in `src/context/`:

- **WorkspaceIndexer**: Fast file scanning with caching
- **SymbolExtractor**: Parse TS/JS for symbols
- **DependencyMapper**: Extract package.json dependencies
- **TestMapper**: Identify test files
- **CodeSearch**: BM25-based semantic search
- **ContextPackGenerator**: Generate planning context

### Tools V2

Located in `src/tools-v2/`:

- **read-tools.ts**: FileStatTool, FileReadToolV2, FileReadLinesTool, DiffTool
- **search-tools.ts**: CodeSearchTool, GrepTool
- **edit-tools.ts**: PatchApplyTool, CodeEditToolV2
- **test-tools.ts**: RunTestsToolV2, BuildTool

### Tasks V2

Located in `src/tasks-v2/`:

- **analysis-tasks.ts**: AnalyzeWorkspaceTask, CollectContextPackTask, SearchCodeTask
- **developer-tasks.ts**: FindSymbolDefinitionTask, ImplementFunctionTask, RefactorRenameSymbolTask, FixTypeErrorTask, GenerateUnitTestsTask

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## License

MIT

You can also use the AI Coder programmatically:

```typescript
import {
  // Context Engine
  WorkspaceIndexer,
  SymbolExtractor,
  CodeSearch,
  ContextPackGenerator,
  
  // Tools V2
  FileStatTool,
  FileReadToolV2,
  CodeSearchTool,
  GrepTool,
  DiffTool,
  PatchApplyTool,
  CodeEditToolV2,
  RunTestsToolV2,
  BuildTool,
  
  // Tasks V2
  AnalyzeWorkspaceTask,
  FindSymbolDefinitionTask,
  ImplementFunctionTask,
  RefactorRenameSymbolTask,
  GenerateUnitTestsTask,
  CollectContextPackTask,
  
  // Registries
  SimpleCapabilityRegistry,
  SimpleToolRegistry,
  SimplePolicyEngine,
} from '@acm/aicoder';

import { executeResumablePlan } from '@acm/runtime';
import { StructuredLLMPlanner } from '@acm/planner';
import { createOllamaClient } from '@acm/llm';

// Setup
const rootPath = process.cwd();

// 1. Build workspace index
const indexer = new WorkspaceIndexer(rootPath);
const index = await indexer.buildIndex();

// 2. Setup search
const search = new CodeSearch(rootPath);
await search.indexFiles(index);

// 3. Register tools
const toolRegistry = new SimpleToolRegistry();
toolRegistry.register(new FileStatTool());
toolRegistry.register(new CodeSearchTool(rootPath));
toolRegistry.register(new GrepTool(rootPath));
toolRegistry.register(new CodeEditToolV2());
toolRegistry.register(new RunTestsToolV2());
toolRegistry.register(new BuildTool());

// 4. Register tasks
const capabilityRegistry = new SimpleCapabilityRegistry();
capabilityRegistry.register(
  { name: 'analyze_workspace', sideEffects: false },
  new AnalyzeWorkspaceTask()
);
capabilityRegistry.register(
  { name: 'find_symbol', sideEffects: false },
  new FindSymbolDefinitionTask()
);
capabilityRegistry.register(
  { name: 'implement_function', sideEffects: true },
  new ImplementFunctionTask()
);

// 5. Create context pack
const symbolExtractor = new SymbolExtractor(rootPath);
const symbols = await symbolExtractor.extractSymbols(index);

const packGenerator = new ContextPackGenerator(search);
const contextPack = await packGenerator.generate(
  'Find and fix all TypeScript errors',
  index,
  symbols,
  [], // dependencies
  [], // test mappings
  { maxFiles: 10, maxSymbols: 30 }
);

// 6. Plan with context
const llm = createOllamaClient('llama3.1');
const planner = new StructuredLLMPlanner();

const goal = {
  id: 'goal-1',
  intent: 'Find and fix all TypeScript errors',
  constraints: {},
};

const context = {
  id: 'ctx-1',
  facts: { contextPack },
  version: '1.0',
};

const plannerResult = await planner.plan({
  goal,
  context,
  capabilities: capabilityRegistry.list(),
  llm,
});

// 7. Execute with runtime
const policy = new SimplePolicyEngine();
policy.setAllowedPaths(['src/**']);

const result = await executeResumablePlan({
  goal,
  context,
  plan: plannerResult.plans[0],
  capabilityRegistry,
  toolRegistry,
  policy,
  verify: async (taskId, output, expressions) => true,
  runId: `run-${Date.now()}`,
});

console.log('Execution complete:', result);
```

## Reference Pipeline Walkthrough

### Build from Source

```bash
# Build TypeScript
pnpm --filter @acm/aicoder build

# Watch mode for development
pnpm --filter @acm/aicoder dev
```

### Test Suite (Preview)

```bash
# Run integration tests (coming soon)
pnpm --filter @acm/aicoder test
```
