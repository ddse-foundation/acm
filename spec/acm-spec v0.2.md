# Agentic Contract Model (ACM) — Core Specification v0.2 (Draft)

**Status:** Draft Specification
**Supersedes/extends:** ACM v0.1 Core (sections 1–8) 
**Date:** 2025-10-03
**License:** Apache-2.0 (recommended)

---

## 0. Scope of this revision

This revision **does not change** the five primary abstractions (Goal, Plan, Capability, Task, Tool). It **adds**:

1. **Context Packet** (required for planning)
2. **Context Lifecycle** (ingest → snapshot → augment → version)
3. **Decision Memory (Memory Ledger)**
4. **Plan Alternatives** (Plan-A/Plan-B)
5. **Branching Semantics** for Plans
6. **Execution-Engine Integration Guidelines** (LangGraph, Microsoft Agent Framework, Temporal/Argo/Flyte/Dagster/Prefect)

All other sections of v0.1 remain in force. 

---

## 9. Context Packet (required for Goal→Plan)

**Definition.** A **Context Packet** is the **immutable input bundle** used to generate or select a Plan for a Goal.

**Purpose.** Provide **complete, replayable grounding** to transform a Goal into one or more executable Plans without live reads.

**Structure (YAML/JSON):**

```yaml
context:
  id: "ctx-2025-10-03-001"
  sources:                 # URIs or digests of docs, KB snapshots, datasets
    - "kb-snap://sales-2025-09-30"
  facts:                   # normalized, scalarized facts used in planning
    orderId: "O123"
    customerId: "C789"
    region: "EU"
  assumptions:             # explicit, planner-supplied assumptions
    - "customer active == true"
  constraints_inherited:   # selected from Goal/Policy (read-only view)
    latency_sla_sec: 120
    budget_usd_max: 0.50
  provenance:              # how this packet was built (tooling, prompts, model ids)
    builder: "ctx-ingestor@1.3.2"
    retrieval_snapshot: "kb-snap:2025-09-30T23:59Z"
```

**Requirements.**

* A Plan **MUST** declare the `context.id` it used.
* Context Packets **MUST** be content-addressable (hash or digest) and retained in the **Replay Bundle** (see §13).

---

## 10. Context Lifecycle (ingest → snapshot → augment → version)

ACM defines four **phases** for context management:

1. **Ingest.** Collect raw materials (docs/records/features).
2. **Snapshot.** Produce a **frozen snapshot** (IDs/digests) used by planners.
3. **Augment.** Add derived features (summaries, embeddings, entity maps).
4. **Version.** Assign a monotonic version/tag and persist the packet.

**Conformance.**

* Planning **MUST** use a **snapshot/augmented** context, not live mutable sources.
* Each Plan **MUST** reference exactly one Context Packet version.

---

## 11. Decision Memory (Memory Ledger)

**Definition.** The **Memory Ledger** is an append-only log of **decisions** made across the lifecycle of a Goal/Plan, separate from tool I/O.

**Entries (examples).**

* `PLAN_SELECTED` (Plan-A chosen over Plan-B; rationale; selector = human/LLM/policy)
* `BRANCH_TAKEN` (edge guard result)
* `POLICY_DECISION` (allow/deny/limits/approval-id)
* `REPLAN_TRIGGERED` (cause; scope; diff summary)
* `COMPENSATION_APPLIED` (task id; reason)
* `GOAL_AMENDED` (who/what; delta)

**Conformance.**

* Memory Ledger **MUST** be included in the **Replay Bundle** and **MUST** be time-ordered and signed (or at minimum hashed) per entry.

---

## 12. Plan Alternatives (Plan-A / Plan-B)

**Definition.** A Goal may yield **multiple Plans** against the **same Context Packet**.

**Model.**

```yaml
goal:
  id: "REFUND-001"
plans:
  - id: "plan-A"
    contextRef: "ctx-2025-10-03-001"
    rationale: "Minimize cost"
  - id: "plan-B"
    contextRef: "ctx-2025-10-03-001"
    rationale: "Minimize latency"
selection:
  method: "human|policy|llm"
  chosenPlanId: "plan-A"
```

**Conformance.**

* The selection **MUST** be recorded in the **Memory Ledger** with rationale.
* Engines **MAY** support **dynamic re-selection** (switch Plan) if allowed by policy; such events must be logged as `REPLAN_TRIGGERED`.

---

## 13. Branching Semantics for Plans

**Plan Graph.** A Plan is a DAG of **Tasks**. Edges **MAY** carry **guards** (Boolean expressions over prior task outputs, Context Packet facts, and policy responses).

**Permitted branch types.**

* **Data-driven choice:** guards over task outputs/context (e.g., `$t3.risk == 'HIGH'`).
* **Policy gate:** guards over policy decisions (e.g., `!policy.allow`).
* **Human checkpoint:** awaits explicit approval artifact.
* **Error routing:** typed error edges (`RETRYABLE_ERROR`, `FATAL_ERROR`, `COMPENSATION_REQUIRED`).
* **Parallel fan-out/join:** explicit **join** node declares which predecessors it waits for.

