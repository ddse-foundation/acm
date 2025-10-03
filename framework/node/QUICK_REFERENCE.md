# Quick Reference Guide

Fast reference for common ACM framework tasks.

## Installation & Setup

```bash
# Clone and install
git clone https://github.com/ddse-foundation/acm.git
cd acm/framework/node
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Running Examples

```bash
# Basic demo
pnpm --filter @acm/examples demo -- --goal refund

# With specific LLM provider
pnpm --filter @acm/examples demo -- --provider ollama --model llama3.1

# With LangGraph engine
pnpm --filter @acm/examples demo -- --engine langgraph

# Save replay bundle
pnpm --filter @acm/examples demo -- --save-bundle

# With MCP tools
pnpm --filter @acm/examples demo -- \
  --use-mcp \
  --mcp-server 'npx -y @modelcontextprotocol/server-filesystem /tmp'

# All options
pnpm --filter @acm/examples demo -- --help
```

## Using MCP Servers

### Filesystem
```bash
--use-mcp --mcp-server 'npx -y @modelcontextprotocol/server-filesystem /tmp'
```

### GitHub (requires GITHUB_TOKEN)
```bash
export GITHUB_TOKEN=your_token
--use-mcp --mcp-server 'npx -y @modelcontextprotocol/server-github'
```

### Memory
```bash
--use-mcp --mcp-server 'npx -y @modelcontextprotocol/server-memory'
```

### Brave Search (requires BRAVE_API_KEY)
```bash
export BRAVE_API_KEY=your_key
--use-mcp --mcp-server 'npx -y @modelcontextprotocol/server-brave-search'
```

## Code Examples

### Basic Tool

```typescript
import { Tool } from '@acm/sdk';

class MyTool extends Tool<{ input: string }, { output: string }> {
  name() { return 'my-tool'; }
  
  async call(input: { input: string }) {
    return { output: `Processed: ${input.input}` };
  }
}
```

### Basic Task

```typescript
import { Task, type RunContext } from '@acm/sdk';

class MyTask extends Task<{ query: string }, { result: any }> {
  constructor() {
    super('my-task-id', 'my-capability');
  }
  
  async execute(ctx: RunContext, input: { query: string }) {
    const tool = ctx.getTool('my-tool');
    const result = await tool.call({ input: input.query });
    return { result };
  }
}
```

### Execute Plan

```typescript
import { executePlan } from '@acm/runtime';

const result = await executePlan({
  goal: { id: 'g1', intent: 'Do something' },
  context: { id: 'ctx1', facts: {} },
  plan,
  capabilityRegistry,
  toolRegistry,
});
```

### MCP Integration

```typescript
import { McpClientManager, McpToolRegistry, CombinedToolRegistry } from '@acm/mcp';

const manager = new McpClientManager();
await manager.connect({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
});

const mcpRegistry = new McpToolRegistry(manager);
const toolRegistry = new CombinedToolRegistry(localTools, mcpRegistry);

// Use in execution...

await manager.disconnect();
```

### LangGraph Adapter

```typescript
import { asLangGraph } from '@acm/adapters';

const adapter = asLangGraph({
  goal, context, plan,
  capabilityRegistry, toolRegistry,
  policy, stream, ledger,
});

const result = await adapter.execute();
```

### MS Agent Framework Adapter

```typescript
import { wrapAgentNodes } from '@acm/adapters';

const adapter = wrapAgentNodes({
  goal, context, plan,
  capabilityRegistry, toolRegistry,
  policy, stream, ledger,
});

const result = await adapter.execute();
```

### Replay Bundle

```typescript
import { ReplayBundleExporter } from '@acm/replay';

// Export
await ReplayBundleExporter.export({
  outputDir: './replay/run-123',
  goal, context, plans,
  selectedPlanId: plan.id,
  ledger: ledger.getEntries(),
  taskIO,
});

// Load
const bundle = await ReplayBundleExporter.load('./replay/run-123');

// Validate
const { valid, errors } = await ReplayBundleExporter.validate('./replay/run-123');
```

### BM25 Search

```typescript
import { BM25Search } from '@acm/examples/search';

