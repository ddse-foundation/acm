# Agentic Contract Model (ACM) — Core Specification v0.5

**Status:** Draft for Working-Group Review
**Supersedes:** ACM v0.1 Core, ACM v0.2 Draft
**Date:** 2025-10-03
**License:** Apache-2.0 (recommended)

---

## 0. Scope of This Revision

ACM v0.5 provides a **single, normative specification** that unifies the content previously split between v0.1 (core abstractions) and v0.2 (context and execution updates). The revision:

- Retains the five foundational abstractions: **Goal, Plan, Capability, Task, Tool**.
- Adds normative requirements for **Context Packets**, **Context Lifecycle management**, **Plan Alternatives**, **Branching Semantics**, **Decision Memory (Memory Ledger)**, and **Execution-Engine integration hooks**.
- Consolidates artifact schemas into a single reference, including ready-to-use YAML/JSON templates.
- Defines **Replay Bundle** obligations covering both planning and execution traces for deterministic or near-deterministic reproduction.
- Declares explicit conformance criteria and validation checkpoints suitable for enterprise adoption.

All referenced artifacts and behaviors SHALL be version-controlled and auditable.

---

## 1. Introduction

The **Agentic Contract Model (ACM)** formalizes the contracts that bridge **human or model-generated intent** and **deterministic system execution**. ACM emphasizes reproducibility, policy compliance, and traceable decision-making across agentic workflows.

The model is intentionally **execution-engine agnostic**. Any workflow runner (Temporal, Argo, Flyte, Dagster, Prefect, LangGraph, Microsoft Agent Framework, etc.) MAY be used, provided it can satisfy the obligations in this specification.

### 1.1 Objectives

1. Ensure **traceability** from Goal articulation through Plan execution and replay.
2. Provide **deterministic contracts** (Capabilities, Tasks) that decouple variable planning logic from stable system guarantees.
3. Enable **policy and verification controls** around each Task invocation.
4. Deliver a **Replay Bundle** that captures every artifact required for independent audit or rerun.

### 1.2 Audience

This document targets:

- Platform engineers implementing agentic systems.
- Architects integrating ACM with orchestration platforms.
- Policy, governance, and risk teams responsible for audits.
- Tooling vendors seeking interoperability with ACM artifacts.

### 1.3 Terminology

RFC 2119 key words **MUST**, **SHOULD**, **MAY**, and **RECOMMENDED** are used to indicate requirement levels. “Planner” refers to the component (human, automated, or hybrid) that produces Plans from Goals. “Engine” refers to the execution runtime.

---

## 2. Core Abstractions (Normative)

ACM defines five primary abstractions. Each abstraction has a canonical artifact and MUST be version-controlled.

| Abstraction | Domain | Definition | Canonical Artifact |
|-------------|--------|------------|--------------------|
| **Goal** | Human / LLM | Declarative intent that captures desired outcome and constraints. | Goal Card (YAML/JSON) |
| **Plan** | Bridging | Directed acyclic graph (DAG) of Tasks that satisfies a Goal using declared Capabilities. Supports alternatives. | Plan Graph (YAML/JSON) |
| **Capability** | System | Business-level function the system guarantees, including IO schemas and invariants. | Capability Map (JSON/JSON-LD) |
| **Task** | System | Logical execution unit bound to Capabilities and Tools; owns idempotency, typed failures, compensations, policy hooks, verification hooks. | Task Spec (YAML/JSON) |
| **Tool** | System | Atomic executor (function, API, service). | Tool Catalog entry (OpenAPI/JSON Schema) |

The abstractions are connected as follows:

```text
Goal --(planning)--> Plan --(binding)--> Capability --(contract)--> Task --(execution)--> Tool
```

Plans MUST reference existing Capabilities; Tasks MUST bind to declared Capabilities and Tool contracts; Tools MUST remain stable enough to honor Task invariants.

---

## 3. Architecture Overview

### 3.1 Domain Boundary

```text
+----------------------+     +---------------------------------------+
| Human / LLM Domain   |     | System Domain                          |
|----------------------|     |----------------------------------------|
| Goal (intent)        | --> | Capability (contract catalog)          |
| Plan (strategy)      | --> | Task (logical execution unit)          |
|                      |     | Tool (concrete executor)               |
|                      |     |                                        |
|                      |     |                                        |
+----------------------+     +---------------------------------------+
```

- Goals and Plans may be mutable during ideation but MUST be frozen (versioned) before execution.
- Capabilities, Tasks, and Tools form the deterministic contract surface.
- The **Context Packet** (Section 5.3) forms the immutable bridge between planning and execution.

