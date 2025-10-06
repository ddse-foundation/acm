---
id: quickstart
sidebar_position: 1
title: Quick Start in 10 Minutes
---

Follow this path to get ACM v0.5.0 running locally and execute your first deterministic workflow.

## 1. Clone and install

```bash
# Clone the repository
git clone https://github.com/ddse-foundation/acm.git
cd acm/framework/node

# Install dependencies and build all packages
pnpm install
pnpm build
```

> **Tip** — Use `pnpm --filter <package> <command>` when iterating on a single package. The full build compiles every workspace package.

## 2. Start an LLM endpoint

ACM expects an OpenAI-compatible endpoint. The team validates releases against [vLLM](https://docs.vllm.ai) running Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8.

```bash
pip install "vllm>=0.5"
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 \
  --port 8001
```

Verify the server is ready:

```bash
curl http://localhost:8001/v1/models
```

> **Other providers** — Bring any OpenAI-compatible endpoint (OpenAI, Ollama, Azure OpenAI). Adjust `--provider`, `--model`, and `--base-url` in the CLI.

## 3. Run the deterministic demos

```bash
# Refund workflow with vLLM
pnpm --filter @ddse/acm-examples demo -- \
  --provider vllm \
  --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 \
  --base-url http://localhost:8001/v1 \
  --scenario refunds

# Incident triage with checkpoints and replay export
pnpm --filter @ddse/acm-examples demo -- \
  --scenario incidents \
  --checkpoint-dir ./checkpoints \
  --save-bundle
```

What you will see:

1. **Planning** — Tool-call reasoning and Plan-A/Plan-B alternatives.
2. **Execution** — Task progress with guard evaluation and policy hooks.
3. **Summary** — Ledger counts, checkpoint paths, replay bundle locations.

## 4. Inspect replay bundles

```bash
ls checkpoints
cat checkpoints/run-*/ledger.json
```

Replay bundles contain:

- Planner output (plans + rationale)
- Selected plan and alternatives
- Ledger entries (task starts, guard evaluations, policies, verification)
- Tool-call envelopes and streaming transcripts

## 5. Author your first agent

Use the SDK and runtime directly:

```typescript
import {Tool, Task} from '@ddse/acm-sdk';
import {executePlan, MemoryLedger} from '@ddse/acm-runtime';
import {StructuredLLMPlanner} from '@ddse/acm-planner';
```

Define tools, tasks, and registries, then run `executePlan` with a freshly generated plan. See the [Core Concepts](../core-concepts/introduction.md) section for a step-by-step tutorial.

## Next steps

- Learn the [conceptual model](../core-concepts/introduction.md).
- Explore the [scenario playbook](../scenarios/examples.md).
- Launch the [AI Coder experience](../ai-coder/overview.md) for an interactive workflow.
