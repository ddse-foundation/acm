---
title: Turn Your Chat Interface into a Capabilities OS with ACM v0.5
slug: capabilities-os-chat-with-acm
authors: [ddse-foundation]
tags: [acm, governance, chat, integrations]
description: A practical blueprint for converting a chat UI into a governed capability surface using the Agentic Contract Model v0.5.
image: /img/unifiedchatbanner.png
---

A unified chat surface can feel magical, but it only scales when every request maps to governed, replayable work. The Agentic Contract Model (ACM) v0.5 gives you that backbone. Instead of wiring tools directly to a chat handler, you model every decision as a contract: **Goal → Plan → Execute → Replay**. This post shows how to apply the pieces that ship today in the ACM monorepo to build an "all-in-one" chat experience that your ops team can trust.

<!-- truncate -->

## What ACM standardizes for chat platforms

ACM v0.5 defines typed artifacts so planners, runtimes, and auditors speak the same language:

- **Goal** – normalized intent plus constraints. Stored with the replay bundle so reviewers see *why* work started.
- **Context Packet** – immutable snapshot of facts (content-addressed to detect drift). A planner must pin a context version before emitting a plan.
- **Capability Map** – the approved list of actions, each with IO schemas, invariants, and bindings to one or more providers.
- **Tasks & Plans** – DAGs with guards, retries, rationales, and policy payloads. Alternatives (Plan A/B) are persisted for reproducibility.
- **Decision Ledger & Replay Bundle** – append-only events (PLAN_SELECTED, TASK_START/END, POLICY verdicts) plus a portable bundle containing prompts, tool envelopes, checkpoints, and outputs.

These structures are already implemented across the packages in this repo (`@ddse/acm-sdk`, `@ddse/acm-runtime`, `@ddse/acm-planner`, `@ddse/acm-replay`). The docs under `/docs/core-concepts` and `/docs/architecture` describe the contract surfaces in detail.

## The five enforcement planes

A real chat platform needs more than tool routing. ACM layers five governance planes that the examples in `/docs/governance` walk through:

1. **Identity & Consent** – Execution contexts carry tenant, token, and scope metadata. Policy hooks record consent decisions before tasks run.
2. **Policy & Safety** – Pre/post hooks, verification adapters, guard evaluation, and rate containment live in the runtime and governance checklists.
3. **Planning & Control** – Planners consume immutable Context Packets, preserve alternatives, and pin Capability Map versions to prevent tool drift.
4. **Observability & Cost** – The ledger is first-class; forward entries to monitoring and enforce spend limits by running all third-party calls through ACM Tools.
5. **Replay & Certification** – Replay Bundles define what needs to be audited or reproduced, and the docs ship a resumable executor runbook so you can restart deterministically.

Together they turn "call Booking.com" from a shell command into a governed contract invocation.

![ACM governance planes stacked from identity through replay](/img/enforcement%20planes.png)

## Blueprint: combining travel search and creative work in one flow

Let’s walk through a real conversation pattern that teams often request:

> “Find three hotels near SFO for 20–22 October under $250/night, then generate a LinkedIn banner using the best option.”

You can model this with ACM today:

![High-level ACM chat flow from chat UI to planners, broker, adapters, and providers](/img/chatflow.png)

1. **Goal & Context** – Normalize the travel dates, budget, and output target. Hash the context so changes are detectable.
2. **Plan A/B** – Plan A may call `travel.search_hotels` first, then `design.generate_banner`; Plan B can swap providers or add a fallback template. Both are stored with rationale.
3. **Policy Gates** – Residency, cost ceilings, and brand compliance run through the governance hooks. The runtime blocks execution until policies return `allow`.
4. **Deterministic Runtime** – Guards enforce budget limits; retries/backoff and checkpoints are handled by `@ddse/acm-runtime`. Ledger events capture every decision.
5. **Replay Bundle** – Export via `@ddse/acm-replay` for audits, user-facing transcripts, or regression tests.

Swap the sample capability bindings below with your actual SaaS adapters:

```yaml
capability: travel.search_hotels
version: 2.3.0
io:
  input_schema_ref: "#/schemas/SearchHotelsInput"
  output_schema_ref: "#/schemas/SearchHotelsResult"
bindings:
  - adapter: booking.search_v1
    requires_scopes: ["hotel:search"]
    limits: { rpm: 30, burst: 10 }
    regions_allowed: ["US", "EU"]
    verification_ref: "#/checks/hotel_result_schema"
  - adapter: expedia.search_v2
    failover: true
policies:
  - spend.max_per_session: 50USD
  - pii.redaction: strict
```

Tasks own retries, verification, and compensations so “try again” is policy-driven, not random:

