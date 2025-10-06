---
id: context
sidebar_position: 4
title: Context & External Retrieval
---

Context packets supply the immutable facts required to plan and execute safely. ACM treats context as a first-class artifact.

## Building context packets

Sources include:

- User-supplied inputs
- Internal services (CRM, fulfilment, observability)
- MCP servers (filesystem, GitHub, search, memory)
- AI Coder context builders (workspace indices, symbol graphs)

```typescript
const contextBuilder = new ExternalContextProviderAdapter();

contextBuilder.register(new FilesystemSnapshotTool(), {
  match: directive => directive.startsWith('filesystem:'),
  buildInput: directive => ({ path: directive.slice('filesystem:'.length) || '/tmp' })
});
```

The adapter listens for `request_context_retrieval` directives emitted by the nucleus and promotes retrieved artifacts into the active context packet.

## Context lifecycle

1. **Collect facts** — Build the base context from upstream systems.
2. **Hash** — Planner computes `contextRef = sha256(normalisedContext)`.
3. **Plan** — LLM sees the context state and decides which capabilities to invoke.
4. **Execute** — Runtime keeps context immutable; tasks can only add outputs or ledger events.
5. **Replay** — Bundles include the original context so auditors can recompute `contextRef` and detect tampering.

## Guarding sensitive data

- Set `context.metadata.pii = true` to flag sensitive fields.
- Use policy hooks to redact or reject inputs.
- When using MCP servers, configure allowlists (e.g., filesystem roots) and budgets.

## Versioning context schemas

Publish and track context schema versions alongside your capability map:

```json
{
  "contextSchemas": {
    "refund": "v0.5.0",
    "incident": "v0.5.0"
  }
}
```

Include the schema version in both planner prompts and ledger entries for clear traceability.

## Best practices

- Keep context packets small (only the facts required to make decisions).
- Promote derived artifacts (search results, summaries) to context when they must influence future tasks.
- Avoid storing secret material; reference vault IDs instead.
- Validate context shape with Zod or JSON schema before planning.

## Related docs

- [Integrations → Context Providers](../integrations/context-providers.md)
- [Governance → Policies](../governance/policy-checks.md)
- [Specification](../specification/overview.md) section 4 for formal definitions.
