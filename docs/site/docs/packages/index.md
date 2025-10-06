---
id: packages
slug: /packages
sidebar_position: 1
title: Package Overview
---

The ACM monorepo ships multiple npm packages. Each package focuses on one tier of the plan → execute → replay stack. All packages are versioned together at **v0.5.0**.

| Package | Description | Docs |
| ------- | ----------- | ---- |
| `@ddse/acm-sdk` | Core types, registries, tool/task base classes | [SDK guide](./sdk.md) |
| `@ddse/acm-planner` | Structured LLM planner with Plan-A/Plan-B alternatives | [Planner guide](./planner.md) |
| `@ddse/acm-runtime` | Deterministic runtime with policies, verification, checkpoints | [Runtime guide](./runtime.md) |
| `@ddse/acm-framework` | Helper that wraps planning + execution into one call | [Framework helper](./framework.md) |
| `@ddse/acm-llm` | OpenAI-compatible clients (vLLM, Ollama, BYO) | [LLM utilities](./llm.md) |
| `@ddse/acm-mcp` | Model Context Protocol client manager and registries | [MCP toolkit](./mcp.md) |
| `@ddse/acm-adapters` | LangGraph & Microsoft Agent Framework adapters | [Adapters](./adapters.md) |
| `@ddse/acm-replay` | Replay bundle export/import utilities | [Replay utilities](./replay.md) |
| `@ddse/acm-examples` | Deterministic CLI scenarios with data and tests | [Examples package](./examples.md) |
| `@ddse/acm-aicoder` | Interactive developer assistant built on ACM | [AI Coder docs](../ai-coder/overview.md) |

All packages share the same TypeScript toolchain and are built with `pnpm --filter <package> build`. Use `pnpm --filter <package> test` to run the associated test suites.
