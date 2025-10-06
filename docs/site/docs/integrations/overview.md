---
id: overview
sidebar_position: 1
title: Integration Patterns
---

ACM interconnects with orchestrators, context providers, and external systems while preserving contract guarantees. This section lists supported integrations and how to adopt them safely.

## Available bridges

| Integration | Purpose | Docs |
| ----------- | ------- | ---- |
| LangGraph | Run ACM plans inside LangGraph graphs | [LangGraph guide](./langgraph.md) |
| Microsoft Agent Framework | Embed ACM runtime within MSAF nodes | [MSAF guide](./msaf.md) |
| Model Context Protocol | Retrieve knowledge via MCP servers | [MCP guide](./mcp.md) |
| External Context Providers | Promote context artifacts generated from directives | [Context providers](./context-providers.md) |

## General guidelines

1. **Keep the ledger central** — Forward ledger entries to your observability stack for cross-system visibility.
2. **Budget cross-system calls** — Wrap third-party APIs with ACM tools so policies can track costs and risks.
3. **Version configuration** — Store integration configs (allowlists, credentials) alongside capability maps for repeatability.
4. **Replay across boundaries** — Ensure dependent systems can access replay bundles when re-running tasks offline.

Continue to specific guides for code examples.
