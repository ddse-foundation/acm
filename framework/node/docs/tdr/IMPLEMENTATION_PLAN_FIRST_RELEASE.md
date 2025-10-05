# ACM Node Framework — First Release Implementation Plan

**Status:** Draft for release coordination  
**Target Release:** v0.5.0 (ACM specification v0.5)  
**Scope:** Close critical conformance gaps, migrate examples onto the `ACMFramework` wrapper, deliver five spec-driven sample capabilities with synthetic data, and ship launch collateral (release notes, press release, README refresh).

---

## 1. Goals & Success Criteria

1. Ship a professional, auditable first release of the ACM Node Framework that conforms to the v0.5 spec and is consumable via npm.
2. Provide five end-to-end examples built on the `ACMFramework` wrapper that demonstrate core ACM concepts (context packets, Nucleus, policy hooks, replay bundles).
3. Automate quality gates (build, lint, test, replay validation) and packaging metadata for `@acm/*` packages.
4. Publish launch collateral: Release Notes, Press Release draft, README/website updates, and a migration guide.

A release is considered **ready** when:

- All critical gaps in §2 are resolved, reviewed, and covered by automated checks.
- Each example executes through `ACMFramework.execute`, produces a replay bundle, and passes spec validators.
- npm publish dry-run succeeds for top-level packages, and CI pipelines are green.
- Release notes, press release, and documentation updates are staged and approved.

---

## 2. Must-Fix Critical Items Before GA

| Priority | Workstream | Description | Owner | Acceptance Criteria |
|----------|------------|-------------|-------|---------------------|
| P0 | Distribution & CI | Update package metadata (`publishConfig`, `files`, `author`, LICENSE copies), adopt Changesets, bump versions to 0.5.0, and add GitHub Actions (build/lint/test/validate + publish). | Release engineering | `pnpm publish --dry-run -r` passes; CI workflows green; release pipeline runs on tag. |

> **Note:** Secondary enhancements (e.g., advanced guard DSL, telemetry enrichment) remain backlog unless they block the above acceptance criteria.

---

## 3. Example Modernization Program

All new examples live in `packages/acm-examples` and are executed through `ACMFramework`. Each includes:

- Synthetic data set(s) under `data/<example>.json`.
- Context assembly via `ContextBuilder` & `ExternalContextProviderAdapter`.
- Capability registry entries, task specs, and tool implementations.
- Planner configuration (goal card, plan alternatives) plus replay bundle smoke tests.

### 3.1 Customer Entitlement Checker

- **Goal:** Confirm eligibility for a benefit before downstream actions.
- **Synthetic data:** `data/customers.json` with account age, tier, compliance flags; `data/policies.json` for entitlement rules.
- **Context:** `ContextBuilder` ingests customer facts; Nucleus preflight issues `crm:<customerId>` directives handled by `ExternalContextProviderAdapter`.
- **Tasks/Tools:**
  - `fetch_customer_profile` (reads synthetic JSON).
  - `evaluate_entitlement` (pure function returning allow/deny & rationale).
  - Optional `notify_supervisor` for denial branch.
- **Plan:** Single branch with guard gating on policy decision. Verification ensures decision + rationale present.

### 3.2 Knowledge Snippet Summarizer

- **Goal:** Fetch and summarize knowledge-base snippets for support agents.
- **Synthetic data:** `data/knowledgebase/*.md` plus metadata index.
- **Context:** Planner builds context packet referencing knowledge index; Nucleus requests `kb:<docId>` artifacts that the adapter promotes to context.
- **Tasks/Tools:**
  - `search_knowledge` (BM25 reuse with new corpus).
  - `summarize_snippet` (LLM-backed tool with deterministic nucleus call).
  - `suggest_followups` (optional postcheck generating action items).
- **Plan:** Search ➝ Summarize; guard ensures at least one snippet found.

### 3.3 Incident Triage Router

- **Goal:** Route incidents to the correct on-call queue with escalation if needed.
- **Synthetic data:** `data/incidents.json`, `data/routing_matrix.json`.
- **Context:** Context builder snapshots active incident and routing rules; policy constraints specify SLA.
- **Tasks/Tools:**
  - `classify_severity` (pure scoring).
  - `select_queue` (deterministic mapping).
  - `escalate_incident` (tools to log escalation).
- **Plan:** Branch on severity; ledger records `BRANCH_TAKEN`. Verification ensures queue assignment.

### 3.4 Invoice Verification Pipeline

- **Goal:** Validate invoice line items against purchase orders.
- **Synthetic data:** `data/invoices.json`, `data/purchase_orders.json` with mismatches seeded.
- **Context:** `ContextBuilder` adds invoice facts; adapter fetches PO via `erp:<invoiceId>` directive.
- **Tasks/Tools:**
  - `fetch_invoice` + `fetch_purchase_order`.
  - `compare_line_items` (returns discrepancies array).
  - `record_findings` (writes deterministic JSON artifact).
- **Plan:** Linear tasks with guard that raises compensation path if discrepancies detected.

### 3.5 Agent Coaching Feedback Loop

- **Goal:** Provide coaching suggestions based on call transcript quality.
- **Synthetic data:** `data/transcripts/*.json` with sentiment + compliance markers.
- **Context:** Planner seeds context with transcript metadata; Nucleus preflight may fetch `transcript:<id>` snippet via adapter.
- **Tasks/Tools:**
  - `analyze_transcript` (LLM or rules-based sentiment & compliance scoring).
  - `generate_feedback` (Nucleus call producing improvement tips).
  - `log_coaching_note` (simulated API call recorded in replay).
