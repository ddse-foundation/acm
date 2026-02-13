# Agentic Contract Model (ACM) Framework v0.5.2 — Release Notes

**Release date:** February 14, 2026
**Scope:** Node.js reference implementation of ACM Spec v0.5 (pnpm monorepo)
**License:** MIT

---

## Overview

ACM v0.5.2 is a **stability and compatibility release** that fixes critical browser/Electron renderer compatibility issues and tightens LLM execution control to prevent runaway loops. All changes are additive or corrective — no breaking API changes from v0.5.1.

---

## Highlights

### Browser Compatibility (Critical Fix)

- **Eliminated Node.js `crypto` dependency from renderer-bundled packages** — Vite externalizes Node's `crypto` module for browser compatibility, causing `"Module 'crypto' has been externalized"` errors that produced blank screens in the Electron desktop shell.
- **Universal hashing** — New `universalDigest()` function in `@ddse/acm-sdk` uses dynamic `require('crypto')` for Node.js (avoiding Vite static analysis) and falls back to FNV-1a 128-bit hashing in browser environments. All digest/hash operations across SDK and runtime now use this function.
- **`Buffer.byteLength` replaced** — `ContextBuilder` now uses `TextEncoder` for byte-length calculations, removing another Node.js-only API from the renderer path.

### Nucleus Execution Control

- **`maxQueryRounds` reduced from 25 → 3** — Caps the nucleus outer loop to 3 LLM calls per invocation (discover → retrieve → finalize), preventing the LLM from looping indefinitely.
- **`maxRetrievalRounds: 1` added** — After one retrieval fulfillment, the `request_context_retrieval` tool is removed from the tool list, forcing the LLM to answer with available context instead of endlessly requesting more.
- **Preflight/postcheck hooks disabled** — Per-task nucleus preflight was triggering up to 25 additional LLM rounds per task. For a 3-task goal, this alone could produce 75+ unnecessary LLM calls. Both hooks are now disabled by default.

---

## Packages Updated

| Package | Version | Changes |
|---------|---------|---------|
| `@ddse/acm-sdk` | 0.5.2 | New `hash.ts` with `universalDigest()`; crypto removed from `nucleus.ts`, `context.ts`; `Buffer.byteLength` → `TextEncoder` |
| `@ddse/acm-runtime` | 0.5.2 | Crypto removed from `ledger.ts`, `tool-envelope.ts`; uses `universalDigest` from SDK |
| `@ddse/acm-adapters` | 0.5.2 | Version bump (dependency alignment) |
| `@ddse/acm-aicoder` | 0.5.2 | Version bump |
| `@ddse/acm-examples` | 0.5.2 | Version bump |
| `@ddse/acm-framework` | 0.5.2 | Version bump |
| `@ddse/acm-llm` | 0.5.2 | Version bump |
| `@ddse/acm-mcp` | 0.5.2 | Version bump |
| `@ddse/acm-planner` | 0.5.2 | Version bump |
| `@ddse/acm-replay` | 0.5.2 | Version bump |

---

## Migration Guide

### From v0.5.1

No breaking changes. Upgrade by updating dependency versions to `0.5.2`:

```json
{
  "@ddse/acm-sdk": "0.5.2",
  "@ddse/acm-runtime": "0.5.2"
}
```

If you were importing `createHash` from `crypto` alongside ACM packages in browser-bundled code, switch to `universalDigest` from `@ddse/acm-sdk`:

```typescript
// Before
import { createHash } from 'crypto';
const hash = createHash('sha256').update(input).digest('hex');

// After
import { universalDigest } from '@ddse/acm-sdk';
const hash = universalDigest(input);
```

### Nucleus configuration

If you pass custom `maxQueryRounds`, be aware the default changed from 25 to 3. To restore the old behavior (not recommended):

```typescript
const options = {
  maxQueryRounds: 25,  // old default — may cause slow execution
  maxRetrievalRounds: undefined  // no cap
};
```

---

## Verified Behavior

- **Desktop shell**: Launches without crypto errors, no blank screens
- **Full build**: All 10 packages build clean (`pnpm build` exit 0)
- **Goal execution**: Planning + 3 tasks + summary completes successfully
- **Artifact generation**: Theme → Epic → Feature → Story hierarchy produced correctly
- **Ledger**: 29 nucleus inferences for a 3-task goal (9 per task × 3 invocations + 2 planning)
- **Diagnostics**: 16 HTTP calls, 126s execution, 64MB peak heap — no OOM

---

## Known Issues

- `acm-aicoder/workspace-indexer.ts` and `agent-api/indexing-coordinator.ts` still import from Node.js `crypto`. These are not in the Electron renderer bundle path but should be migrated in a future release.
- Token estimation remains heuristic-based; production deployments should integrate a proper tokenizer.
- Artifact generation may produce duplicate frontmatter (content wrapped in code fences) with smaller models — this is an LLM prompt/template issue, not a framework bug.

---

## Links

- [CHANGELOG.md](framework/node/CHANGELOG.md)
- [ACM Specification v0.5](spec/acm-spec%20v0.5.md)
- [v0.5.1 Release Notes](RELEASE_NOTES_v0.5.1.md)
- [v0.5.0 Release Notes](RELEASE_NOTES_v0.5.0.md)
