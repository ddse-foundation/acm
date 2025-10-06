---
id: mcp
sidebar_position: 4
title: Model Context Protocol (MCP)
---

ACM integrates with Model Context Protocol servers to fetch deterministic context artifacts during planning and execution.

## Launch a filesystem MCP server

```bash
pnpm --filter @ddse/acm-examples demo -- \
  --scenario knowledge \
  --use-mcp \
  --mcp-server "npx -y @modelcontextprotocol/server-filesystem /tmp"
```

## Programmatic usage

```typescript
import {McpClientManager, McpToolRegistry, CombinedToolRegistry} from '@ddse/acm-mcp';

const manager = new McpClientManager();
await manager.connect({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github']
});

const mcpRegistry = new McpToolRegistry(manager);
const toolRegistry = new CombinedToolRegistry(localTools, mcpRegistry);
```

Register directives with the external context provider:

```typescript
contextProvider.register(mcpRegistry, {
  match: directive => directive.startsWith('github:'),
  buildInput: directive => ({ repo: directive.slice('github:'.length) })
});
```

## Security & budgeting tips

- Restrict command arguments for each MCP server (e.g., filesystem root directories).
- Enforce policy budgets for MCP calls to avoid runaway costs.
- Capture MCP responses inside the ledger for downstream analysis.

## Supported servers in examples

| Server | Use case |
| ------ | -------- |
| `filesystem` | Fetch local files for planning |
| `github` | Inspect GitHub repos with GraphQL queries |
| `brave-search` | Inject search results into context |
| `memory` | Share stateful artifacts between tasks |

## References

- [Packages → @ddse/acm-mcp](../packages/mcp.md)
- [Governance → Context & Retrieval](../core-concepts/context.md)
- [MCP examples](https://github.com/ddse-foundation/acm/blob/main/framework/node/MCP_EXAMPLES.md)
