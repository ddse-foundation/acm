---
id: setup
sidebar_position: 2
title: Setup & CLI Flags
---

Install and launch ACM AI Coder to experience the full ACM runtime with budgeting, policies, and resumable execution.

## Install

```bash
pnpm install
pnpm --filter @ddse/acm-aicoder build
```

Optionally link the CLI for convenience:

```bash
pnpm --filter @ddse/acm-aicoder exec pnpm link --global
```

## Launch the TUI

```bash
acm-aicoder \
  --provider vllm \
  --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 \
  --base-url http://localhost:8001/v1 \
  --workspace /path/to/project
```

### Required flags

| Flag | Description |
| ---- | ----------- |
| `--provider` | LLM provider: `vllm`, `ollama`, `openai`, `anthropic`, etc. |
| `--model` | Provider-specific model identifier |
| `--workspace` | Root directory of the repository you want to work on |

### Optional flags

| Flag | Description |
| ---- | ----------- |
| `--base-url` | Override provider endpoint |
| `--temperature` | Sampling temperature (default: 0.7) |
| `--seed` | Random seed for reproducibility |
| `--plans` | Number of alternative plans to generate (1 or 2) |
| `--resume` | Continue a previous run by ID |
| `--checkpoint-dir` | Custom location for checkpoints and replay bundles |

## Commands inside the TUI

| Command | Behaviour |
| ------- | --------- |
| `/help` | List available commands |
| `/exit` | Quit the session |
| `/budget` | Show budget allocations and current spend |
| `/context` | Display the active context packet |
| `/reset` | Clear the current goal and start over |
| `#path/to/file` | Reference files in the indexed workspace using mentions |

## Replay bundles & checkpoints

- Replay bundles are saved under `.aicoder/replays/<runId>/`.
- Checkpoints live in `.aicoder/checkpoints/<runId>/` by default.
- Use `--checkpoint-dir` to store artifacts elsewhere (shared volumes, object storage).

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| LLM connection errors | Verify provider flags and credentials; run `curl` against the base URL. |
| Missing workspace files | Ensure `--workspace` points to the repository root and is readable. |
| Budget blocks execution | Adjust budget configuration in `config/budget.ts` or supply higher limits. |
| Replay not generated | Check for write permissions in `.aicoder/` or custom checkpoint directory. |

Proceed to [Task surfaces](./tasks.md) to understand the capability map behind AI Coder.
