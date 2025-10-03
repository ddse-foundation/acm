# MCP Tool Integration Examples

This document provides examples of using MCP (Model Context Protocol) servers with ACM.

## Available Free MCP Servers

### Filesystem Server

Access local filesystem operations:

```bash
# Run with filesystem MCP server
pnpm --filter @acm/examples demo -- \
  --use-mcp \
  --mcp-server 'npx -y @modelcontextprotocol/server-filesystem /tmp' \
  --goal issues
```

Available tools:
- `read_file`: Read file contents
- `write_file`: Write to a file
- `list_directory`: List directory contents
- `create_directory`: Create a directory
- `move_file`: Move/rename files
- `search_files`: Search for files

### GitHub Server

Interact with GitHub repositories:

```bash
# Set GitHub token
export GITHUB_TOKEN=your_token_here

# Run with GitHub MCP server
pnpm --filter @acm/examples demo -- \
  --use-mcp \
  --mcp-server 'npx -y @modelcontextprotocol/server-github' \
  --goal issues
```

Available tools:
- `create_issue`: Create GitHub issue
- `create_pull_request`: Create PR
- `search_repositories`: Search repos
- `get_file_contents`: Get file from repo

### Memory Server

Simple key-value storage:

```bash
# Run with memory MCP server
pnpm --filter @acm/examples demo -- \
  --use-mcp \
  --mcp-server 'npx -y @modelcontextprotocol/server-memory' \
  --goal refund
```

Available tools:
- `store_memory`: Store key-value pair
- `retrieve_memory`: Retrieve value by key
- `list_memories`: List all stored keys

### Brave Search Server

Web search via Brave:

```bash
# Set Brave API key
export BRAVE_API_KEY=your_key_here

# Run with Brave search MCP server
pnpm --filter @acm/examples demo -- \
  --use-mcp \
  --mcp-server 'npx -y @modelcontextprotocol/server-brave-search' \
  --goal issues
```

Available tools:
- `brave_web_search`: Search the web
- `brave_local_search`: Local business search

## Using MCP in Your Code

### Basic Setup

```typescript
import { McpClientManager, McpToolRegistry, CombinedToolRegistry } from '@acm/mcp';
import { SimpleToolRegistry } from '@acm/examples/registries';

// Connect to MCP server
const mcpManager = new McpClientManager();
await mcpManager.connect({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
});

// Create tool registry
const mcpRegistry = new McpToolRegistry(mcpManager);

// Combine with local tools
const localTools = new SimpleToolRegistry();
// ... register local tools

const toolRegistry = new CombinedToolRegistry(localTools, mcpRegistry);

// Use in execution
const result = await executePlan({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry, // Combined registry
  // ...
});

// Cleanup
await mcpManager.disconnect();
```

### Creating MCP-Aware Tasks

```typescript
import { Task, type RunContext } from '@acm/sdk';

class FileSearchTask extends Task<
  { directory: string; pattern: string },
  { files: string[] }
> {
  constructor() {
    super('file-search-task', 'file_search');
  }

  async execute(
    ctx: RunContext,
    input: { directory: string; pattern: string }
  ): Promise<{ files: string[] }> {
    // Get MCP tool
    const searchTool = ctx.getTool('search_files');
    if (!searchTool) {
      throw new Error('search_files tool not available');
    }

    // Call MCP tool
    const result = await searchTool.call({
      path: input.directory,
      pattern: input.pattern,
    });

    return {
      files: result.files || [],
    };
  }
}
```

### Error Handling

```typescript
try {
  await mcpManager.connect({
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  });
  
  if (!mcpManager.isConnected()) {
    throw new Error('Failed to connect to MCP server');
  }

  console.log(`Connected! Available tools: ${mcpRegistry.list().join(', ')}`);
  
  // Use tools...
  
} catch (error) {
  console.error('MCP error:', error);
} finally {
  await mcpManager.disconnect();
}
```

### Checking Available Tools

```typescript
const mcpRegistry = new McpToolRegistry(mcpManager);

// List all tools
console.log('Available MCP tools:');
for (const toolName of mcpRegistry.list()) {
  const tool = mcpRegistry.get(toolName);
  console.log(`  - ${toolName}`);
  if (tool?.schema()) {
    console.log(`    Schema: ${JSON.stringify(tool.schema(), null, 2)}`);
  }
}
```

## Example: File-Based Workflow

Complete example using filesystem MCP server:

```typescript
import { McpClientManager, McpToolRegistry, CombinedToolRegistry } from '@acm/mcp';
import { executePlan } from '@acm/runtime';
import { SimpleCapabilityRegistry, SimpleToolRegistry } from '@acm/examples/registries';

async function runFileWorkflow() {
  // Setup MCP
  const mcpManager = new McpClientManager();
  await mcpManager.connect({
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  });

  // Create registries
  const mcpRegistry = new McpToolRegistry(mcpManager);
  const localTools = new SimpleToolRegistry();
  const toolRegistry = new CombinedToolRegistry(localTools, mcpRegistry);

  const capabilityRegistry = new SimpleCapabilityRegistry();
  // ... register capabilities

  // Define goal and context
  const goal = {
    id: 'file-analysis',
    intent: 'Analyze files in /tmp and generate report',
  };

  const context = {
    id: 'ctx-1',
    facts: { directory: '/tmp' },
  };

  // Create plan (or use LLM planner)
  const plan = {
    id: 'plan-1',
    contextRef: 'ctx-1',
    capabilityMapVersion: 'v1',
    tasks: [
      {
        id: 't1',
        capability: 'list_files',
        input: { path: '/tmp' },
      },
      {
        id: 't2',
        capability: 'analyze_files',
        input: {}, // Will use output from t1
      },
    ],
    edges: [
      { from: 't1', to: 't2' },
    ],
  };

  // Execute
  const result = await executePlan({
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
  });

  console.log('Results:', result.outputsByTask);

  // Cleanup
  await mcpManager.disconnect();
}

runFileWorkflow().catch(console.error);
```

## Tips

1. **Environment Variables**: Many MCP servers require API keys or configuration via environment variables

2. **Tool Discovery**: Use `mcpRegistry.list()` to see what tools are available

3. **Combined Registry**: Always use `CombinedToolRegistry` to merge local and MCP tools seamlessly

4. **Connection Management**: Always disconnect from MCP servers when done

5. **Error Handling**: MCP tool calls can fail - implement proper error handling

6. **Streaming**: MCP tools don't currently support streaming, but you can emit progress events in your tasks

## Troubleshooting

**Connection fails**: Check that the MCP server command is correct and the package is available

**Tool not found**: Verify the tool name matches exactly what the MCP server provides

**Permission errors**: Ensure the MCP server has access to the resources it needs (e.g., filesystem paths)

**Timeout issues**: Some MCP operations may take time - adjust task retry settings if needed

## More Information

- MCP Specification: https://modelcontextprotocol.io/
- Available MCP Servers: https://github.com/modelcontextprotocol/servers
- ACM MCP Package: [packages/acm-mcp/README.md](../packages/acm-mcp/README.md)
