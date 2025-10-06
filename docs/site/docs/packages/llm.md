---
id: llm
sidebar_position: 5
title: "@ddse/acm-llm"
---

`@ddse/acm-llm` supplies OpenAI-compatible clients used by the planner, framework helper, and AI Coder experience.

## Installation

```bash
pnpm add @ddse/acm-llm
```

## Available clients

| Client | Description |
| ------ | ----------- |
| `createVLLMClient(model, baseUrl)` | Connects to a self-hosted [vLLM](https://docs.vllm.ai) server |
| `createOllamaClient(model, baseUrl?)` | Connects to [Ollama](https://ollama.ai) models |
| `OpenAICompatClient` | Base client for custom OpenAI-compatible providers |

Clients expose:

- `name()` — Provider identifier (`vllm`, `ollama`, etc.)
- `generate()` — Standard completion interface
- `generateWithTools()` — Structured tool-call interface used by the planner
- `metadata()` — Provider-specific hints for budgeting

## Example

```typescript
import {createVLLMClient} from '@ddse/acm-llm';

const client = createVLLMClient('Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8', 'http://localhost:8001/v1');
const response = await client.generateWithTools!(messages, tools, {
  temperature: 0.1,
  maxTokens: 512
});
```

## Usage tips

- Use low temperatures (`0.0–0.2`) for deterministic planning.
- Configure `maxTokens` to match your provider quotas.
- Combine with the `BudgetManager` in AI Coder to enforce spend ceilings.

## Related docs

- [Structured planning](../core-concepts/planning.md)
- [AI Coder budgeting](../ai-coder/overview.md)
