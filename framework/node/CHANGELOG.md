# Changelog

All notable changes to the ACM Node.js Framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2025-10-06

### Added

- Phase 4 completion for Node: Nucleus contract available across planner/runtime; structured planner tool-call envelopes; expanded replay bundles with Nucleus inferences and policy transcripts.
- `@acm/framework` orchestration helper wiring nucleus, planner, runtime, and adapters with a single API.

### Changed

- Docs updated to reflect Nucleus availability in Node v0.5.0 and remove "in progress" phrasing.

### Known Issues / Roadmap

- CLI consolidation (`@acm/cli`) is planned; use package-specific CLIs for now.
- Adapter resumability: LangGraph/MSAF checkpoint/resume path emits warnings; improvements targeted in the next release.
- Ledger enrichment: Additional audit fields (phase/decision for Nucleus inferences, full LLM params, canonical digests) are planned enhancements; current behavior is functional and will be extended without breaking changes.

## [0.1.0] - 2025-01-XX

### Added

#### Core Packages
- **@acm/sdk**: Core types and abstract classes
  - Tool, Task, CapabilityRegistry, ToolRegistry abstracts
  - Goal, Context, Plan, TaskSpec, LedgerEntry types
  - PolicyEngine and StreamSink interfaces
  - DefaultStreamSink implementation

- **@acm/runtime**: Plan execution engine
  - executePlan() with full ACM v0.5 semantics
  - Guard expression evaluation
  - Retry logic with exponential/fixed backoff
  - Memory ledger (append-only decision log)
  - Policy pre/post hooks
  - Verification assertion support
  - Streaming progress updates

- **@acm/llm**: LLM integration
  - OpenAICompatClient for OpenAI-compatible APIs
  - Streaming token generation support
  - Ollama and vLLM presets
  - Zero external dependencies

- **@acm/planner**: LLM-based plan generation
  - StructuredLLMPlanner for Goal → Plan-A/B generation
  - Context reference computation (SHA-256)
  - Safe fallback on parsing errors
  - Streaming support

- **@acm/examples**: Demo and samples
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

[Unreleased]: https://github.com/ddse-foundation/acm/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/ddse-foundation/acm/releases/tag/v0.5.0
[0.1.0]: https://github.com/ddse-foundation/acm/releases/tag/v0.1.0