```yaml
task: design.brand_banner
version: 1.1.0
steps:
  - use: design.generate_canvas_template
    with: { template_id: "brand-hero-2025" }
  - use: design.apply_text_overlay
    with: { headline: "{{goal.headline}}", style: "H1/Brand" }
idempotency:
  key: "brand-{{goal.campaign_id}}"
  window: 24h
verify:
  - asset.exists
  - asset.size >= 1200x628
compensations:
  - on: design.apply_text_overlay/ValidationError
    do: design.apply_text_overlay
    with: { headline: "{{goal.headline | truncate: 90}}" }
policies:
  - brand.safety: approved_fonts_only
```

## How this stacks up against Booking.com and Figma

The OpenAI case studies on Booking.com’s [AI Trip Planner](https://openai.com/index/booking-com/) and Figma’s [Executive Function conversation with David Kossnick](https://openai.com/index/figma-david-kossnick/) show what happens when production teams lean into AI without losing sight of craft and safety. They also highlight the gaps ACM is designed to close:

- **Booking.com** fused GPT APIs with two decades of structured travel data in just ten weeks, then layered GPT-4o mini for Smart Filters, property Q&A, and review summarization. Their wins come from tightly coupling conversational discovery with proprietary availability, while still respecting traveler trust (e.g. accurate policies, reliable rebooking). ACM offers the scaffolding that their bespoke task force built by hand: versioned Capability Maps to document approved travel actions, deterministic ledgers to capture every itinerary choice, and replay bundles to audit how a recommendation was produced. You still need Booking.com’s depth of supply data, but ACM shortens the path to govern the planners and runtime your ops team will rely on.
- **Figma** uses OpenAI models across Figma Make, Dev Mode’s MCP server, and ChatGPT Enterprise to make design multiplayer. Their story is about keeping human craft in the loop: AI handles busy work, but professionals remain the pilots. ACM leans into that same philosophy by making every task spec and policy hook explicit. Where Figma invested in cross-modality UX, ACM provides the contracts that let you plug in MCP adapters, capture provenance for generated assets, and assign ownership to the designers or engineers reviewing each run.

ACM doesn’t ship with Booking.com’s travel corpora or Figma’s visual editors, and it intentionally avoids hiding governance behind a SaaS black box. Instead it productizes the boring-but-critical parts both companies engineered internally: immutable context packets, guarded task DAGs, policy checkpoints, and replayable decision ledgers. Pair ACM with your domain adapters (inventory, creative assets, compliance systems) and you get reproducible, observable agent flows that can withstand the same scrutiny those teams describe in the case studies.

## What ships today

You do not need to invent everything from scratch:

- **Deterministic demos** – `pnpm --filter @ddse/acm-examples demo --scenario entitlement` (and four other scenarios) stream planner output, policy verdicts, and replay bundles.
- **Governance checklists** – `/docs/governance` includes policy templates, ledger obligations, and the resumable executor runbook.
- **Integrations** – Bridges to LangGraph, Microsoft Agent Framework, and MCP preserve ACM contracts while letting you reuse existing orchestrators. See `/docs/integrations` for adapter patterns.
- **Typed SDKs** – Packages under `packages/` expose TypeScript contracts for Goals, Context Packets, Tasks, Tools, Ledger events, and Replay artifacts.

These pieces are enough to pilot the travel+design flow above—swap the sample adapters with gateways to your ERP, procurement system, or creative tooling.

## Implementation checklist

1. **Publish a Capability Map** with IO schemas, invariants, and policy bindings. Track it in source control so planners target only what you approve.
2. **Wrap each SaaS/API** as an ACM Tool + Adapter. Declare scopes, rate limits, and verification hooks for safe execution.
3. **Author Task specs** that own retries, compensations, and guard expressions. Attach policy hooks so “retry” obeys governance.
4. **Pin plans and prompts** – Store alternatives and rationale, and version the Capability Map that generated them.
5. **Stream, Ledger, Bundle** – Wire your chat UI to stream planner tokens and task updates, persist ledger events, and export replay bundles after each run.
6. **Forward telemetry** – Send ledger entries to your observability stack and budget-spend dashboards.

## Try it now

Clone the repo, run the quick start, and plug your chat UI into the existing runtime surface:

```bash
git clone https://github.com/ddse-foundation/acm.git
cd acm/framework/node
pnpm install
pnpm build
pnpm --filter @ddse/acm-examples demo --scenario entitlement --save-bundle
```

Inspect the generated replay bundle to see how contracts, policies, and ledger entries combine. From there, replace the sample adapters with your own providers and watch your chat interface graduate from prototype to governed capability platform.

*Looking for a deeper dive? The documentation under `/docs/announcements` and `/docs/architecture` continues to expand with deployment runbooks and integration playbooks.*
