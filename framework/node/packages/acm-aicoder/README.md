# ACM AI Coder Demo

An advanced AI-powered developer workflow automation tool that showcases the full capabilities of the ACM (Agentic Contract Model) framework with real, working tools and intelligent planning.

## Overview

The ACM AI Coder demonstrates the complete ACM framework with:

- **Intelligent Context Engine**: Deep repository understanding with file indexing, symbol extraction, dependency mapping, and BM25-based code search
- **Enhanced Developer Tools**: 10+ production-grade tools for reading, searching, editing, testing, and building code
- **Real Developer Tasks**: 13+ composable tasks for finding symbols, implementing functions, refactoring, fixing errors, and generating tests
- **Smart Planning**: Context-aware planning with the ACM planner, fed with relevant files, symbols, and dependencies
- **Safety First**: Dry-run mode, approval workflows, policy enforcement, and automatic backups
- **Resumable Execution**: Checkpoint/resume support for long-running operations

## Features

### Context Engine (Intelligent Repository Understanding)

The context engine provides deep understanding of your codebase:

- **Workspace Indexer**: Fast file scanning with gitignore support and caching
- **Symbol Extraction**: Parse TS/JS for functions, classes, interfaces, types, and exports
- **Dependency Mapper**: Analyze package.json files and track dependencies
- **Test Mapper**: Identify test files and infer their target sources
- **Code Search**: BM25-based semantic search with context and scoring
- **Context Pack Generator**: Automatically gather relevant files and symbols for planning

### Enhanced Tools (V2)

**Reading & Search:**
- `FileStatTool` - Check file existence, size, and type
- `FileReadToolV2` - Read files with offset/limit for large files
- `FileReadLinesTool` - Precise line-ranged reading
- `CodeSearchTool` - BM25-based search with context
- `GrepTool` - Pattern-based multi-file search
- `DiffTool` - Generate unified diffs

**Editing & Building:**
- `PatchApplyTool` - Apply diffs with conflict handling
- `CodeEditToolV2` - Enhanced editing with backups
- `RunTestsToolV2` - Execute tests with duration tracking
- `BuildTool` - Run builds with error extraction

### Developer Tasks

**Analysis Tasks:**
- `AnalyzeWorkspaceTask` - Deep codebase analysis with stats
- `CollectContextPackTask` - Generate context for planning
- `SearchCodeTask` - Search with relevance scoring

**Development Tasks:**
- `FindSymbolDefinitionTask` - Locate symbols across codebase
- `ImplementFunctionTask` - Create functions with AI assistance
- `RefactorRenameSymbolTask` - Rename symbols with tracking
- `FixTypeErrorTask` - Resolve TypeScript errors
- `GenerateUnitTestsTask` - Generate test templates

## Installation

```bash
# From the workspace root
pnpm install

# Build the package
pnpm --filter @acm/aicoder build
```

## Usage

### Quick Start

```bash
# Analyze your codebase with context engine
pnpm --filter @acm/aicoder exec acm-aicoder --goal analyze

# Search for code
pnpm --filter @acm/aicoder exec acm-aicoder --goal custom
# Then enter: "Find all function definitions in the codebase"

# Fix a bug with AI assistance (dry-run first)
pnpm --filter @acm/aicoder exec acm-aicoder --goal fixBug --dry-run

# Generate tests for a file
pnpm --filter @acm/aicoder exec acm-aicoder --goal custom
# Then enter: "Generate unit tests for src/utils.ts"
```

### Command-Line Options

```bash
# LLM Configuration
--provider <ollama|vllm>    # LLM provider (default: ollama)
--model <name>              # Model name (default: llama3.1)
--base-url <url>            # Override API base URL

# Goals
--goal <goal>               # Goal to execute:
                            #   analyze - Deep workspace analysis
                            #   fixBug - Fix bugs with AI
                            #   implementFeature - Scaffold features
                            #   runTests - Run test suite
                            #   custom - Interactive custom goal

# Execution Control
--no-stream                 # Disable streaming output
--auto-approve              # Auto-approve all operations (use with caution!)
--dry-run                   # Preview changes without writing files
--analysis-only             # Only analyze, don't make changes

# Context & Search
--workspace <path>          # Workspace root (default: current directory)
--max-file-bytes <n>        # Max file size to index (default: 1MB)
--search-k <n>              # Number of search results (default: 10)

# Resumability
--resume <runId>            # Resume from a previous execution
--checkpoint-dir <path>     # Directory for checkpoints (default: ./checkpoints)
--plans <1|2>               # Number of alternative plans (default: 1)

# Help
-h, --help                  # Show help
```

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
import { LLMPlanner } from '@acm/planner';
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
const planner = new LLMPlanner();

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

## Development

### Building

```bash
# Build TypeScript
pnpm --filter @acm/aicoder build

# Watch mode for development
pnpm --filter @acm/aicoder dev
```

### Testing

```bash
# Run integration tests (coming soon)
pnpm --filter @acm/aicoder test
```
