---
id: writing-docs
sidebar_position: 2
title: Documentation Style Guide
---

Keep documentation clear, actionable, and aligned with ACM terminology.

## Structure

- Use frontmatter `title`, `sidebar_position`, and stable `id` values.
- Introduce concepts with a short summary followed by “Why it matters” and “How to use it”.
- Link to source files or packages using relative paths where possible.

## Language conventions

- Prefer active voice and imperative tone for procedures.
- Use **MUST/SHOULD/MAY** consistently with RFC 2119 meaning.
- Emphasize version references (for example, `ACM v0.5.0` instead of “latest”).

## Code samples

- Provide TypeScript or JSON examples by default; add Python/Java when available.
- Annotate fenced code blocks with languages (`ts`, `json`, `bash`).
- Keep snippets under 30 lines; link to full examples when longer.

## Review checklist

- [ ] New docs link back to related guides (overview, core concepts, governance).
- [ ] Screenshots or diagrams include captions and alt text.
- [ ] Frontmatter includes keywords for search (`tags` field optional).
- [ ] Run `pnpm --filter docs lint` before pushing.

## Automation

- `pnpm docs lint` — markdown/MDX linting.
- `pnpm docs build` — Docusaurus build check.
- `pnpm docs serve` — local smoke test before publishing.
