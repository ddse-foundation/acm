# Changelog

All notable changes to the ACM Node.js Framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.2] - 2026-02-14

### Fixed

- **Browser crypto compatibility**: Replaced all Node.js `crypto` module imports (`createHash`) with a universal `universalDigest()` function that uses dynamic `require('crypto')` in Node.js and FNV-1a 128-bit hashing in browser environments. This fixes the Vite "Module crypto has been externalized for browser compatibility" error that caused blank screens in Electron renderer.
  - `acm-sdk`: `nucleus.ts`, `context.ts` — replaced `createHash` and `Buffer.byteLength` with browser-safe alternatives.
  - `acm-runtime`: `ledger.ts`, `tool-envelope.ts` — replaced `createHash` with `universalDigest` imported from `@ddse/acm-sdk`.
- **Nucleus round caps enforced**: `maxQueryRounds` capped from default 25 to 3; new `maxRetrievalRounds: 1` added. Prevents runaway LLM loops where the model keeps requesting retrieval indefinitely.
- **Preflight/postcheck hooks disabled**: Prevents per-task nucleus preflight calls (up to 25 rounds each) that saturated local LLM servers and froze the UI.

### Added

- **`universalDigest(input: string): string`**: New export from `@ddse/acm-sdk` — cross-platform hash function with Node.js SHA-256 primary path and FNV-1a 128-bit browser fallback. Used internally for ledger digests, context refs, and prompt deduplication.
- **`hash.ts` module**: New source file in `acm-sdk` implementing the universal digest with dynamic Node.js detection to avoid Vite static analysis.

### Changed

- `NucleusConfig.maxQueryRounds` default changed from 25 to 3.
- `NucleusConfig.maxRetrievalRounds` added (default 1) — removes the retrieval tool after the cap is hit, forcing the LLM to answer with available context.
- `ContextBuilder` and `InternalContextScopeImpl` now use `TextEncoder` for byte-length calculation instead of Node.js `Buffer`.
- `MemoryLedger.computeDigest()` and `computeDigest()` in tool-envelope now delegate to `universalDigest` from `@ddse/acm-sdk`.

## [0.5.1] - 2026-02-14

### Added

- **Nucleus built-in context tools**: `query_context` (list, read_fact, read_augmentation, read_assumptions, read_artifact) and `request_context_retrieval` auto-injected into every LLM call.
- **Token budget enforcement**: `NucleusConfig.maxContextTokens` — callLLM loop estimates cumulative prompt tokens via `estimateTokens()` and forces a final answer when usage exceeds 85%.
- **estimateTokens(text)**: Exported heuristic token estimator with code-aware char/token ratios.
- **NucleusInvokeResult.metrics**: Reports `rounds`, `estimatedPromptTokens`, and `budgetExhausted`.
- **Anti-hallucination prompt grounding**: GROUNDING RULES, VALIDATION RULES, and GROUNDING CONSTRAINT directives across all prompt stages.
- **Task scope filtering**: `taskScope` on resumable executor restricts DAG execution to a subset of tasks with early-break optimization.
- **Configurable query rounds**: `NucleusConfig.maxQueryRounds` (default 25).
- **ExternalContextProviderAdapter**: Bridges Nucleus retrieval directives to developer-registered tools with auto-promotion.
- **ContextBuilder / InternalContextScopeImpl**: Fluent context construction with `sizeBytes` tracking and widened provenance type.
- **Planner context provider**: `contextProvider` on `PlannerOptions` for mid-planning context hydration.
- **Two-stage planner**: Thinking + Emit stages for improved plan quality.
- **describeType() catalog hints**: Context snapshots show type metadata instead of raw JSON dumps.
- **Comprehensive test suites**: 56 tests (acm-sdk), 13 tests (acm-runtime).

### Changed

- Provenance type widened with `[key: string]: any` for production compatibility.
- Context snapshot renders catalog with type hints instead of full payloads.
- All prompt templates include ## CONTEXT TOOLS guidance sections.
- `ACMFramework.execute()` now accepts `taskScope` and passes `contextProvider` to planner/executor.

### Known Issues / Roadmap

- Token estimation uses heuristic char/token ratios; for production precision, integrate a tokenizer.
- CLI consolidation (`@ddse/acm-cli`) is planned; use package-specific CLIs for now.

## [0.5.0] - 2025-10-06

### Added

- Phase 4 completion for Node: Nucleus contract available across planner/runtime; structured planner tool-call envelopes; expanded replay bundles with Nucleus inferences and policy transcripts.
- `@ddse/acm-framework` orchestration helper wiring nucleus, planner, runtime, and adapters with a single API.

### Changed

- Docs updated to reflect Nucleus availability in Node v0.5.0 and remove "in progress" phrasing.

### Known Issues / Roadmap

