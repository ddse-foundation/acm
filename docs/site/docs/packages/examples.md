---
id: examples
sidebar_position: 10
title: "@ddse/acm-examples"
---

`@ddse/acm-examples` ships deterministic reference workflows that showcase the ACM planner, runtime, policies, and replay tooling. Use them to understand best practices or bootstrap your own scenarios.

```bash
pnpm add @ddse/acm-examples
```

## Run the CLI

```bash
pnpm --filter @ddse/acm-examples demo -- --scenario entitlement
```

### Common flags

```text
--scenario <key>             Choose a scenario (entitlement, knowledge, incidents, invoices, coaching)
--provider <ollama|vllm>     LLM provider (default: ollama)
--model <name>               Model identifier
--base-url <url>             Override provider endpoint
--engine <acm|langgraph|msaf> Execution engine
--checkpoint-dir <dir>       Persist checkpoints for resumable runs
--save-bundle                Export replay bundle to replay/<runId>/
--use-mcp                    Enable MCP integrations
--mcp-server <command>       Spawn MCP server process
```

## Scenarios

| Scenario | Focus |
| -------- | ----- |
| `entitlement` | Fetch CRM data, evaluate benefit policies, notify supervisors |
| `knowledge` | Retrieve, summarise, and follow up on knowledge base insights |
| `incidents` | Classify severity, route tickets, and escalate accordingly |
| `invoices` | Reconcile invoice vs PO, log discrepancies |
| `coaching` | Analyse transcripts, craft coaching notes, store results |

Each scenario defines:

- Tool and capability registries
- Deterministic reference plan (`buildReferencePlan()`)
- Verification expressions and policies
- Synthetic datasets for reproducible runs

## Testing

```bash
pnpm --filter @ddse/acm-examples test
pnpm --filter @ddse/acm-examples test:bm25
```

Tests run with stubbed LLM responses so you can validate changes without live providers.

## Customising

- Extend `src/tools` and `src/tasks` to add new capabilities.
- Update `src/examples/scenarios.ts` to register new scenario definitions.
- Wire new CLI flags in `bin/acm-demo.ts` to expose additional behaviour.

## References

- Package [README](https://github.com/ddse-foundation/acm/blob/main/framework/node/packages/acm-examples/README.md)
- [Scenario playbook](../scenarios/examples.md)
- [Governance → Replay bundles](../governance/replay-bundles.md)