### 3.2 Execution Lifecycle

1. **Goal Intake** – capture intent, constraints, policy context.
2. **Context Assembly** – ingest, snapshot, augment data into a Context Packet.
3. **Planning** – produce ≥1 Plan referencing Capabilities, using the Context Packet.
4. **Plan Selection** – choose Plan-A (and optionally Plan-B) with recorded rationale.
5. **Execution** – run Tasks with policy and verification hooks; log Tool IO.
6. **Decision Logging** – append Memory Ledger entries for every decision, branch, policy action.
7. **Replay Packaging** – compile Replay Bundle including all artifacts and traces.

---

## 4. Context Lifecycle (Normative)

ACM defines four phases. Engines MUST NOT plan against mutable live data; planning MUST reference a frozen Context Packet.

| Phase | Description | Mandatory Outputs |
|-------|-------------|-------------------|
| **Ingest** | Collect raw materials (documents, records, features). | Raw source digests |
| **Snapshot** | Create immutable, content-addressable snapshot of relevant sources. | `context.sources[]` with digests |
| **Augment** | Generate derived features (summaries, embeddings, entity maps). | `context.augmentations[]` |
| **Version** | Assign monotonic version/tag; persist packet with provenance. | `context.version`, `context.provenance` |

Planning components MUST receive a fully versioned, augmented Context Packet. Each Plan MUST state the `contextRef` (content hash or URI) used for planning.

---

## 5. Artifact Specifications (Normative)

All artifacts MUST be serialized as YAML or JSON (UTF-8) and stored with immutable version identifiers. The following subsections define required fields and provide implementation-ready templates.

### 5.1 Goal Card

#### 5.1.1 Purpose

Captures business intent, acceptance criteria, and policy context.

#### 5.1.2 Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `goal.id` | string | Unique identifier (e.g., `REFUND-001`). |
| `intent` | string | Natural-language summary. |
| `actors` | list | Stakeholders or personas impacted. |
| `constraints` | object | Hard constraints (SLA, budget, compliance). |
| `acceptance` | object | Success criteria, verification targets. |
| `policy_context` | object | References to policy sheets / approvals. |
| `context_required` | boolean | MUST be `true` in v0.5 for execution-bound goals. |
| `metadata` | object | Planner hints, priority, creation timestamps. |

#### 5.1.3 Example (YAML)

```yaml
apiVersion: acm.ddse.ai/v0.5
kind: GoalCard
metadata:
  id: "REFUND-001"
  createdAt: "2025-09-30T21:18:44Z"
  owner: "support.ops"
  priority: "P1"
intent:
  summary: "Issue a refund for order O123 within 2 minutes, CC supervisor."
actors:
  - "support_agent"
  - "customer"
constraints:
  latency_sla_sec: 120
  budget_usd_max: 0.50
  jurisdictions:
    - "EU"
acceptance:
  must_include:
    - "refund_transaction_id"
    - "customer_notification"
  verification_refs:
    - "verify/refund.verify.yaml#post_conditions"
policy_context:
  policy_sheet: "policy/policy_sheet.yaml"
  approvals_required:
    - role: "support_manager"
      validUntil: "2025-10-07"
context_required: true
contextRef: null            # bound during planning
metadata:
  tags:
    - "refund"
    - "sla-critical"
  notes: "Fraud score must be checked before payout."
```

### 5.2 Capability Map

#### 5.2.1 Purpose

Defines the catalog of system-guaranteed Capabilities. Planners MUST reference Capabilities from this map; engines MUST validate Plans against the map before execution.

#### 5.2.2 Structure

Each Capability entry SHALL include:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Canonical name (`compute_refund`). |
| `version` | string | Semantic version (e.g., `v1.4.0`). |
| `inputSchema` | JSON Schema | Input contract. |
| `outputSchema` | JSON Schema | Output contract. |
| `invariants` | list | Post-conditions (e.g., `amount >= 0`). |
| `sideEffects` | list | Side effects requiring idempotency. |
| `tools` | list | Allowed Tool implementations with versions. |

#### 5.2.3 Example (JSON)

