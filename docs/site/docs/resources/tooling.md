---
id: tooling
sidebar_position: 2
title: Tooling & Commands
---

Utility commands and automation for ACM documentation and runtime artifacts.

## Docs workspace

```bash
pnpm --filter docs install
pnpm --filter docs lint
pnpm --filter docs build
pnpm --filter docs serve
```

## Package maintenance

```bash
pnpm lint
pnpm test
pnpm --filter acm-runtime test
pnpm --filter acm-planner build
```

## Replay inspection

```bash
pnpm --filter acm-replay run bundle:list
pnpm --filter acm-replay run bundle:replay --bundle ./tmp/replays/refund-001
```

## Policy validation

```bash
pnpm --filter acm-runtime run policy:lint
pnpm --filter acm-runtime run verification:test
```

Adjust filters as needed for your local package names.