- **Plan:** Optionally branch if compliance failures → escalate to supervisor.

### Implementation Checklist (per example)

1. Define Goal Card & Context Packet schema-compliant YAML/JSON under `examples/<example>/artifacts`.
2. Register tools/tasks/capabilities via helper builders, ensuring each `capabilityRef` resolves through the shared registry (and any generated export stays in sync).
3. Implement `ExternalContextProviderAdapter` wiring and synthetic retrieval logic.
4. Add integration test (`tests/<example>.test.ts`) that runs planner+execution via `ACMFramework` and validates replay bundle.
5. Update CLI (`acm-demo`) to select new examples through flags (e.g., `--goal entitlement`).

---

## 4. Platform Enhancements Supporting Examples

1. **ACMFramework Wrapper Adoption**
   - Refactor `@acm-examples` CLI to construct `ACMFramework` with capability/tool registries, policy engine, context provider, and nucleus options.
   - Provide factory utilities (`createDemoFramework`) for reuse in tests.
   - Deprecate direct calls to `StructuredLLMPlanner` and `executeResumablePlan` outside the wrapper.

2. **Synthetic Data & Context Utilities**
   - Add FS helpers for deterministic data loading with content hashes.
   - Extend `ExternalContextProviderAdapter` registration to support `prefix:payload` directive routing.
   - Offer shared fixtures for tests to avoid random data drift.

3. **Verification & Policy Modules**
   - Expand `SimplePolicyEngine` to evaluate example-specific rules; ensure `policyInput` surfaces in ledger.
   - Introduce verification sheet templates (JSON/YAML) referenced by task specs.

4. **Replay & Validation Hooks**
   - Build `framework/node/scripts/run-example.ts` as CI hook: executes each example, exports replay, validates via new validator.
   - Incorporate results into `pnpm test` using Vitest/Jest.

---

## 5. Documentation & Launch Collateral

| Artifact | Owner | Notes |
|----------|-------|-------|
| **Release Notes (v0.5.0)** | Docs + Engineering | Summarize critical changes, list examples, include upgrade guide from Phase 3. Stored at `docs/releases/v0.5.0.md`. |
| **Press Release Draft** | Marketing + Maintainers | Focus on deterministic agent workflows, spec alignment, developer-centric tooling. Deliver as `docs/press/acm-node-v0.5-press-release.md`. |
| **README Updates** | Docs | Refresh root and package READMEs to highlight `ACMFramework`, new examples, honesty matrix for preview features. |
| **Implementation Blog Outline** | Optional marketing | Outline for site/social announcement. |
| **Migration Guide** | Engineering | Document breaking changes (planner API, wrapper adoption, validators). |
| **Changelog** | Maintainers | Update root `CHANGELOG.md` (new section for 0.5.0) and package-level CHANGELOG entries via Changesets. |

Also prepare demo scripts & screenshots for launch and update `GETTING_STARTED.md` to reference new examples.

---

## 6. Delivery Timeline (3 Sprints)

| Sprint | Focus | Key Milestones |
|--------|-------|----------------|
| **Sprint 1** | Hardening Core | Ship spec validators + registry automation, planner/nucleus fixes, ledger hashing, package metadata updates. CI build/test pipeline live. |
| **Sprint 2** | Examples Integration | Refactor `@acm-examples` to use `ACMFramework`; build Customer Entitlement & Knowledge Summarizer end-to-end; add replay validation script. |
| **Sprint 3** | Remaining Examples & Launch Collateral | Deliver remaining three examples, finalize documentation, generate release notes/press release, conduct npm publish dry-run, tag RC. |

A release readiness review occurs at sprint 3 midpoint; any remaining P0 items delay the release.

---

## 7. Acceptance Checklist

- [ ] Validators reject malformed artifacts and are enforced in CI.
- [ ] Capability registry serves as the canonical contract for all tasks/plans, with any generated exports kept current by automation.
- [ ] `ACMFramework` is the sole integration surface for demos/tests; CLI updated.
- [ ] Five examples pass integration tests, produce replay bundles, and showcase context retrieval via adapter.
- [ ] CI workflows (build, lint, test, replay validate) mandatory and green.
- [ ] `pnpm publish --dry-run` for all packages succeeds; npm metadata complete; LICENSE files present.
- [ ] Release notes, press release draft, README/doc updates reviewed.
- [ ] GA tag created and release notes attached in GitHub draft.

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Structured planner changes destabilize existing consumers | High | Provide migration shims + codemods; document changes; run regression tests on legacy demos before removal. |
| Replay bundles become large with new artifacts | Medium | Store large artifacts by digest reference; compress optional assets; document size expectations. |
| Synthetic data lacks realism | Medium | Cross-review datasets with product/SMEs; include unit tests verifying determinism. |
| Release collateral falls behind code delivery | Medium | Start documentation in parallel (Sprint 2); schedule review checkpoints. |
| npm publish blocked by 2FA/secrets | Medium | Verify tokens early; add publish dry-run to CI using automation. |

---

## 9. Next Steps

1. Kick off Sprint 1 tasks (validators, registry automation, planner hardening) and create tracking issues.
2. Draft Changeset for version bump and configure GitHub Actions.
3. Begin Customer Entitlement example implementation skeleton using `ACMFramework` wrapper.
4. Stand up shared synthetic data utilities and context provider adapter enhancements.
5. Start outline for Release Notes & Press Release to avoid end-game rush.

---

*Prepared October 2025 by the ACM Node Framework team.*