```json
{
  "apiVersion": "acm.ddse.ai/v0.5",
  "kind": "CapabilityMap",
  "metadata": {
    "id": "capability-map.v2025.10",
    "generatedAt": "2025-10-03T00:10:00Z"
  },
  "capabilities": [
    {
 
      "name": "compute_refund",
      "version": "v1.3.2",
      "inputSchema": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://acm.ddse.ai/schemas/compute_refund.input.json",
        "type": "object",
        "required": ["orderId", "currency"],
        "properties": {
          "orderId": { "type": "string" },
          "currency": { "type": "string", "pattern": "^[A-Z]{3}$" },
          "reasonCodes": {
            "type": "array",
            "items": { "type": "string" },
            "maxItems": 5
          }
        }
      },
      "outputSchema": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://acm.ddse.ai/schemas/compute_refund.output.json",
        "type": "object",
        "required": ["amount", "currency", "risk"],
        "properties": {
          "amount": { "type": "number", "minimum": 0 },
          "currency": { "type": "string", "pattern": "^[A-Z]{3}$" },
          "risk": { "type": "string", "enum": ["LOW", "MEDIUM", "HIGH"] },
          "explanations": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      },
      "invariants": [
        "amount >= 0",
        "currency == input.currency"
      ],
      "sideEffects": [
        "Reads order ledger",
        "Writes refund recommendation cache"
      ],
      "tools": [
        {
          "name": "refund-scorer",
          "version": "docker://refund-scorer:1.8.0"
        }
      ]
    }
  ]
}
```

### 5.3 Context Packet

#### 5.3.1 Purpose

Provides immutable, replayable grounding for planning. Plans MUST declare which Context Packet (`contextRef`) was used. Context Packets MUST be content-addressable and stored in the Replay Bundle.

#### 5.3.2 Structure

| Field | Type | Description |
|-------|------|-------------|
| `metadata.id` | string | Content-addressable identifier (`sha256-...`). |
| `metadata.version` | string | Monotonic version tag. |
| `sources` | list | URIs/digests of raw sources. |
| `facts` | object | Normalized scalar facts used in planning. |
| `assumptions` | list | Explicit planner assumptions. |
| `constraints_inherited` | object | Read-only view of Goal constraints. |
| `augmentations` | list | Derived artifacts (summaries, embeddings). |
| `provenance` | object | Tooling, model IDs, retrieval timestamps. |

#### 5.3.3 Example (YAML)

```yaml
apiVersion: acm.ddse.ai/v0.5
kind: ContextPacket
metadata:
  id: "sha256-c3b5d9cf398e7b23f23f0dcd1c2a6c7a55f0b23f9f1c95a9ff1d2e6f3ea8aa15"
  version: "ctx-2025-10-03-001"
  createdAt: "2025-10-03T00:05:12Z"
  builder: "ctx-ingestor@1.3.2"
sources:
  - uri: "kb-snap://sales-2025-09-30"
    digest: "sha256-6a8d..."
    type: "vector_db_snapshot"
  - uri: "s3://orders/2025/09/30/O123.json"
    digest: "sha256-1b2f..."
facts:
  orderId: "O123"
  customerId: "C789"
  region: "EU"
  priorRefunds: 1
assumptions:
  - "customer_status == 'ACTIVE'"
constraints_inherited:
  latency_sla_sec: 120
  budget_usd_max: 0.50
augmentations:
  - type: "summary"
    artifact: "ctx://summaries/order-O123.txt"
  - type: "embedding"
    artifact: "ctx://embeddings/order-O123.npy"
provenance:
  retrieval_snapshot: "kb-snap:2025-09-30T23:59Z"
  llm:
    provider: "azure-openai"
    model: "gpt-4o"
    temperature: 0.1
  prompt_digest: "sha256-0df4..."
```

#### 5.3.4 Internal Context Scope

The Context Packet remains immutable once referenced by a Plan. However, planners and Tasks MAY maintain a **Nucleus-internal context scope** for ephemeral enrichments discovered during execution. Internal scope artifacts:

- MUST be content-addressed and recorded with digests under `internalContext`.
- MUST remain private to the owning Task or planner step unless explicitly promoted, at which point a new Context Packet version SHALL be minted.
- SHALL be captured in the Replay Bundle (`planner/internal-context/`) together with provenance and retrieval rationale.
- SHALL include ledger entries of type `CONTEXT_INTERNALIZED` referencing the originating Task/Nucleus and the artifact digests.

### 5.4 Plan Graph

#### 5.4.1 Purpose

Specifies the DAG of Tasks, including Plan alternatives, branching semantics, edge guards, and error routing.

#### 5.4.2 Requirements

- Each Plan MUST reference the Context Packet via `contextRef`.
- Plans MAY declare alternatives (`alternatives[]`) sharing the same Context Packet.
- Guards MUST reference recorded facts only (task outputs, Context facts, policy responses).
- Error routing MUST be typed (`RETRYABLE_ERROR`, `FATAL_ERROR`, `COMPENSATION_REQUIRED`).

#### 5.4.3 Example (YAML)

