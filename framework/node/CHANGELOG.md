# Changelog

All notable changes to the ACM Node.js Framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
  - LLMPlanner for Goal → Plan-A/B generation
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

- Replay bundle export structure defined but not implemented
- MCP tool integration not yet available
- LangGraph adapter placeholder only
- MS Agent Framework adapter placeholder only
- No unit tests (manual testing only)
- Guard expressions use JavaScript eval (not sandboxed)

### Deferred Features

These features are planned for future releases:
- MCP tool bridge integration
- LangGraph adapter implementation
- Microsoft Agent Framework adapter implementation
- Complete replay bundle export/import
- OPA/Rego policy integration
- JSONLogic verification DSL
- Distributed tracing support
- Unit and integration tests
- Performance benchmarks

## Future Versions

### [0.2.0] - Planned
- Add MCP tool integration
- Implement replay bundle export
- Add unit tests for core packages
- Additional example workflows
- Performance optimizations

### [0.3.0] - Planned
- LangGraph adapter implementation
- MS Agent Framework adapter implementation
- Integration tests
- Advanced error handling

### [0.4.0] - Planned
- OPA/Rego policy integration
- JSONLogic verification DSL
- Advanced guard expression grammar
- Distributed tracing

### [1.0.0] - Future
- Production-ready stability
- Complete test coverage
- Performance benchmarks
- Cloud provider integrations
- Visual workflow designer

## Links

- [Repository](https://github.com/ddse-foundation/acm)
- [ACM Specification v0.5](../../spec/acm-spec%20v0.5.md)
- [Issues](https://github.com/ddse-foundation/acm/issues)
- [Discussions](https://github.com/ddse-foundation/acm/discussions)

---

[Unreleased]: https://github.com/ddse-foundation/acm/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ddse-foundation/acm/releases/tag/v0.1.0
