# @ddse/acm-examples

End-to-end ACM demos showcasing deterministic scenarios, streaming execution, and replay capture for the Node.js framework helper.

## What this package gives you

- **Scenario-driven CLI** (`bin/acm-demo.ts`) that drives the ACM Framework end-to-end with the structured planner, streaming UI, and resume-friendly execution.
- **Five production-style workflows** (entitlement, knowledge, incidents, invoices, coaching) with curated data, tools, and capability registries.
- **Streaming UX** via `DefaultStreamSink` and `CLIRenderer` for planner tokens, task updates, and checkpoints.
- **Replay + resume support** through file-backed checkpoints and replay bundle export.
- **Integration tests** that exercise every scenario with a stubbed LLM so you can validate changes quickly.

## Prerequisites

```bash
pnpm install
pnpm --filter @ddse/acm-examples build
```

## Running the demo CLI

### Quick start

```bash
# Entitlement decisioning with default Ollama client
pnpm --filter @ddse/acm-examples demo -- --scenario entitlement

# Knowledge acceleration using vLLM
pnpm --filter @ddse/acm-examples demo -- --provider vllm --model qwen2.5:7b --scenario knowledge

# Incident triage with persistent checkpoints
pnpm --filter @ddse/acm-examples demo -- --scenario incidents --checkpoint-dir ./tmp/checkpoints

# Invoice reconciliation with replay bundle export
pnpm --filter @ddse/acm-examples demo -- --scenario invoices --save-bundle
```

### CLI options

```text
--scenario <key>             Scenario to execute (use --list to see options)
--list                       List available scenarios and exit
--provider <ollama|vllm>     LLM provider (default: ollama)
--model <name>               Model identifier (defaults per provider)
--base-url <url>             Override LLM endpoint URL
--engine <acm|langgraph|msaf>  Execution engine (default: acm)
--resume <runId>             Resume a prior ACM engine run
--checkpoint-dir <dir>       Directory for checkpoint storage (default: ./checkpoints)
--no-stream                  Disable live planner/task streaming
--save-bundle                Save replay bundle to replay/<runId>/
-h, --help                   Show help
```

### Available scenarios

| Key | Name | Focus |
| --- | ---- | ----- |
| `entitlement` | Entitlement Decisioning | Fetch CRM data, evaluate benefit policy, and notify the supervisor. |
| `knowledge` | Knowledge Acceleration | Retrieve, summarize, and follow up on knowledge base content. |
| `incidents` | Incident Triage | Classify severity, choose routing queue, and escalate if needed. |
| `invoices` | Invoice Reconciliation | Compare invoice vs PO and log audit findings. |
| `coaching` | Agent Coaching | Analyze transcripts, craft feedback, and store coaching notes. |

Each scenario exposes `buildReferencePlan()` to generate a deterministic reference plan used by automated tests and replay exports while the CLI exercises the planner live with the same tools, capabilities, and assertions.

## Streaming and verification

The CLI wires `DefaultStreamSink` into the `CLIRenderer` so you get:

- Real-time planner token streaming
- Task progress + step updates
- Checkpoint notifications during ACM engine runs
- Summary output once execution finishes

Verification expressions from each task are executed locally before continuing, ensuring deterministic guard rails across scenarios.

## Integration tests

All workflows are validated in `tests/integration.test.ts` with a stubbed LLM and the same reference plans:

```bash
pnpm --filter @ddse/acm-examples test
```

Running the suite will iterate over every scenario, execute its plan, and assert the expected outputs—ideal for CI or for verifying modifications to tools/tasks.

## Customization tips

- Add new tools or capabilities in `src/tools` and `src/tasks`, then register them inside a scenario definition.
- Use `ScenarioDefinition.buildReferencePlan()` as the place to define deterministic reference plans when adding scenarios.
- Extend the CLI by introducing new flags or output modes in `bin/acm-demo.ts`—it already exposes context registration, streaming, resume, and replay wiring.

## Project layout

```text
packages/acm-examples/
├── bin/acm-demo.ts           # Scenario-driven demo CLI
├── src/
│   ├── context/              # Directive-based context providers
│   ├── data/                 # Synthetic datasets per scenario
│   ├── examples/scenarios.ts # Scenario catalog & reference plans
│   ├── registries.ts         # Simple tool & capability registries
│   ├── renderer.ts           # Streaming CLI renderer
│   └── tasks/ & tools/       # Deterministic task/tool implementations
├── tests/integration.test.ts # Full scenario regression suite
└── dist/                     # Build artifacts (generated)
```

## Next steps

- Plug in your own LLM provider by extending `createOllamaClient`/`createVLLMClient` equivalents.
- Add new scenarios that exercise additional policies or data domains.
- Use replay bundles to capture and share successful runs for downstream analysis.
