# Agentic Contract Model (ACM) Framework v0.5.5 — Release Notes

**Release date:** February 18, 2026
**Scope:** Node.js reference implementation of ACM Spec v0.5 (pnpm monorepo)
**License:** MIT

---

## Overview

ACM v0.5.5 builds on v0.5.4's deterministic capability filtering by adding **fast planning mode** — an optional flag that skips the planner's "thinking" stage to halve planning latency for narrow or append goals.

No breaking API changes. Both new fields (`capabilities`, `fastMode`) on `ACMPlanRequest` are fully optional — omitting them preserves existing behaviour.

---

## Highlights

### Deterministic Planning via Capability Override (v0.5.4)

- **`ACMPlanRequest.capabilities`** — When provided, these capabilities are passed directly to the planner instead of the full capability registry contents.
- **Use case:** In a multi-role DDSE workflow (Manager → Analyzer → Developer), each append pass should only expose the artifact types relevant to that role.

### Fast Planning Mode (v0.5.5)

- **`ACMPlanRequest.fastMode`** — When `true`, skips the planner's Stage 1 "thinking" LLM call and goes straight to structured plan emission. Cuts planning latency roughly in half.
- **Use case:** Narrow append goals (e.g., appending only CODE tasks to a developer pass) don't need a full reasoning pass over the goal decomposition. The emit prompt already handles missing analysis gracefully via its fallback: `(No analysis available — decompose the goal directly.)`.
- **Trade-off:** Complex goals with many artifact types benefit from the thinking stage. Fast mode is best for focused, single-role passes.

---

## Packages Updated

| Package | Version | Changes |
|---------|---------|---------|
| `@ddse/acm-planner` | 0.5.3 | `PlannerOptions.skipThinking` — guards the Stage 1 thinking LLM call |
| `@ddse/acm-framework` | 0.5.5 | `ACMPlanRequest.fastMode` + `ACMPlanRequest.capabilities` override |

---

## Upgrade Guide

```bash
pnpm update @ddse/acm-framework@0.5.5 @ddse/acm-planner@0.5.3
```

No migration steps required. Both fields are optional and backward-compatible.

### Example Usage

```typescript
import { ACMFramework } from '@ddse/acm-framework';

// Fast mode: skip thinking, emit plan directly
const planResponse = await framework.plan({
  goal: myGoal,
  context: myContext,
  fastMode: true,
});

// Deterministic: only expose developer capabilities
const developerCaps = capabilityRegistry.list().filter(c =>
  c.name?.toLowerCase().includes('code')
);
const scopedPlan = await framework.plan({
  goal: myGoal,
  context: myContext,
  capabilities: developerCaps,
  fastMode: true, // combine both for maximum speed
});
```

---

## Known Issues / Roadmap

- `execute()` does not support `capabilities` override — it always uses the full registry. By design: execution must resolve all task capability refs.
- `fastMode` only applies to `plan()`. When `execute()` is called without `existingPlan`, it uses `plan()` internally and will respect `fastMode` if set on the request.