```yaml
apiVersion: acm.ddse.ai/v0.5
kind: PlanSet
metadata:
  goalId: "REFUND-001"
  capabilityMapVersion: "capability-map.v2025.10"
contextRef: "sha256-c3b5d9cf398e7b23f23f0dcd1c2a6c7a55f0b23f9f1c95a9ff1d2e6f3ea8aa15"
plans:
  - id: "plan-A"
    rationale: "Minimize cost"
    tasks:
      - id: "t1"
        capabilityRef: "compute_refund@v1.3.2"
        inputRef: "task-specs/compute_refund.yaml"
      - id: "t2"
        capabilityRef: "assess_risk@v2.0.0"
        inputRef: "task-specs/assess_risk.yaml"
      - id: "t3"
        capabilityRef: "create_refund_txn@v2.2.1"
        inputRef: "task-specs/create_refund_txn.yaml"
    edges:
      - from: "t1"
        to: "t2"
      - from: "t2"
        to: "t3"
        guard: "$t2.risk != 'HIGH'"
      - from: "t2"
        to: "t_approval"
        guard: "$t2.risk == 'HIGH'"
      - from: "t3"
        to: "t_notify"
      - from: "t_create_comp"
        to: "t_notify"
        on_error: "COMPENSATION_REQUIRED"
  - id: "plan-B"
    rationale: "Minimize latency"
    tasks:
      - id: "tb1"
        capabilityRef: "lookup_cached_refund@v1.0.0"
        inputRef: "task-specs/lookup_cached_refund.yaml"
      - id: "tb2"
        capabilityRef: "create_refund_txn@v2.2.1"
        inputRef: "task-specs/create_refund_txn.yaml"
    edges:
      - from: "tb1"
        to: "tb2"
selection:
  method: "policy"
  chosenPlanId: "plan-A"
  rationale: "cached refund unavailable; policy requires risk assessment"

> **Note:** Auxiliary Tasks referenced in the edges (`t_approval`, `t_notify`, `t_create_comp`) MUST ship their own Task Specs and appear in the Plan graph or companion Plan files. Stubs may be provided when illustrating the pattern, but conformant Plans SHALL reference concrete Task Specs before execution.
```

### 5.5 Task Specification

#### 5.5.1 Purpose

Defines the logical execution contract a runtime MUST honor, including idempotency, policy hooks, verification references, compensation, and Tool bindings.

#### 5.5.2 Structure

| Field | Type | Description |
|-------|------|-------------|
| `metadata.id` | string | Task identifier unique within Plan. |
| `capabilityRef` | string | `name@version` referencing Capability Map. |
| `input` | object | Task input bindings (templated or literal). |
| `policyInput` | object | Serializable payload for Policy Decision Point. |
| `verificationRefs` | list | References to verification definitions. |
| `idemKey` | string | Stable idempotency key expression (e.g., `${goal.id}-${context.facts.orderId}`). |
| `retryPolicy` | object | Limits, backoff strategies. |
| `compensation` | object | Details of compensating actions. |
| `tools` | list | Concrete tool invocations (with versions). |
| `nucleusRef` | string | Optional reference to a Nucleus artifact governing LLM calls for this Task. |
| `internalTools` | list | Optional internal-only tools (e.g., context retrievers) guarded by the Nucleus. |
| `telemetry` | object | OTEL span metadata requirements. |

#### 5.5.3 Example (YAML)

```yaml
apiVersion: acm.ddse.ai/v0.5
kind: TaskSpec
metadata:
  id: "t3"
  goalId: "REFUND-001"
  planId: "plan-A"
capabilityRef: "create_refund_txn@v2.2.1"
idemKey: "${goal.id}-${context.facts.orderId}-${context.facts.customerId}"
input:
  orderId: "${context.facts.orderId}"
  amount: "${tasks.t1.output.amount}"
  currency: "${tasks.t1.output.currency}"
  riskTier: "${tasks.t2.output.risk}"
policyInput:
  action: "task.pre"
  task:
    id: "t3"
    capability: "create_refund_txn"
    idemKey: "${task.idemKey}"
    inputPreview:
      orderId: "${context.facts.orderId}"
      amount: "${tasks.t1.output.amount}"
  goal:
    id: "REFUND-001"
  plan:
    id: "plan-A"
    contextRef: "sha256-c3b5d9cf398e7b23f23f0dcd1c2a6c7a55f0b23f9f1c95a9ff1d2e6f3ea8aa15"
    capabilityMapVersion: "capability-map.v2025.10"
  run:
    engine: "langgraph"
    runId: "lg-2025-10-03-00281"
  metrics:
    budget_usd_remaining: 0.32
retryPolicy:
  maxAttempts: 3
  backoffSeconds: [5, 15]
  retryOn:
    - "RETRYABLE_ERROR"
compensation:
  capabilityRef: "void_refund_txn@v1.0.0"
  triggerOn:
    - "COMPENSATION_REQUIRED"
verificationRefs:
  - "verify/refund.verify.yaml#txn_postconditions"
tools:
  - name: "billing.refund"
    version: "rest://billing/v3/refund"
    timeout_sec: 30
telemetry:
  tracing:
    otelSpanName: "acm.task.t3.create_refund_txn"
    attributes:
      goal.id: "REFUND-001"
      plan.id: "plan-A"
      task.id: "t3"
```