const search = new BM25Search();
search.index(documents);

const results = search.search('query', 10);
for (const result of results) {
  console.log(`Score: ${result.score}`, result.document);
}
```

## Testing

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @acm/examples test

# Specific test suite
pnpm --filter @acm/examples test:bm25

# Build and test
pnpm build && pnpm test
```

## Development

```bash
# Watch mode for development
pnpm dev

# Build specific package
pnpm --filter @acm/sdk build

# Clean build artifacts
pnpm clean

# Clean and rebuild
pnpm clean && pnpm build
```

## Package Commands

```bash
# SDK package
pnpm --filter @acm/sdk <command>

# Runtime package
pnpm --filter @acm/runtime <command>

# LLM package
pnpm --filter @acm/llm <command>

# Planner package
pnpm --filter @acm/planner <command>

# MCP package
pnpm --filter @acm/mcp <command>

# Adapters package
pnpm --filter @acm/adapters <command>

# Replay package
pnpm --filter @acm/replay <command>

# Examples package
pnpm --filter @acm/examples <command>
```

## Common CLI Flags

```
--provider <ollama|vllm>     LLM provider
--model <name>               Model name
--base-url <url>             API endpoint
--engine <runtime|langgraph|msaf>  Execution engine
--goal <refund|issues>       Example goal
--no-stream                  Disable streaming
--save-bundle                Export replay bundle
--use-mcp                    Enable MCP tools
--mcp-server <command>       MCP server command
--help, -h                   Show help
```

## Directory Structure

```
framework/node/
├── packages/
│   ├── acm-sdk/              # Core types & abstracts
│   ├── acm-runtime/          # Execution engine
│   ├── acm-llm/              # LLM integration
│   ├── acm-planner/          # Plan generation
│   ├── acm-mcp/              # MCP integration
│   ├── acm-adapters/         # Framework adapters
│   ├── acm-replay/           # Replay bundles
│   └── acm-examples/         # Examples & demos
│       ├── bin/              # CLI entry point
│       ├── src/              # Example code
│       │   ├── goals/        # Goal definitions
│       │   ├── tasks/        # Task implementations
│       │   ├── tools/        # Tool implementations
│       │   └── search/       # BM25 search
│       ├── data/             # Synthetic data
│       └── tests/            # Test suites
├── README.md                 # Main documentation
├── MCP_EXAMPLES.md           # MCP usage guide
├── TESTING.md                # Testing guide
└── IMPLEMENTATION_COMPLETE.md # Summary
```

## Important Files

| File | Description |
|------|-------------|
| `README.md` | Main framework documentation |
| `CHANGELOG.md` | Version history and changes |
| `MCP_EXAMPLES.md` | MCP integration examples |
| `TESTING.md` | Testing guide |
| `IMPLEMENTATION_COMPLETE.md` | Feature summary |
| `packages/*/README.md` | Package-specific docs |

## Quick Troubleshooting

**Build fails**: Run `pnpm install && pnpm build`

**Tests fail**: Check that data files exist in `packages/acm-examples/data/`

**MCP connection issues**: Verify MCP server command is correct

**Import errors**: Ensure all packages are built

**Type errors**: Run `pnpm build` to regenerate types

## Learn More

- **Full Documentation**: [README.md](./README.md)
- **MCP Usage**: [MCP_EXAMPLES.md](./MCP_EXAMPLES.md)
- **Testing**: [TESTING.md](./TESTING.md)
- **ACM Spec**: [../../spec/acm-spec v0.5.md](../../spec/acm-spec%20v0.5.md)
- **Implementation Details**: [IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md)

## Getting Help

1. Check package README files
2. Review examples in `packages/acm-examples/`
3. Read the guides (MCP_EXAMPLES.md, TESTING.md)
4. Check IMPLEMENTATION_COMPLETE.md for features
5. Review ACM specification

---

**Quick Links**
- [Main README](./README.md)
- [MCP Examples](./MCP_EXAMPLES.md)
- [Testing Guide](./TESTING.md)
- [Implementation Summary](./IMPLEMENTATION_COMPLETE.md)
