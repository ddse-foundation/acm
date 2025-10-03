# ACM AI Coder Demo

Production-ready AI-powered developer workflow automation using the ACM (Agentic Contract Model) framework.

## Overview

The ACM AI Coder is a CLI tool that demonstrates the full capabilities of the ACM framework for real developer workflows:

- **Code Analysis**: Deep codebase analysis with issue detection
- **Bug Fixing**: AI-assisted bug detection and fixing with approval workflows
- **Feature Implementation**: Automated feature scaffolding and implementation
- **Test Execution**: Run tests and capture results
- **Checkpointing & Resume**: Automatic checkpoints with resume support for long-running operations
- **Safety First**: Dry-run mode, approval workflows, and policy enforcement

## Features

### Code Intelligence Toolkit

- **CodeReadTool**: Read files and directories with size limits
- **CodeEditTool**: Edit files with diff tracking and git integration
- **CodeAnalyzeTool**: Static analysis and issue detection
- **TestRunnerTool**: Execute test suites and capture results

### AI-Powered Tasks

- **AnalyzeCodebaseTask**: Comprehensive codebase analysis
- **FixBugTask**: Intelligent bug fixing with verification
- **ImplementFeatureTask**: Feature scaffolding and implementation
- **RunTestsTask**: Test execution with result reporting

## Installation

```bash
# From the workspace root
pnpm install

# Build the package
pnpm --filter @acm/aicoder build
```

## Usage

### Basic Commands

```bash
# Analyze a codebase
acm-aicoder --goal analyze

# Fix a bug (dry-run first)
acm-aicoder --goal fixBug --dry-run

# Implement a new feature
acm-aicoder --goal implementFeature

# Run tests
acm-aicoder --goal runTests
```

### Interactive Custom Goals

```bash
# Start interactive mode
acm-aicoder --goal custom
```

### Advanced Options

```bash
# Use a specific LLM provider
acm-aicoder --provider vllm --model qwen2.5:7b --base-url http://localhost:8000

# Auto-approve all operations (use with caution!)
acm-aicoder --goal fixBug --auto-approve

# Analysis only mode (no modifications)
acm-aicoder --goal analyze --analysis-only

# Resume from checkpoint
acm-aicoder --resume run-1234567890

# Custom checkpoint directory
acm-aicoder --goal fixBug --checkpoint-dir ./my-checkpoints
```

## Architecture

### Workflow

1. **Planning Phase**: LLM analyzes the goal and context, generates multiple plan options
2. **Selection Phase**: User selects a plan (or auto-selected if only one)
3. **Approval Phase**: User approves operations that modify code (unless auto-approve)
4. **Execution Phase**: ACM runtime executes the plan with streaming updates
5. **Checkpointing**: Automatic checkpoints after each task
6. **Verification**: Tasks verify their outputs match expectations

### Safety Features

- **Dry Run Mode**: Preview all changes without modifying files
- **Approval Workflow**: User approval required for file modifications
- **Policy Engine**: Enforces path restrictions and operation rules
- **Checkpointing**: Resume from any point if execution is interrupted
- **Git Integration**: Track changes and enable rollback

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

### Example 1: Analyze a React Project

```bash
acm-aicoder --goal analyze
```

This will:
1. Read the project structure
2. Analyze TypeScript/JavaScript files
3. Detect common issues (console.log, TODO comments, etc.)
4. Generate a comprehensive report

### Example 2: Fix Console.log Statements

```bash
# Preview changes first
acm-aicoder --goal fixBug --dry-run

# Apply changes (requires approval)
acm-aicoder --goal fixBug
```

### Example 3: Implement Authentication Feature

```bash
acm-aicoder --goal implementFeature
```

This will:
1. Scaffold the authentication module
2. Generate boilerplate code
3. Add TODO comments for manual implementation
4. Optionally run tests

### Example 4: Long-Running Operation with Resume

```bash
# Start a long operation
acm-aicoder --goal implementFeature

# If interrupted (Ctrl+C), resume later
acm-aicoder --resume run-1234567890
```

## Configuration

Create an `aicoder.config.json` file in your project root:

```json
{
  "provider": "ollama",
  "model": "llama3.1",
  "autoApprove": false,
  "checkpointDir": "./checkpoints",
  "allowedPaths": ["./src", "./lib"],
  "blockedActions": []
}
```

## API

You can also use the AI Coder programmatically:

```typescript
import {
  CodeReadTool,
  CodeEditTool,
  AnalyzeCodebaseTask,
  SimpleCapabilityRegistry,
  SimpleToolRegistry,
} from '@acm/aicoder';
import { executeResumablePlan } from '@acm/runtime';

// Setup registries
const toolRegistry = new SimpleToolRegistry();
toolRegistry.register(new CodeReadTool());
toolRegistry.register(new CodeEditTool());

const capabilityRegistry = new SimpleCapabilityRegistry();
capabilityRegistry.register(
  { name: 'analyze_codebase', sideEffects: false },
  new AnalyzeCodebaseTask()
);

// Execute
const result = await executeResumablePlan({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry,
  // ... other options
});
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## License

MIT
