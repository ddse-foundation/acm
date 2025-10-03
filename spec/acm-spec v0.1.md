# **Agentic Contract Model (ACM) — Core Specification v0.1**

**Status:** Draft Specification
**Author:** [ACM Working Group]
**Date:** 2025-10-03
**License:** Open Specification (Apache-2.0 recommended)

---

## 1. Introduction

The **Agentic Contract Model (ACM)** defines a conceptual framework for mapping **human or LLM-generated goals** into **system-executable artifacts**.

ACM separates **fuzzy intent (human/LLM side)** from **programmatic guarantees (system side)**, and introduces **contracts** as the bridging layer.

This model ensures:

* **Traceability:** from goal → execution → replay.
* **Consistency:** idempotency, compensations, and invariants.
* **Auditability:** artifacts persist for inspection and reproduction.

---

## 2. Core Abstractions

ACM defines **five primary abstractions**, grouped into two domains:

### 2.1 Human / LLM Domain

* **Goal**
  A human- or LLM-specified intent, expressed in natural or semi-structured language.

  * Properties: `id`, `intent`, `context`, `constraints`, `acceptance`.
  * Example: *“Issue a refund for Order O123 within SLA 2 minutes.”*

* **Plan**
  A structured decomposition of a Goal into a directed graph of **Tasks**.

  * Properties: `tasks[]`, `edges[]`, `metadata`.
  * Created by: human analyst, LLM planner, or hybrid.
  * Must be grounded in **Capabilities**.

### 2.2 System / Programmatic Domain

* **Capability**
  A catalog entry that describes a **business-relevant function** the system guarantees to provide.

  * Properties: `name`, `inputSchema`, `outputSchema`, `invariants`, `sideEffects`.
  * Example: `compute_refund(order) -> {amount, currency}`.
  * Serves as the **contract surface** between Plan and implementation.

* **Task**
  A logical execution unit bound to one or more **Tools** that achieves a Capability.

  * Properties: `id`, `capabilityRef`, `input`, `policy`, `idemKey`, `guards`.
  * End-to-end consistency: retries, idempotency, compensation must be defined at this level.

* **Tool**
  The lowest-level executor: function, API, or service that performs an atomic action.

  * Properties: `name`, `inputSchema`, `outputSchema`, `sideEffects?`.
  * Example: `billing.refund(orderId, amount) -> {transactionId}`.

---

## 3. Domain Boundary

ACM enforces a **domain boundary**:

```
Human/LLM Domain             System Domain
------------------------------------------------
Goal  ──>  Plan  ──>  Capability  ──>  Task  ──>  Tools
(intent)     (strategy)    (contract)     (unit)     (executor)
```

* **Goal + Plan**: variable, adaptive, fuzzy.
* **Capability + Task + Tools**: stable, deterministic, enforceable.
* The **Capability Map** (registry) is the handshake: the Plan must only reference declared Capabilities.

---

## 4. Contract Principles

* **Deterministic Contract:**
  Each Task must produce consistent outputs for the same inputs + idemKey.

* **Idempotency:**
  Tasks referencing side-effectful Tools must carry a stable `idemKey`.

* **Typed Failures:**
  Task outputs must distinguish: `SUCCESS | RETRYABLE_ERROR | FATAL_ERROR | COMPENSATION_REQUIRED`.

* **Verification Guards:**
  Each Task may declare post-conditions (`expectKeys`, `assertions`).

* **Replayability:**
  Execution must persist:

  * Goal text & constraints
  * Plan graph
  * Capability map version
  * Tool catalog version
  * Task inputs/outputs/errors
  * LLM prompts & model versions (if used in planning)

---

## 5. Artifact Definitions

* **Goal Card** (YAML/JSON)
  Defines a Goal with context and constraints.

* **Capability Map** (JSON-Schema/OpenAPI-like)
  Registry of system-supported Capabilities.

* **Plan Graph** (DAG in JSON/YAML)
  Graph of Tasks referencing Capabilities.

* **Task Spec** (JSON/YAML)
  Per-task contract: capabilityRef, input, policy, idemKey, guards.

* **Replay Bundle** (archive)
  Complete record enabling deterministic or near-deterministic re-execution.

---

## 6. Conformance

A system is **ACM-conformant** if it:

1. Maintains explicit artifacts for all five abstractions.
2. Enforces Capability contracts for all referenced Tasks.
3. Records Replay Bundles for all executed Plans.
4. Provides an interface to validate Plans against Capability Maps before execution.

---

## 7. Non-Goals

* ACM does not mandate **how Plans are generated** (LLM, heuristic, manual).
* ACM does not enforce **specific workflow engines** (Temporal, Argo, etc.).
* ACM does not prescribe **business domain ontologies**.

It only defines the **contracts and artifacts** for mapping human/LLM goals to programmatic execution.

---

## 8. Future Work

* Standard DSL for Verification Guards.
* Schema for Replay Bundle interoperability.
* Metrics for Plan quality (repairability, replayability).
* Mapping ACM onto existing engines (Temporal, LangGraph, Flyte).

---

✅ This is the **core ACM specification**.

---
