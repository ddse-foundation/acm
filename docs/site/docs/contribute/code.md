---
id: code
sidebar_position: 3
title: Code Contribution Guide
---

Follow these guidelines when contributing to ACM packages.

## Prerequisites

- Node.js 20.x and pnpm 9.x installed.
- Run `pnpm install` at the repository root.
- Familiarize yourself with the package architecture: planner, runtime, adapters, SDK, examples.

## Branch strategy

- Use descriptive branch names: `feature/context-redaction`, `bugfix/runtime-retry`.
- Rebase on `main` before opening a pull request; avoid merge commits inside feature branches.

## Testing & linting

- `pnpm lint` — run TypeScript and markdown linters.
- `pnpm test` — unit tests across packages.
- `pnpm --filter acm-runtime test` — target specific packages.
- Provide replay bundles or fixtures for new planner/runtime behaviors.

## Pull request checklist

- [ ] Tests added or updated.
- [ ] Documentation updated (site + package README if needed).
- [ ] Change log updated (`framework/node/CHANGELOG.md` or package-specific log).
- [ ] Linked issues referenced via `Fixes #NNN`.
- [ ] Screenshots or recordings for developer-facing changes.

## Release coordination

- Coordinate with maintainers for release windows.
- Tag new package versions using `pnpm changeset version` (if repo adopts Changesets) or update package.json manually.
- Update `RELEASE_NOTES_v0.5.0.md` with highlights and upgrade instructions.