### 5.6 Tool Catalog

#### 5.6.1 Purpose

Defines the atomic executors (functions, APIs, services) that Tasks may bind to. Tool definitions MUST describe operational requirements (auth, timeouts, side effects) so runtime adapters can enforce Task contracts.

#### 5.6.2 Structure

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Globally unique tool name (`billing.refund`). |
| `version` | string | Implementation version or image digest. |
| `interface` | object | Transport details (REST, gRPC, queue) including endpoint URIs. |
| `inputSchema` | JSON Schema | Expected request payload. |
| `outputSchema` | JSON Schema | Response contract including typed errors. |
| `auth` | object | Authentication mode (e.g., OAuth client, Azure Managed Identity). |
| `timeouts` | object | Timeouts and retries allowed at the tool layer. |
| `sideEffects` | list | Declared side effects that require idempotency or compensation. |
| `observability` | object | Required telemetry attributes/spans for tracing. |

#### 5.6.3 Example (YAML)

```yaml
apiVersion: acm.ddse.ai/v0.5
kind: ToolDefinition
metadata:
  name: "billing.refund"
  version: "rest://billing/v3/refund"
  owner: "finance.platform"
interface:
  transport: "https"
  method: "POST"
  endpoint: "https://billing.internal/api/v3/refunds"
  headers:
    Content-Type: "application/json"
inputSchema:
  $schema: "https://json-schema.org/draft/2020-12/schema"
  type: "object"
  required: ["orderId", "amount", "currency"]
  properties:
    orderId: { type: "string" }
    amount: { type: "number", minimum: 0 }
    currency: { type: "string", pattern: "^[A-Z]{3}$" }
outputSchema:
  $schema: "https://json-schema.org/draft/2020-12/schema"
  type: "object"
  required: ["transactionId", "status"]
  properties:
    transactionId: { type: "string" }
    status: { type: "string", enum: ["COMPLETED", "PENDING", "DECLINED"] }
    errorCode: { type: "string" }
auth:
  mode: "azure-managed-identity"
  audience: "api://billing"
timeouts:
  requestTimeoutSec: 30
  retryPolicy:
    maxAttempts: 2
    backoffSeconds: [2, 5]
sideEffects:
  - "Writes refund transaction ledger"
observability:
  tracing:
    otelSpanName: "tool.billing.refund"
    requiredAttributes:
      - "tool.name"
      - "tool.version"
```

Tool definitions SHOULD be stored under `tools/` and referenced by Task Specs (`tools[].name` + `version`).

### 5.7 Policy Sheet

Policy rules SHOULD be externalized using policy-as-code (e.g., OPA/Rego). The Task spec’s `policyInput` is the payload for evaluation.

```rego
package acm.policy.plan

default allow := false

allow {
  input.goal.id == "REFUND-001"
  input.action == "task.pre"
  input.metrics.budget_usd_remaining >= 0.10
  not high_risk(input)
}

high_risk(input) {
  input.task.capability == "create_refund_txn"
  input.task.inputPreview.riskTier == "HIGH"
}
```

Policy decisions MUST be recorded in the Memory Ledger with `POLICY_DECISION` entries.

### 5.8 Verification Sheet

Verification definitions SHOULD be declarative. ACM does not prescribe a DSL but RECOMMENDS JSON-based expressions to align with CI tooling. Example YAML referencing JSONLogic-like expressions:

```yaml
apiVersion: acm.ddse.ai/v0.5
kind: VerificationSheet
metadata:
  id: "refund.verify.yaml"
checks:
  txn_postconditions:
    description: "Ensure refund transaction is persisted and notification queued."
    type: "post"
    assertions:
      - expr: "exists(tasks.t3.output.transactionId)"
        message: "Transaction ID must be present."
      - expr: "tasks.t3.output.status == 'COMPLETED'"
        message: "Refund status must be COMPLETED."
      - expr: "queue.contains('customer_notifications', goal.id)"
        message: "Notification job must exist."
    onFailure:
      route: "tasks.t3.on_error"
      severity: "HIGH"
```