- CLI consolidation (`@ddse/acm-cli`) is planned; use package-specific CLIs for now.
- Adapter resumability: LangGraph/MSAF checkpoint/resume path emits warnings; improvements targeted in the next release.
- Ledger enrichment: Additional audit fields (phase/decision for Nucleus inferences, full LLM params, canonical digests) are planned enhancements; current behavior is functional and will be extended without breaking changes.

## [0.1.0] - 2025-01-XX

### Added

#### Core Packages
- **@ddse/acm-sdk**: Core types and abstract classes
  - Tool, Task, CapabilityRegistry, ToolRegistry abstracts
  - Goal, Context, Plan, TaskSpec, LedgerEntry types
  - PolicyEngine and StreamSink interfaces
  - DefaultStreamSink implementation

- **@ddse/acm-runtime**: Plan execution engine
  - executePlan() with full ACM v0.5 semantics
  - Guard expression evaluation
  - Retry logic with exponential/fixed backoff
  - Memory ledger (append-only decision log)
  - Policy pre/post hooks
  - Verification assertion support
  - Streaming progress updates

- **@ddse/acm-llm**: LLM integration
  - OpenAICompatClient for OpenAI-compatible APIs
  - Streaming token generation support
  - Ollama and vLLM presets
  - Zero external dependencies

- **@ddse/acm-planner**: LLM-based plan generation
  - StructuredLLMPlanner for Goal → Plan-A/B generation
  - Context reference computation (SHA-256)
  - Safe fallback on parsing errors
  - Streaming support

- **@ddse/acm-examples**: Demo and samples
  - Complete CLI application
  - Sample tools (search, entity extraction, risk assessment, refund, notifications)
  - Sample tasks (simple, multi-tool, complex workflows)
  - Two example scenarios (refund flow, issues mitigation)
  - Concrete registry implementations
  - Simple policy engine example
  - CLI renderer with beautiful output

#### Documentation
- Comprehensive README.md with quickstart and API reference
- CONTRIBUTING.md with development guidelines
- GETTING_STARTED.md with step-by-step tutorial
- IMPLEMENTATION_SUMMARY.md with complete overview
- PUBLISHING.md with npm publishing guide
- Package-specific READMEs for all packages
- CHANGELOG.md (this file)

#### Build Infrastructure
- pnpm workspace monorepo setup
- TypeScript with strict mode and composite projects
- Unified build/clean/dev scripts
- .gitignore for clean repository

### Features

- **ACM v0.5 Compliance**: Full specification implementation
  - Context lifecycle with content-addressable refs
  - Plan alternatives (Plan-A and Plan-B)
  - Deterministic guard evaluation
  - Task contracts (idempotency, retry, verification)
  - Policy enforcement hooks
  - Memory ledger for decision tracking
  - Streaming for real-time feedback

- **Developer Experience**
  - Code-first approach (no YAML/JSON authoring)
  - Simple, intuitive APIs
  - Working examples out of the box
  - Comprehensive documentation
  - Easy to extend and customize

- **LLM Integration**
  - Works with local LLM providers (Ollama, vLLM)
  - Streaming token generation
  - Safe fallback when parsing fails
  - Provider-agnostic design

- **Execution Features**
  - Deterministic plan execution
  - Guard-based branching
  - Retry with exponential backoff
  - Policy authorization gates
  - Verification assertions
  - Real-time streaming updates
  - Complete audit trail

### Known Limitations

- Guard expressions use JavaScript eval (not sandboxed)
- No advanced DSL for guards or verification (code-first approach)

### Deferred Features

These features are planned for future releases:
- OPA/Rego policy integration
- JSONLogic verification DSL
- Advanced guard expression grammar
- Distributed tracing support
- Performance benchmarks
- Cloud provider integrations

## Future Versions

### [0.6.0] - Planned
- Performance optimizations and benchmarks
- Additional example workflows
- Advanced error handling and recovery

### [0.7.0] - Planned
- OPA/Rego policy integration
- JSONLogic verification DSL
- Advanced guard expression grammar

### [0.8.0] - Planned
- Distributed tracing
- Cloud provider integrations
- Visual workflow designer

### [1.0.0] - Future
- Production-ready stability
- Complete documentation
- Enterprise features

## Links

- Repository: <https://github.com/ddse-foundation/acm>
- ACM Specification v0.5: ../../spec/acm-spec%20v0.5.md
- Issues: <https://github.com/ddse-foundation/acm/issues>
- Discussions: <https://github.com/ddse-foundation/acm/discussions>

---

[Unreleased]: https://github.com/ddse-foundation/acm/compare/v0.5.1...HEAD
[0.5.1]: https://github.com/ddse-foundation/acm/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/ddse-foundation/acm/releases/tag/v0.5.0
[0.1.0]: https://github.com/ddse-foundation/acm/releases/tag/v0.1.0
