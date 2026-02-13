# Agentic Contract Model (ACM) Framework v0.5.1 — Release Notes

**Release date:** February 14, 2026
**Scope:** Node.js reference implementation of ACM Spec v0.5 (pnpm monorepo)
**License:** MIT

---

## Overview

ACM v0.5.1 builds on the [v0.5.0 release](RELEASE_NOTES_v0.5.0.md) with **Nucleus context intelligence**, **token budget enforcement**, **anti‑hallucination grounding**, and **task scope filtering**. All changes are additive — no breaking API changes from v0.5.0.

---

## Highlights

### Nucleus & Context Intelligence

- **Built‑in context tools** — `query_context` for reading scoped data (facts, augmentations, assumptions, artifacts) and `request_context_retrieval` for fetching external context, both auto‑injected into every Nucleus LLM call.
- **Anti‑hallucination grounding** — All prompts include GROUNDING RULES, VALIDATION RULES, and GROUNDING CONSTRAINT directives that force the LLM to cite context keys and refuse to fabricate information.
- **Token budget enforcement** — `maxContextTokens` on `NucleusConfig` passes the model's context window; the `callLLM` loop estimates cumulative prompt tokens via `estimateTokens()` and forces a final answer at 85% capacity. Results include `metrics` with `rounds`, `estimatedPromptTokens`, and `budgetExhausted`.
- **External context provider** — `ExternalContextProviderAdapter` bridges Nucleus `request_context_retrieval` directives to registered tools, fulfilling them inline during the tool loop or in the planner/executor.
- **Configurable query rounds** — `maxQueryRounds` (default 25) controls how many `query_context` rounds the LLM may take before being forced to produce a final answer.

### Runtime Enhancements

- **Task scope filtering** — `taskScope` on the resumable executor restricts which tasks execute in a DAG, enabling partial re‑runs and targeted task execution with early‑break optimization.

### Planner Enhancements

- **Two‑stage planning** — Thinking stage (goal analysis) followed by Emit stage (structured plan). Improves plan quality by giving the LLM a full reasoning pass before producing structure.
- **Context provider integration** — `contextProvider` on `PlannerOptions` enables mid‑planning context hydration via `ExternalContextProviderAdapter`.

### Framework Façade

- **`ACMFramework.execute()`** now accepts `taskScope` for partial DAG execution and passes `contextProvider` to both planner and executor.

---

## Packages Updated

All 10 packages bumped from v0.5.0 → v0.5.1:

| Package | Key Changes |
|---------|-------------|
| `@ddse/acm-sdk` | `DeterministicNucleus` with context tools, token budget, anti‑hallucination prompts, `estimateTokens()`, widened provenance type |
| `@ddse/acm-runtime` | `taskScope` on resumable executor, early‑break optimization |
| `@ddse/acm-planner` | Two‑stage planner, `contextProvider` integration |
| `@ddse/acm-framework` | `taskScope` + `contextProvider` passthrough in façade |
| `@ddse/acm-llm` | No API changes (version alignment) |
| `@ddse/acm-mcp` | No API changes (version alignment) |
| `@ddse/acm-adapters` | No API changes (version alignment) |
| `@ddse/acm-replay` | No API changes (version alignment) |
| `@ddse/acm-aicoder` | No API changes (version alignment) |
| `@ddse/acm-examples` | No API changes (version alignment) |

---

## Test Coverage

- **56 tests** in `@ddse/acm-sdk` — query_context actions, tool loop, realistic data, anti‑hallucination, mid‑invoke retrieval, estimateTokens, metrics, budget enforcement
- **13 tests** in `@ddse/acm-runtime` — taskScope filtering, diamond DAG, linear chain, empty scope, resume, checkpoints, early‑break, ledger accuracy
- **3 tests** in `@ddse/acm-sdk` — Phase 4 integration (context builder, nucleus, SHA‑256 ref)

---

## Upgrade from v0.5.0

```bash
pnpm update @ddse/acm-sdk @ddse/acm-runtime @ddse/acm-planner @ddse/acm-framework
```

All changes are additive. Existing v0.5.0 code will work without modification. To use new features:

```typescript
import { DeterministicNucleus, estimateTokens, type NucleusConfig } from '@ddse/acm-sdk';

const config: NucleusConfig = {
  goalId: 'g1',
  goalIntent: 'Analyze the codebase',
  contextRef: 'sha256-abc',
  llmCall: { provider: 'vllm', model: 'Qwen/Qwen3-4B', maxTokens: 4096 },
  maxContextTokens: 20480,  // token budget enforcement
  maxQueryRounds: 25,       // configurable (default 25)
};

const result = await nucleus.invoke({ input: task, tools: myTools });
console.log(result.metrics);
// { rounds: 3, estimatedPromptTokens: 12400, budgetExhausted: false }
```

---

## Known Issues & Limitations

- **Token estimation** — `estimateTokens()` uses heuristic char/token ratios (code‑aware). For production precision, integrate a tokenizer (e.g. tiktoken).
- **CLI consolidation** — Package‑specific CLIs remain; unified `@ddse/acm-cli` is planned.
- **Adapter resumability** — Checkpoint/resume across external engines is preview; warnings emitted where parity is incomplete.

---

**Project:** https://github.com/ddse-foundation/acm
**Contact:** [DDSE Foundation](https://ddse-foundation.github.io/)
