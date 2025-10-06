---
id: context-providers
sidebar_position: 5
title: External Context Providers
---

External context providers turn nucleus directives into promoted artifacts inside the context packet. They keep planning deterministic while enabling rich retrieval strategies.

## Adapter basics

```typescript
import {ExternalContextProviderAdapter, Tool} from '@ddse/acm-sdk';

const contextProvider = new ExternalContextProviderAdapter();

contextProvider.register(new FilesystemSnapshotTool(), {
  match: directive => directive.startsWith('filesystem:'),
  buildInput: directive => ({ path: directive.slice('filesystem:'.length) || '.' })
});
```

## Directive flow

1. Planner or runtime encounters missing context.
2. Nucleus emits a directive (e.g., `filesystem:/workspace/README.md`).
3. Adapter matches the directive, executes the tool, and promotes the artifact to the context packet.
4. Planner resumes with the enriched context.

## Promotion rules

- Tools should return `{ type, content, promote?: boolean }`.
- When `promote` is `true`, the artifact is added to the context packet automatically.
- Use `type` namespaced strings (e.g., `crm.profile`, `log.snapshot`) for easier downstream filtering.

## Best practices

- Keep tooling idempotent so replays can regenerate the same artifacts.
- Sanitize responses to avoid injecting sensitive data into the context packet.
- Log directive fulfilment in the ledger for auditability.
- Combine with MCP servers to reach external knowledge bases safely.

## References

- [Core Concepts → Context](../core-concepts/context.md)
- [Integrations → MCP](./mcp.md)
- [AI Coder tasks](../ai-coder/tasks.md) for advanced usage
