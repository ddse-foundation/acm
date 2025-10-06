---
id: examples
sidebar_position: 1
title: Scenario Playbook
---

The examples package ships five deterministic workflows that illustrate how ACM plans, executes, and replays realistic customer operations. Each scenario can run against vLLM or Ollama, and they all export replay bundles for audits.

## Scenario summary

| Key | Use case | Highlights |
| --- | -------- | ---------- |
| `entitlement` | Eligibility and benefit approvals | CRM lookups, guard expressions, supervisor notifications |
| `knowledge` | Knowledge base acceleration | BM25 search, summarisation tasks, replay export |
| `incidents` | Incident triage & escalation | Risk assessment policies, checkpointing |
| `invoices` | Invoice vs PO reconciliation | Verification expressions, audit logging |
| `coaching` | Agent coaching & feedback loops | Context builders, multi-step plans, streaming UI |

## Running a scenario

```bash
pnpm --filter @ddse/acm-examples demo -- --scenario incidents --provider vllm --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8
```

### Streamed output

- Planner tokens stream to the terminal as the LLM reasons about the goal.
- Task updates show guard status, retries, and verification results.
- Checkpoint events appear when the ACM runtime persists state.

### Exporting replay bundles

```bash
pnpm --filter @ddse/acm-examples demo -- --scenario invoices --save-bundle --checkpoint-dir ./checkpoints
```

Replay directories include `plans/`, `ledger.json`, `task-outputs.json`, and optional `checkpoints/`.

## Scenario anatomy

Each scenario implements the following contract:

```typescript
interface ScenarioDefinition {
  key: string;
  title: string;
  description: string;
  buildReferencePlan(): PlannerResult;
  run(options: ScenarioRunOptions): Promise<RunSummary>;
}
```

- **Tool registry** — composed of deterministic tools (search, CRM, refund, etc.).
- **Capability registry** — maps tasks to capabilities with retry and policy metadata.
- **Policy engine** — enforces risk thresholds, approvals, or budgets.
- **Verification hooks** — ensure outputs satisfy success criteria.

## Suggested learning path

1. Start with `entitlement` to experience a linear workflow with guards and notifications.
2. Run `incidents` to see resumable execution and policy gating.
3. Explore `knowledge` to understand MCP search integration.
4. Finish with `coaching` to observe complex context building and streaming.

## Customising workflows

- Clone an existing scenario under `packages/acm-examples/src/examples/`.
- Add new synthetic datasets under `packages/acm-examples/data/`.
- Update integration tests (`tests/integration.test.ts`) to protect your scenario with golden assertions.

## Next steps

- Deep dive into the [Examples package](../packages/examples.md).
- Use scenarios as blueprints when designing your own flows in [Build Your Own Scenario](./build-your-own.md).
