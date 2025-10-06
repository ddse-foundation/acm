# ACM Examples — Architecture & Implementation Blueprint

Last updated: 2025-10-06

## Overview

This blueprint translates the release implementation plan into concrete module boundaries, task/tool specifications, and planner wiring for the five flagship examples. The intent is to keep the package modular while maximizing reuse of shared registries, data loaders, and context adapters.

Each example is delivered as a capability bundle exposing:

- A goal definition consumable by the `ACMFramework` (#goal slug + metadata).
- Context assembly helpers that hydrate packets from synthetic data and Nucleus directives.
- Tool implementations (pure + LLM backed) with deterministic fallbacks for unit testing.
- Task specifications with policy bindings and ledger annotations.
- Verification hooks and replay assertions validated via `tests/<example>.test.ts`.

## Shared Components

| Component | Location | Notes |
|-----------|----------|-------|
| `createDemoFramework` | `src/framework.ts` (existing) | Updated to register new capabilities and directive handlers. |
| Data loaders | `src/data/*.ts` | Already implemented; expose typed helpers and caching. |
| Directive router | `src/context/directives.ts` (new) | Centralizes prefix → loader/provider mapping. |
| Policy engine extensions | `src/policy/examples-policy.ts` (new) | Encapsulates per-example policy checks (SLA, entitlement guard, etc.). |
| Verification sheets | `src/verification/<example>.ts` (new) | Deterministic validation of task outputs. |
| Capability registry | `src/registry/examples.ts` (new) | Registers tasks/tools/capabilities; re-exported through public surface. |

All tools should be authored under `src/tools/<example>/` and tasks under `src/tasks/<example>/`. Shared utility abstractions (e.g., scoring, formatting, result types) live in `src/lib/`.

## Example Blueprints

### 1. Customer Entitlement Checker (`entitlement`)

- **Goal slug:** `entitlement-check`
- **Context builders:**
  - `buildEntitlementContext(customerId)` fetches customer + policy snapshots using `getCustomerProfile` and `getPolicyByTier`.
  - Directive prefix `crm:` resolves to `fetchCustomerProfileTool` for nucleus preflight.
- **Tools:**
  - `fetchCustomerProfileTool` — deterministic JSON lookup.
  - `evaluateEntitlementTool` — pure function comparing policy rules (tier, compliance flags) with customer state; returns `{decision, rationale}`.
  - `notifySupervisorTool` — simulated side-effect; no-op in tests, emits ledger entry `NOTIFICATION_ENQUEUED` when `decision === "deny"`.
- **Tasks:**
  1. `RetrieveCustomerTask` (uses `fetchCustomerProfileTool`).
  2. `EvaluateEntitlementTask` (uses `evaluateEntitlementTool`; guard `decision === "allow"`).
  3. `SupervisorNotificationTask` (conditional on guard failure).
- **Policy & verification:**
  - Policy: ensure customer tier >= required tier; add ledger note `POLICY_FAIL` on violation.
  - Verification: result payload must include `decision`, `rationale`, and `policyTrace` entries.
- **Planner wiring:** linear plan with guard-based branch; replay should include both primary path and optional compensation branch.

### 2. Knowledge Snippet Summarizer (`knowledge`)

- **Goal slug:** `knowledge-summarize`
- **Context builders:**
  - `buildKnowledgeContext(query)` indexing metadata for candidate docs.
  - Directive prefix `kb:` loads Markdown snippets via `getKnowledgeDoc` (already piped through loader with hash-based caching).
- **Tools:**
  - `searchKnowledgeTool` — wrap reusable BM25 implementation; returns ranked hits.
  - `summarizeSnippetTool` — nucleus-backed summarizer with deterministic small-model fallback for tests.
  - `suggestFollowupsTool` — optional; uses deterministic heuristics derived from doc tags.
- **Tasks:**
  1. `SearchKnowledgeTask` (guard: must yield ≥1 hit, otherwise `KnowledgeNotFound` branch calling `suggestFollowupsTool` with escalation instructions).
  2. `SummarizeSnippetTask` (streams summary paragraphs; attaches tokens to replay).
  3. `SuggestFollowupsTask` (optional post-processing).
- **Policy & verification:**
  - Policy ensures summarizer references source doc ID in output.
  - Verification asserts summary length bounds and includes bullet follow-ups when branch executed.

### 3. Incident Triage Router (`incident-router`)

- **Goal slug:** `incident-triage`
- **Context builders:**
  - `buildIncidentContext(incidentId)` merges incident record, routing matrix, and SLA thresholds.
  - Directive prefix `inc:` fetches incident; `routing:` fetches matrix slice.
- **Tools:**
  - `classifySeverityTool` — deterministic scoring (based on impact, urgency, SLA fields).
  - `selectQueueTool` — maps severity + service area to queue; returns queue ID with rationale.
  - `escalateIncidentTool` — logs escalation event (appends to `data/incidents/escalations.log` or memory stub in tests).
- **Tasks:**
  1. `AssessIncidentTask` → severity classification.
  2. `RouteIncidentTask` → queue selection with guard verifying queue exists.
  3. `EscalateIncidentTask` → executes when severity >= `high` and queue flagged `needsEscalation`.
- **Policy & verification:**
  - Policy ensures high severity incidents trigger escalation ledger entry.
  - Verification checks final payload includes `assignedQueue` and `nextAction` fields.

### 4. Invoice Verification Pipeline (`invoice-verification`)

- **Goal slug:** `invoice-verify`
- **Context builders:**
  - `buildInvoiceContext(invoiceId)` loads invoice + matching PO; attaches discrepancy heuristics.
  - Directive prefix `erp:` fetches purchase order data by PO ID, using `getPurchaseOrder` and caching.
- **Tools:**
  - `fetchInvoiceTool` & `fetchPurchaseOrderTool` — deterministic lookups.
  - `compareLineItemsTool` — wraps existing helper, returning discrepancy list with typed reasons.
  - `recordFindingsTool` — writes deterministic report JSON (timestamp stubbed) to context attachments.
- **Tasks:**
  1. `LoadInvoiceTask` → fetch invoice details.
  2. `CrossCheckPurchaseOrderTask` → fetch PO.
  3. `ReconcileLineItemsTask` → produce discrepancy list; guard triggers remediation branch if list non-empty.
  4. `RecordFindingsTask` → persist outputs (always runs, but includes branch metadata).
  5. `InitiateRemediationTask` (optional) → triggered when discrepancies exist; simulates ticket creation.
- **Policy & verification:**
  - Policy ensures total variance <= configured tolerance; violate → ledger `POLICY_VARIANCE`.
  - Verification asserts report includes `status`, `discrepancies[]`, and `nextSteps`.

### 5. Agent Coaching Feedback Loop (`coaching`)

- **Goal slug:** `agent-coaching`
- **Context builders:**
  - `buildCoachingContext(callId)` loads transcript metadata and scoring rubric.
  - Directive prefix `transcript:` retrieves transcript body; optional `csat:` directive fetches historic CSAT metrics.
- **Tools:**
  - `analyzeTranscriptTool` — sentiment + compliance analysis (deterministic scoring with heuristics; optionally seeds nucleus call for narrative feedback).
  - `generateFeedbackTool` — nucleus-backed structured feedback (with fallback template).
  - `logCoachingNoteTool` — deterministic logging (appends to synthetic CRM store or returns stub ID).
- **Tasks:**
  1. `AnalyzeTranscriptTask` → produce structured metrics (`sentimentScore`, `complianceFlags`).
  2. `GenerateFeedbackTask` → produce human-readable coaching tips anchored to metrics.
  3. `LogCoachingNoteTask` → persist feedback; guard ensures compliance failures trigger escalation note with supervisor mention.
- **Policy & verification:**
  - Policy: if compliance failure detected, ensure escalation note created.
  - Verification: final payload contains `feedbackSummary`, `actionItems`, and `logReference`.

## Planner & CLI Integration

- Extend goal registry at `src/goals/index.ts` with five new entries referencing helper builders.
- Update CLI selector in `bin/interactive.tsx` and `bin/acm-demo.ts` to expose new options (`--goal` values + interactive menu items).
- Provide shared helper `resolveExampleGoal(slug)` to map CLI input to goal factories.

## Testing Strategy

- Add integration suites under `tests/examples/` with one spec per example.
- Mock nucleus responses using existing harness; for deterministic fallbacks, set `NUCLEUS_MODE=offline` in tests.
- Validate replay bundles by asserting JSON schema + verifying ledger entries.
- Include snapshot testing (where stable) for final task payloads.

## Next Steps Checklist

1. Scaffold shared modules (`context/directives.ts`, `registry/examples.ts`, `policy/examples-policy.ts`).
2. Implement entitlement capability end-to-end as reference pattern.
3. Replicate pattern for the remaining four examples, factoring shared utilities as they emerge.
4. Wire CLI + goal registry, then author integration tests.
5. Update documentation & READMEs with usage instructions.
