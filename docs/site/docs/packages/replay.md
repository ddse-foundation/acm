---
id: replay
sidebar_position: 6
title: "@ddse/acm-replay"
---

`@ddse/acm-replay` serialises ACM runs into portable replay bundles and rehydrates them for audits, regression tests, or analytics.

## Installation

```bash
pnpm add @ddse/acm-replay @ddse/acm-runtime @ddse/acm-sdk
```

## Export a bundle

```typescript
import {ReplayBundleExporter} from '@ddse/acm-replay';

await ReplayBundleExporter.export({
  outputDir: './replay/run-1759529575221',
  goal,
  context,
  plans,
  selectedPlanId: plan.id,
  ledger: ledger.getEntries(),
  taskIO: result.outputsByTask
});
```

## Load and inspect

```typescript
const bundle = await ReplayBundleExporter.load('./replay/run-1759529575221');
console.log(bundle.plan.id, bundle.ledger.length);
```

## Validate

```typescript
const { valid, errors } = await ReplayBundleExporter.validate('./replay/run-1759529575221');
```

Validation ensures:

- Context hash matches `contextRef`
- Ledger entries form a consistent timeline
- Selected plan exists in the bundle

## Use cases

- **Compliance** — Provide auditors with a tamper-evident record of agent behaviour.
- **Regression** — Re-run tasks offline to compare outputs across model versions.
- **Analytics** — Aggregate ledger data to understand tool usage and failure rates.

## Bundle contents

- `goal.json`
- `context.json`
- `plans/plan-a.json`, `plans/plan-b.json`
- `ledger.json`
- `task-outputs.json`
- `tool-calls/` transcripts
- Optional `checkpoints/` when resumable execution is enabled

## References

- Package [README](https://github.com/ddse-foundation/acm/blob/main/framework/node/packages/acm-replay/README.md)
- [Governance → Replay bundles](../governance/replay-bundles.md)
- [Scenario playbook](../scenarios/examples.md) for CLI commands that export bundles