Verification results MUST be recorded and routed through Plan edges or policy gates.

### 5.9 Memory Ledger (Decision Log)

#### 5.9.1 Purpose

Immutable, append-only ledger capturing all non-I/O decisions.

#### 5.9.2 Entry Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique entry ID. |
| `timestamp` | string | ISO-8601. |
| `type` | string | Enumerated type (`PLAN_SELECTED`, `BRANCH_TAKEN`, `POLICY_DECISION`, `REPLAN_TRIGGERED`, `COMPENSATION_APPLIED`, `GOAL_AMENDED`). |
| `actor` | string | `human`, `llm`, `policy`, `engine`. |
| `details` | object | Type-specific payload. |
| `hash` | string | Content hash for tamper evidence. |
| `signature` | string | Optional digital signature. |

#### 5.9.3 Example (JSON Lines)

Ledger `type` enumerations SHALL include `NUCLEUS_INFERENCE` (for deterministic LLM calls executed within a Nucleus) and `CONTEXT_INTERNALIZED` (for artifacts added to internal context scope). Each entry MUST capture prompt/template digests, model identifiers, retrieval directives, and resulting artifact hashes.

```jsonl
{"id":"ledger-0001","timestamp":"2025-10-03T00:06:01Z","type":"PLAN_SELECTED","actor":"policy","details":{"goalId":"REFUND-001","selected":"plan-A","alternatives":["plan-B"],"rationale":"policy requires risk assessment"},"hash":"sha256-5d1b..."}
{"id":"ledger-0002","timestamp":"2025-10-03T00:06:25Z","type":"NUCLEUS_INFERENCE","actor":"llm","details":{"taskId":"t2","nucleusId":"nucleus-planA","promptDigest":"sha256-c1f9...","model":"gpt-4o","seed":1234,"decision":"NEEDS_CONTEXT","requestedArtifacts":["ctx://summaries/order-O123.txt"]},"hash":"sha256-fb02..."}
{"id":"ledger-0003","timestamp":"2025-10-03T00:06:32Z","type":"CONTEXT_INTERNALIZED","actor":"engine","details":{"taskId":"t2","artifacts":[{"digest":"sha256-abc1...","scope":"internal"}]},"hash":"sha256-a902..."}
{"id":"ledger-0004","timestamp":"2025-10-03T00:07:10Z","type":"POLICY_DECISION","actor":"policy","details":{"decision":"deny","policyId":"acm.policy.plan","reason":"riskTier == 'HIGH'"},"hash":"sha256-1d9c..."}
```

Ledger entries MUST be ordered, immutable, and included in the Replay Bundle.

### 5.10 Replay Bundle

#### 5.10.1 Purpose

Aggregate everything needed for third-party reproduction: planning artifacts, execution history, policy decisions, verification outcomes, OTEL traces, and Task IO.

#### 5.10.2 Required Contents

| Directory | Description |
|-----------|-------------|
| `goal/` | Goal Card (frozen). |
| `context/` | Context Packet plus raw digests. |
| `plans/` | Plan Graph(s), selection metadata. |
| `capability-map/` | Capability Map version referenced. |
| `task-specs/` | All Task specifications executed. |
| `policy/requests/` | Serialized policy inputs. |
| `policy/responses/` | Serialized policy decisions. |
| `verification/` | Verification Sheet, evaluation results. |
| `memory-ledger/` | Ordered ledger entries (JSONL). |
| `engine-trace/` | Engine-native traces (Temporal history, OTEL spans, etc.). |
| `task-io/` | Per-task input/output payloads. |
| `planner/` | Planner prompts, model IDs, seeds, diff logs. |
| `planner/internal-context/` | Internal context artifacts captured by Nucleus, including retrieval manifests and digests. |
| `planner/llm-calls.jsonl` | Ordered record of `LLMCall` executions with prompt hashes, seeds, and model metadata. |

#### 5.10.3 Example Manifest (YAML)

```yaml
apiVersion: acm.ddse.ai/v0.5
kind: ReplayBundleManifest
metadata:
  goalId: "REFUND-001"
  runId: "lg-2025-10-03-00281"
  generatedAt: "2025-10-03T00:10:45Z"
contents:
  goal: "goal/goal-card.yaml"
  context: "context/ctx-2025-10-03-001.yaml"
  plans:
    - "plans/refund.planA.yaml"
    - "plans/refund.planB.yaml"
  capabilityMap: "capability-map/capability-map.v2025.10.json"
  taskSpecs:
    - "task-specs/t1.compute_refund.yaml"
    - "task-specs/t2.assess_risk.yaml"
  policy:
    requests: "policy/requests/"
    responses: "policy/responses/"
  verification: "verification/results.json"
  memoryLedger: "memory-ledger/ledger.jsonl"
  engineTrace: "engine-trace/langgraph-run.json"
  taskIO: "task-io/"
  planner: "planner/prompts.md"
checksum:
  algorithm: "sha256"
  value: "sha256-7af2..."
```