**Representation (conceptual YAML):**

```yaml
edges:
  - from: t3; to: t4; guard: "$t3.risk == 'HIGH'"
  - from: t3; to: t5; guard: "$t3.risk != 'HIGH'"
  - from: t6; to: t_approval; guard: "!policy.allow"
  - from: tX; to: t_retry; on_error: "RETRYABLE_ERROR"
  - from: tX; to: t_comp;  on_error: "FATAL_ERROR"
```

**Determinism rule.** Guards **MUST** reference **recorded** facts only (task outputs, context, policy results) to retain replayability.

---

## 14. Execution-Engine Integration Guidelines

**14.1 Task Policy Interface (required)**
Every Task **MUST** expose a minimal **policy input** for a Policy Decision Point (PDP):

```json
{
  "action": "task.pre|task.post",
  "task": { "id": "t6", "capability": "create_refund_txn", "input": { ... }, "idemKey": "..." },
  "goal": { "id": "REFUND-001" },
  "plan": { "id": "plan-A", "contextRef": "ctx-2025-10-03-001", "capabilityMapVersion": "v2025.10" },
  "run":  { "engine": "langgraph|ms-af|temporal|argo|flyte|dagster|prefect", "runId": "..." },
  "metrics": { "cost_usd": 0.18, "elapsed_sec": 42 }
}
```

**14.2 Verification Hook (required)**
After `Task.execute`, run Verification checks (from the **Verification Sheet**) and emit typed results. Failures **MUST** be recorded and routed per Plan edges or policy.

**14.3 Replay Bundle (engine binding)**
The Replay Bundle **MUST** stitch engine traces with ACM artifacts:

* Engine run IDs, event history / OTEL trace export
* Goal Card, Plan Graph, Context Packet, Capability Map version
* Task Specs, per-task I/O, policy requests/responses, Memory Ledger
* Planner metadata (prompts, model ids/seeds) if LLMs were used in planning/repair

**14.4 Engine-specific notes (non-normative)**

* **LangGraph.** Model **ACM Tasks as graph nodes**; call PDP pre/post; store planner prompts/state for replay.
* **Microsoft Agent Framework.** Wrap workflow nodes with **Task adapters**; use AF observability; keep ACM IDs in spans; gate execution via PDP.
* **Temporal/Argo/Flyte/Dagster/Prefect.** Map **ACM Tasks to activities/ops**; invoke PDP via interceptors/sidecars; persist policy/verification artifacts alongside engine histories.

---

## 15. Minimal Additions to v0.1 Artifacts

* **Goal Card** → add `context_required: true` and `contextRef` (when bound).
* **Plan Graph** → add `contextRef`, optional `alternatives[]`, and `edges[].guard | edges[].on_error`.
* **Task Spec** → add `policyInput()` (or declarative equivalent), and `verificationRefs[]`.
* **Replay Bundle** → add `context/` (full packet), `memory-ledger/`, `policy/{requests,responses}/`, engine traces.

---

## 16. Conformance (delta to v0.1)

A system is **ACM v0.2 conformant** if, in addition to v0.1 requirements ():

1. **Context Packet** is present, versioned, and linked from each Plan.
2. **Memory Ledger** is recorded for all decisions (selection, branches, policy, re-plan).
3. **Plan Alternatives** are supported at the artifact level (even if the engine executes one).
4. **Branching** uses guard/on-error semantics over recorded facts only.
5. **Policy and Verification hooks** are implemented around each Task, with requests/responses logged.
6. **Replay Bundle** contains ACM + engine + planning artifacts sufficient for third-party reproduction.

---

## 17. Non-Normative Example (directory layout)

```
spec/
  ACM-SPEC-v0.2.md
capabilities/
  compute_refund.v1.json
  create_refund_txn.v2.json
context/
  ctx-2025-10-03-001.yaml
plans/
  refund.planA.yaml
  refund.planB.yaml
verify/
  refund.verify.yaml
policy/
  policy_sheet.yaml
  rego/
    acm.plan.rego
    acm.task.rego
replay/
  run-2025-10-03-REFUND-001/
    context/
    memory-ledger/
    policy/requests/
    policy/responses/
    engine-trace/
    task-io/
    planner/
```

---

### Notes

* This v0.2 draft is **additive**. Teams may adopt sections incrementally (Context Packet + Memory Ledger first) without breaking v0.1 usage. 
* Open items (to future versions): a tiny **Guard Expression grammar**, a **Verification DSL** shared across data/control, and a **Replay Bundle interchange schema**.

---

If you want, I can also produce **ready-to-use templates** (`*.yaml`/`*.json`) for the Context Packet, Memory Ledger entry schema, Plan-A/Plan-B example, and a minimal Task adapter for LangGraph and MS AF in an `/examples` folder next.

