---
id: environment
sidebar_position: 2
title: Environment & Tooling Checklist
---

Before building on ACM, ensure your workstation or CI runners satisfy the baseline requirements.

## Core requirements

| Component | Minimum | Notes |
| --------- | ------- | ----- |
| Node.js | 18.x LTS | Runtime for all Node packages and the documentation site |
| pnpm | 8.x | Workspace package manager (ships with lockfiles in the repo) |
| Python (optional) | 3.10+ | Required only when running vLLM or Python-based tooling |
| Git | 2.30+ | Needed for versioning and replay bundle storage |

Install pnpm if you have not already:

```bash
npm install -g pnpm@8
```

## Provider credentials

| Provider | Needed for | How to supply |
| -------- | ---------- | ------------- |
| vLLM | Local LLM hosting | Run `python -m vllm.entrypoints.openai.api_server` |
| Ollama | Local LLM hosting | Install [Ollama](https://ollama.ai) and pull a compatible model |
| OpenAI / Azure OpenAI | Managed inference | Export `OPENAI_API_KEY` / `AZURE_OPENAI_KEY` |
| Brave Search MCP | Context retrieval | Export `BRAVE_API_KEY` before launching demo |
| GitHub MCP | Repository insights | Export `GITHUB_TOKEN` with appropriate scopes |

## Recommended extensions

- **VS Code** with TypeScript / Markdown / Mermaid support
- **Graphviz** (optional) if you render DOT diagrams inside the docs
- **direnv** or similar to manage environment variables per project

## Reproducible environments

For deterministic builds in CI/CD, cache the pnpm store:

```yaml
default:
  cache:
    key: pnpm-${CI_COMMIT_REF_SLUG}
    paths:
      - .pnpm-store
```

Use [`corepack`](https://nodejs.org/api/corepack.html) to pin pnpm per Node version:

```bash
corepack enable
corepack prepare pnpm@8.15.0 --activate
```

## Next steps

- Build the workspace with `pnpm build`.
- Run `pnpm test` to ensure packages pass their integration suites.
- Jump to [Authoring with the SDK](../core-concepts/introduction.md).