Engines MUST guarantee that the Replay Bundle is complete before marking a run as finished.

---

## 6. Execution Semantics

### 6.1 Planning Obligations

- Planners MUST operate on immutable Context Packets.
- Plan alternatives MUST share the same Context Packet unless explicitly declared otherwise (rare and REQUIRES policy approval).
- Plan selection MUST be recorded in the Memory Ledger with rationale and selector identity.
- Re-planning events MUST append `REPLAN_TRIGGERED` entries with cause and diff summary.

### 6.2 Branching Semantics

- Guards MUST evaluate deterministically using recorded data.
- Parallel fan-out tasks MUST declare join semantics (e.g., `join: all`, `join: any`).
- Error routing MUST specify typed edges, enabling compensation flows.
- Human checkpoints MUST reference approval artifacts stored in the Replay Bundle.

### 6.3 Task Execution Flow

1. **Policy Pre-Hook:** Evaluate `policyInput` with PDP. Record decision.
2. **Nucleus Preflight:** If a Task specifies `nucleusRef`, the engine MUST invoke the Nucleus `preflight` hook. When the hook returns `NEEDS_CONTEXT`, the engine SHALL execute the declared internal retrieval Task(s) before proceeding and append corresponding ledger entries.
3. **Task Execution:** Invoke Tools under Task contract; enforce idempotency via `idemKey`.
4. **Verification:** Run declared checks. Route failures per Plan edges or policy.
5. **Policy Post-Hook:** Optional additional PDP evaluation (`action: task.post`).
6. **Logging:** Persist Task IO, policy request/response, verification outcomes, telemetry spans, and all Nucleus inferences.

### 5.11 Nucleus Contract

#### 5.11.1 Purpose

The **Nucleus** encapsulates deterministic cognitive behavior (LLM or equivalent reasoning) for planners and Tasks. It provides a single, auditable `LLMCall` member responsible for assessing context sufficiency, steering internal retrieval, and emitting reasoning outputs.

#### 5.11.2 Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `metadata.id` | string | Unique identifier scoped to Goal/Plan or Task (`nucleus-planA`, `nucleus-task-t2`). |
| `binding` | object | References to `goalId`, `planId`, `taskId` (when applicable), and `contextRef`. |
| `llmCall` | object | Deterministic configuration: provider, model, temperature, seed, prompt template digest, stop tokens. |
| `hooks.preflight` | object | Schema describing possible return codes (`OK`, `NEEDS_CONTEXT`, `ABORT`) and criteria. |
| `hooks.postcheck` | object | Optional post-execution evaluation instructions. |
| `internalContext` | list | Content-addressable artifacts managed by the Nucleus with provenance fields. |
| `internalTools` | list | Referenced internal-only tools or Tasks (e.g., context retrievers) including policy requirements. |
| `telemetry` | object | Required tracing/span metadata for each `LLMCall`. |

#### 5.11.3 Behavioral Requirements

- `llmCall` executions MUST record prompt hashes, model identifiers, seeds, and decisions in the Memory Ledger as `NUCLEUS_INFERENCE` entries.
- When `hooks.preflight` returns `NEEDS_CONTEXT`, the engine SHALL execute the declared `internalTools` in-order and capture outputs under `internalContext`.
- Internal context artifacts MAY be promoted to shared context only via issuance of a new Context Packet (`context.version += 1`).
- `hooks.postcheck` MAY trigger compensations or policy escalations; such decisions MUST be logged with ledger entries referencing the originating `llmCall`.

### 6.4 Error Handling and Compensation

- RETRYABLE errors MUST respect `retryPolicy` and log attempts.
- FATAL errors MUST halt the Plan unless an alternate branch is explicitly defined.
- COMPENSATION actions MUST be modeled as Tasks with their own specs and included in the Plan graph.

---

## 7. Execution-Engine Integration Guidelines (Informative but Recommended)

### 7.1 LangGraph

- Represent each ACM Task as a LangGraph node.
- Call PDP hooks before and after node execution.
- Persist planner prompts and state snapshots under `planner/` in the Replay Bundle.

