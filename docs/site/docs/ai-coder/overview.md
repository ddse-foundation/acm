---
id: overview
sidebar_position: 1
title: ACM AI Coder Overview
---

ACM AI Coder is a full-screen terminal experience that showcases every aspect of the Agentic Contract Model. Built entirely on ACM v0.5.0 primitives, it combines planning, execution, budgeting, and governance for developer workflows.

## Key capabilities

- **Streaming planner reasoning** — Watch tool-call deliberations token-by-token.
- **Task board** — Observe goal decomposition, status, and success criteria in real time.
- **Ledger events feed** — Trace policy decisions, tool calls, checkpoints, and budgets.
- **Budget governance** — Predict pre-inference cost, enforce spend ceilings, and surface usage metrics.
- **Workspace context** — Index repository files, symbols, dependencies, and tests before planning.
- **Replay bundles** — Persist session history to `.aicoder/replays/` for audits and recovery.

## When to use AI Coder

- As a guided demo for stakeholders exploring ACM’s governance surface.
- To bootstrap agent-assisted development workflows with deterministic safeguards.
- To test new tools/tasks within a rich, interactive environment before embedding them elsewhere.

## Requirements

| Requirement | Notes |
| ----------- | ----- |
| Node.js ≥ 18 | Shared with the rest of the monorepo |
| pnpm ≥ 8 | To install the package |
| OpenAI-compatible LLM | vLLM, Ollama, Azure OpenAI, etc. |
| Writable workspace path | Required for indexing and checkpoints |

Continue to [Setup & CLI flags](./setup.md) for installation details.
