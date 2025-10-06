---
id: mcp
sidebar_position: 8
title: "@ddse/acm-mcp"
---

`@ddse/acm-mcp` integrates Model Context Protocol (MCP) servers as first-class ACM tools. It enables deterministic retrieval of external knowledge during planning and execution.

## Installation

```bash
pnpm add @ddse/acm-mcp @modelcontextprotocol/client @ddse/acm-sdk
```

## Connect to MCP servers

```typescript
import {McpClientManager, McpToolRegistry} from '@ddse/acm-mcp';

const manager = new McpClientManager();
await manager.connect({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']
});

const mcpRegistry = new McpToolRegistry(manager);
```

You can merge MCP tools with local tools:

```typescript
import {CombinedToolRegistry} from '@ddse/acm-mcp';

const toolRegistry = new CombinedToolRegistry(localTools, mcpRegistry);
```

## Supported servers

- `@modelcontextprotocol/server-filesystem`
- `@modelcontextprotocol/server-github`
- `@modelcontextprotocol/server-brave-search`
- `@modelcontextprotocol/server-memory`

Supply tokens via environment variables (`GITHUB_TOKEN`, `BRAVE_API_KEY`, etc.).

## Context directives

The nucleus issues directives such as `filesystem:/tmp/report.json`. Register matching functions to translate directives into MCP tool invocations and promote results into the context packet.

```typescript
contextProvider.register(mcpRegistry.lookup('filesystem'), {
  match: directive => directive.startsWith('filesystem:'),
  buildInput: directive => ({ path: directive.slice('filesystem:'.length) })
});
```

## Best practices

- Run MCP servers in the same process as demos (via `--mcp-server` CLI flag) or out-of-process for production workloads.
- Budget API calls using the policy engine to prevent runaway retrieval.
- Record MCP responses in the ledger for auditability.

## References

- [MCP examples](https://github.com/ddse-foundation/acm/blob/main/framework/node/MCP_EXAMPLES.md)
- [Integrations → MCP servers](../integrations/mcp.md)
