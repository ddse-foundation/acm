# @acm/mcp

MCP (Model Context Protocol) tool integration for ACM.

## Overview

This package provides integration with MCP servers, allowing ACM agents to use tools exposed via the Model Context Protocol. MCP is a standardized protocol for connecting AI applications with data sources and tools.

## Features

- Connect to MCP servers via stdio transport
- Automatic tool discovery
- Seamless integration with ACM tool registry
- Support for combining local and MCP tools

## Installation

```bash
pnpm add @acm/mcp
```

## Usage

### Connecting to an MCP Server

```typescript
import { McpClientManager, McpToolRegistry } from '@acm/mcp';

// Create and connect to an MCP server
const manager = new McpClientManager();
await manager.connect({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
});

// Create a tool registry from MCP tools
const mcpRegistry = new McpToolRegistry(manager);

// List available tools
console.log(mcpRegistry.list());
```

### Using MCP Tools with ACM

```typescript
import { CombinedToolRegistry } from '@acm/mcp';
import { SimpleToolRegistry } from '@acm/examples/registries';

// Combine local tools with MCP tools
const localTools = new SimpleToolRegistry();
// ... register local tools

const combinedRegistry = new CombinedToolRegistry(localTools, mcpRegistry);

// Use in ACM execution
const result = await executePlan({
  goal,
  context,
  plan,
  capabilityRegistry,
  toolRegistry: combinedRegistry, // Use combined registry
  // ...
});
```

### Example: Using Filesystem MCP Server

```typescript
import { McpClientManager, CombinedToolRegistry } from '@acm/mcp';

// Connect to filesystem MCP server
const manager = new McpClientManager();
await manager.connect({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
});

// Now you have access to file operations:
// - read_file
// - write_file
// - list_directory
// - etc.

const mcpRegistry = new McpToolRegistry(manager);
const tool = mcpRegistry.get('read_file');
if (tool) {
  const content = await tool.call({ path: '/tmp/example.txt' });
  console.log(content);
}

// Don't forget to disconnect when done
await manager.disconnect();
```

## Available MCP Servers

The MCP ecosystem includes several free servers you can use:

- **@modelcontextprotocol/server-filesystem**: File system operations
- **@modelcontextprotocol/server-github**: GitHub API integration
- **@modelcontextprotocol/server-postgres**: PostgreSQL database access
- **@modelcontextprotocol/server-brave-search**: Web search via Brave
- **@modelcontextprotocol/server-memory**: Simple key-value storage

## API Reference

### `McpClientManager`

Manages connection to an MCP server.

**Methods:**
- `connect(config: McpServerConfig)`: Connect to an MCP server
- `getTool(name: string)`: Get a specific tool
- `getAllTools()`: Get all available tools
- `listToolNames()`: List all tool names
- `disconnect()`: Close connection
- `isConnected()`: Check connection status

### `McpToolRegistry`

Tool registry backed by MCP tools.

**Methods:**
- `get(name: string)`: Get a tool by name
- `list()`: List all tool names
- `refresh()`: Refresh tools from server

### `CombinedToolRegistry`

Combines local and MCP tool registries.

**Constructor:**
```typescript
new CombinedToolRegistry(localRegistry, mcpRegistry?)
```

**Methods:**
- `get(name: string)`: Get a tool (checks local first, then MCP)
- `list()`: List all tool names from both registries

## License

Apache-2.0
