---
id: tasks
sidebar_position: 3
title: Tasks, Tools & Governance
---

AI Coder demonstrates how ACM tasks, tools, policies, and budgets collaborate to automate developer workflows.

## Capability map

| Capability | Description | Key Tasks |
| ---------- | ----------- | --------- |
| `context.collect` | Index repository files, symbols, dependencies | `AnalyzeWorkspaceTask`, `CollectContextPackTask` |
| `code.search` | Retrieve code snippets via BM25 or grep | `SearchCodeTask`, `FindSymbolDefinitionTask` |
| `code.edit` | Apply AI-generated patches with user approval | `ImplementFunctionTask`, `RefactorRenameSymbolTask`, `CodeEditToolV2` |
| `quality.test` | Run targeted tests or builds | `RunTestsTaskV2`, `BuildTool` |
| `knowledge.retrieve` | Pull docs via MCP servers (filesystem, GitHub) | `CodeSearchTool`, `FilesystemTool` |

All capabilities are implemented with the same `Tool` and `Task` abstractions available to your own agents.

## Tooling highlights

- **File operations** — Read, diff, and patch files with backup safeguards.
- **Search** — Combine BM25 indexes with repo-aware grep for high recall.
- **Tests** — Run `pnpm`/`npm` scripts, capture exit codes, and stream logs.
- **MCP** — Reach external knowledge bases or memory stores deterministically.

## Policy & verification

- **Budget policy** — Checks forecasted and actual spend before each LLM call.
- **Path allowlists** — Prevent edits outside the workspace or to restricted directories.
- **Verification** — Ensures generated diffs compile and tests succeed.

## Context lifecycle

1. Index workspace metadata into structured artifacts.
2. Promote relevant files and symbols into the context packet.
3. Planner reasons about the augmented context to craft tasks.
4. Runtime executes tasks, streaming updates to the TUI and ledger.

## Extending AI Coder

- Register new tools under `src/tools-v2/`.
- Create tasks under `src/tasks-v2/` and register them with `SimpleCapabilityRegistry`.
- Update budgets in `src/config/budget.ts` and policy rules in `src/config/policy.ts`.
- Add new MCP integrations in `src/context/` by registering additional servers.

## References

- Package [README](https://github.com/ddse-foundation/acm/blob/main/framework/node/packages/acm-aicoder/README.md)
- [Governance → Policies & Verification](../governance/policy-checks.md)
- [Integrations → MCP](../integrations/mcp.md)
