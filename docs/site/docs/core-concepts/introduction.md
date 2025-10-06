---
id: introduction
sidebar_position: 1
title: ACM Core Concepts
---

ACM models every decision an agent makes as an artifact that can be understood, verified, and replayed. This section maps the domain to concrete TypeScript constructs shipped in v0.5.0.

## Goal

A `Goal` captures the user intent, constraints, and provenance.

```typescript
const goal = {
  id: 'goal-123',
  intent: 'Resolve a priority refund ticket for order 1234.',
  constraints: { turnaroundMinutes: 10 }
};
```

Goals remain immutable once normalised; they anchor planner decisions, ledger entries, and replay bundles.

## Context Packet

The `Context` packet is a snapshot of facts used during planning and execution. Contexts are content-addressed via a SHA-256 hash so planners can detect drift.

```typescript
const context = {
  id: 'ctx-123',
  facts: {
    orderId: '1234',
    severity: 'P1',
    customerTier: 'Gold'
  }
};
```

Context packets may include promoted artifacts from MCP directives (for example, `filesystem:/tmp/report.json`).

## Capability

Capabilities describe what a task can do and which schema it expects. They are registered with `CapabilityRegistry` and supply metadata to the planner and runtime.

```typescript
capabilityRegistry.register(
  {
    name: 'issue.refund',
    sideEffects: true,
    inputSchema: { type: 'object', properties: { amount: { type: 'number' } } }
  },
  new IssueRefundTask()
);
```

## Task

Tasks extend the abstract `Task<I, O>` base class. They own retry policy, verification checks, and optional policy payloads.

```typescript
class IssueRefundTask extends Task<{ amount: number }, { confirmationId: string }> {
  constructor() {
    super('issue-refund', 'issue.refund');
  }

  async execute(ctx: RunContext, input: { amount: number }) {
    const ledger = ctx.ledger;
    const tool = ctx.getTool('refund-api');
    const result = await tool.call({ amount: input.amount });
    ledger.info('refund-issued', result);
    return result;
  }
}
```

## Tool

Tools encapsulate integration logic. They are invoked by tasks and can be registered alongside capability definitions.

```typescript
class RefundApiTool extends Tool<{ amount: number }, { confirmationId: string }> {
  name() {
    return 'refund-api';
  }

  async call(input: { amount: number }) {
    // Call external API
    return { confirmationId: `refund-${Date.now()}` };
  }
}
```

## Plan

Plans are DAGs of tasks with guards, metadata, and rationale. ACM records Plan-A/Plan-B alternatives plus a deterministic fallback to keep systems running even if LLM output is malformed.

```typescript
const plan = {
  id: 'plan-a',
  contextRef: 'ctx@9e4c...',
  capabilityMapVersion: 'v0.5.0',
  tasks: [
    { id: 't1', capability: 'search.ticket', input: { orderId: '1234' } },
    { id: 't2', capability: 'issue.refund', guard: 'outputs.t1.canRefund === true' }
  ],
  edges: [
    { from: 't1', to: 't2', guard: 'outputs.t1.canRefund === true' }
  ],
  rationale: 'Plan-A prioritises fully automated resolution.'
};
```

Guards use deterministic JavaScript expressions evaluated against context facts, outputs, and policy decisions.

## Ledger & Replay

- **Ledger** — Append-only, tamper-evident log of every planner and runtime decision.
- **Replay bundle** — Compressed artifact containing the plan, ledger, tool-call envelopes, streaming transcripts, and checkpoints.

These records feed compliance workflows, regression testing, and analytics.

## Execution engines

- **ACM runtime** (default) — Deterministic execution with checkpoint/resume support.
- **LangGraph adapter** — Embeds ACM tasks inside LangGraph nodes while keeping contracts intact.
- **Microsoft Agent Framework adapter** — Wraps ACM runtime for MSAF orchestrations.

## Learn more

- Deep dive into [planning](./planning.md) and [execution](./runtime.md).
- See how ledgers and replay bundles work in [Governance](../governance/replay-bundles.md).
- Walk through the [Scenario Playbook](../scenarios/examples.md) to observe these contracts in action.