### 7.2 Microsoft Agent Framework

- Wrap workflow nodes with ACM Task adapters that construct `policyInput` payloads.
- Use AF’s OpenTelemetry integration; propagate ACM IDs in spans.
- Gate execution through PDP responses; abort or re-route per Plan edges on policy deny.

### 7.3 Temporal / Argo / Flyte / Dagster / Prefect

- Map ACM Tasks to workflow activities/operators.
- Invoke PDP via interceptors or sidecars.
- Ensure activity inputs/outputs are exported into the Replay Bundle’s `task-io/` directory.
- Persist policy/verification artifacts alongside engine histories.

---

## 8. Conformance Checklist

A system is **ACM v0.5 conformant** if it satisfies ALL items below:

- **Artifact Governance:** Goal Cards, Context Packets, Plans, Task Specs, Capability Map, Policy/Verification Sheets, and Replay Bundles are stored in version control with immutable IDs.
- **Context Discipline:** All Plans declare a `contextRef`. Planning operates solely on snapshot/augmented context.
- **Plan Alternatives & Branching:** Plan selection decisions are recorded; guards reference only recorded facts; branches are deterministic.
- **Task Contracts:** Tasks reference Capability Map entries, declare `idemKey`, policy inputs, verification references, retry/compensation policies.
- **Policy & Verification Hooks:** PDP pre/post checks run for each Task with logged requests/responses, and verification outputs are captured and routed per Plan edges.
- **Memory Ledger:** Append-only, ordered, hashed log covering plan selection, branches, policy decisions, re-plans, compensations, goal amendments.
- **Replay Bundle Completeness:** Replay Bundle contains planner metadata, engine traces, policy artifacts, Task IO, verification results, Memory Ledger.
- **Auditability:** Content hashes/signatures allow tamper detection across artifacts and ledger entries.

Non-conformant systems MUST NOT claim ACM v0.5 compatibility.

---

## 9. Validation Workflow (Recommended)

1. **Static Validation** – Lint artifacts against JSON Schema and referential integrity (e.g., Plans referencing existing Tasks/Capabilities).
2. **Policy Dry Run** – Evaluate `policyInput` payloads for each Task using PDP in dry-run mode.
3. **Verification Simulation** – Run verification expressions against sample outputs.
4. **Replay Drill** – Select Replay Bundle and perform synthetic replay to confirm completeness.

---

## 10. Reference Repository Layout (Informative)

```text
spec/
  acm-spec v0.5.md
capabilities/
  capability-map.v2025.10.json
  compute_refund.v1.3.2.schema.json
context/
  ctx-2025-10-03-001.yaml
plans/
  refund.planA.yaml
  refund.planB.yaml
task-specs/
  t1.compute_refund.yaml
  t2.assess_risk.yaml
  t3.create_refund_txn.yaml
policy/
  policy_sheet.yaml
  rego/
    acm.plan.rego
    acm.task.rego
verify/
  refund.verify.yaml
replay/
  run-2025-10-03-REFUND-001/
    manifest.yaml
    goal/
    context/
    plans/
    capability-map/
    task-specs/
    memory-ledger/
    policy/
    verification/
    engine-trace/
    task-io/
    planner/
```

---

## 11. Change Log

| Version | Date | Summary |
|---------|------|---------|
| v0.5 | 2025-10-03 | Unified v0.1+v0.2, added normative context, memory ledger, branching, policy hooks, replay requirements, templates. |
| v0.2 | 2025-10-03 | (Superseded) Added Context Packet, Memory Ledger, Plan alternatives, branching semantics, engine guidance. |
| v0.1 | 2025-10-03 | (Superseded) Defined five core abstractions and high-level artifacts. |

---

## 12. Open Items (Non-Normative)

The working group is investigating:

- Standard guard-expression grammar and evaluation semantics.
- Shared verification DSL spanning data and control checks.
- Formal Replay Bundle interchange schema for cross-vendor validation.
- Capability Map registry service with discovery APIs.

---

## 13. References

- [Temporal Documentation — Workflows & Event History](https://docs.temporal.io/)
- [Argo Workflows](https://argoproj.github.io/workflows/)
- [Flyte](https://flyte.org/)
- [Dagster](https://dagster.io/)
- [Prefect](https://docs.prefect.io/)
- [Open Policy Agent / Rego](https://openpolicyagent.org/)
- [Great Expectations](https://docs.greatexpectations.io/)
- [Microsoft Agent Framework](https://learn.microsoft.com/en-us/agent-framework/overview/)
- [LangGraph](https://langchain-ai.github.io/langgraph/)

---

End of Specification v0.5
