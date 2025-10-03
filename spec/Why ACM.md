# Why the **Agentic Contract Model (ACM)** is a real addition—not a rebrand

# Executive summary

Modern stacks give you strong **orchestration** (Temporal, Argo/Flyte/Dagster/Prefect), mature **policy** (OPA/Rego), solid **data verification** (Great Expectations), and increasingly capable **agent frameworks** (LangChain et al.). But there’s still no *shared, auditable layer* that bridges **human/LLM goals** to **system-guaranteed execution units** with end-to-end consistency and replay across stochastic planning.

ACM proposes a thin, testable middle: **Goal → Plan → Capability → Task → Tools**. “Goal/Plan” live on the human/LLM side; “Capability/Task/Tools” are programmatic contracts with idempotency, typed failures, and verification. The claim isn’t that nothing exists—it’s that **no single framework unifies these artifacts as first-class, interoperable objects**. Evidence below.

---

# Market landscape (what we have today)

**Workflow orchestration**

* **Temporal**: code-first workflows with deterministic replay and durable event histories (excellent execution spine). ([Temporal Documentation][1])
* **Argo Workflows**: Kubernetes-native DAGs/steps as CRDs, container-centric execution. ([argoproj.github.io][2])
* **Flyte**: ML/data workflows with reproducibility and strong K8s integration. ([flyte.org][3])
* **Dagster**: “software-defined assets” make datasets/models first-class; focuses on data lineage & orchestration. ([Dagster][4])
* **Prefect**: Pythonic workflows with retries, state tracking, scheduling. ([Prefect][5])

**Policy & verification**

* **Open Policy Agent (OPA / Rego)**: declarative, query-style policies for auth, budgets, gates. ([openpolicyagent.org][6])
* **Great Expectations (GX)**: expectation suites, checkpoints, and docs for *data* validation. ([docs.greatexpectations.io][7])

**Agent frameworks**

* **LangChain** (and similar): planning + tool use (ReAct, etc.); focuses on agents calling tools, not on capability registries or deterministic replay across LLM planning. ([LangChain Docs][8])

**Reality check:** Each solves a slice superbly. None standardizes the **bridge** from **Goal/Plan** (human/LLM) to **Capability/Task** (system contracts) *and* ties that bridge to **replayable** execution and **verification** as composable artifacts.

---

# The need (what real teams keep asking for)

1. **A stable contract between messy intent and safe execution.**
   PM writes a paragraph, an LLM drafts steps; engineering needs **capabilities** and **tasks** with schemas, idempotency keys, and typed failures—*before* anything runs.

2. **End-to-end consistency across multiple tool calls.**
   Real “work” often chains tools (fetch → score → compute → act). Teams want a **logical task** (not just a raw tool step) that owns retries/compensations across that chain.

3. **Deterministic (or near-deterministic) replay of stochastic plans.**
   Orchestrators replay activities; agent frameworks log prompts. Few stacks **unify plan graphs, model versions, prompts, tool catalogs, and task I/O** into one replay bundle. Temporal provides durable histories at the workflow layer—but not the LLM planning artifacts; agent SDKs log LLM bits but not the engine’s event history. ([Temporal Documentation][9])

4. **A portable verification grammar.**
   GX covers data checks; teams still need simple invariants like “has keys,” “budget under X,” “risk != HIGH” at the **task** level—not buried in code. ([docs.greatexpectations.io][7])

5. **Policy separate from code.**
   Budgets, approvals, and safety gates should live in **policy-as-code** (OPA), not be duplicated in agents and workflows. The pieces exist, but the **contracted linkage** to tasks/capabilities is ad-hoc. ([openpolicyagent.org][6])

---

# The gap (what’s still missing)

* **No first-class “Capability Map.”**
  Orchestrators bind nodes to functions/containers; agent stacks bind to “tools.” Neither curates a **versioned registry of business-relevant capabilities** with schemas/invariants that planners must target.

* **“Task” lacks a durable identity.**
  Most systems reduce to “step/activity” (engine) or “tool call” (agent). The **logical task**—a business-meaningful unit that may orchestrate several tools with one idempotency key and typed failures—is not modeled as a reusable contract anywhere.

* **Unified replay across LLM + engine.**
  Temporal’s event history is excellent; LangChain’s run logs are improving. But there’s no spec that **bundles**: goal text, plan graph, capability map version, prompts, model IDs, retrieval snapshot, tool catalog version, and per-task I/O **together** for cross-team replay. ([Temporal Documentation][10])

* **Verification DSL that spans data and control.**
  GE handles data expectations; teams still script control/acceptance checks in code. No tiny, portable DSL is widely adopted for “post-conditions” at the task layer. ([docs.greatexpectations.io][7])

**Conclusion of the gap analysis:** There is **no single framework** that offers the *thin middle*—a contract layer that cleanly separates **Goal/Plan** (human/LLM) from **Capability/Task/Tools** (system), with **versioned artifacts, validation, verification, and replay** across both sides. This is not a dismissal of existing tools; it’s an interoperability hole.

---

# Why ACM (Agentic Contract Model) is important

**ACM** defines lightweight, auditable artifacts that snap into today’s stack:

* **Goal Card** (human/LLM): intent + constraints (SLA, budget, safety notes).
* **Plan Graph** (human/LLM → system): DAG of **tasks** (not raw tools), dataflow only.
* **Capability Map** (system): registry of tasks with input/output schemas, invariants.
* **Task Spec** (system): the **logical task** contract (idempotency key, typed failures, guards); may call multiple tools under the hood.
* **Policy Sheet** (system): OPA-expressed budgets, approvals, and gates bound to tasks/plans. ([openpolicyagent.org][6])
* **Verification Sheet** (system): post-conditions using a small grammar; pipe data-heavy checks to GX. ([docs.greatexpectations.io][7])
* **Replay Bundle** (bridge): everything needed to reproduce both planning and execution (prompts, models, plan, capability map version, tool versions, task I/O, engine history). Temporal’s histories cover the engine half well; ACM asks you to add the agent half coherently. ([Temporal Documentation][9])

The **payoff**: fewer placement arguments (what belongs where), easier audits, simpler re-drives, and clearer handoffs between product/ops/ML.

---

# Practical solution (compose what exists; add ACM where missing)

**Recommended composition (today):**

* **Execution spine**: Temporal (durable, replayable) *or* Argo/Flyte/Dagster/Prefect (DAG-first). ([Temporal Documentation][1])
* **Policy**: OPA/Rego for budgets, approvals, safety gates. ([openpolicyagent.org][6])
* **Verification**: Great Expectations for data; a tiny JSON-logic layer for control assertions. ([docs.greatexpectations.io][7])
* **Agents**: LangChain (or similar) for planning/tool use, but bind plans **to Capabilities (tasks)**, not directly to tools. ([LangChain Docs][8])
* **ACM artifacts**: maintain the **Capability Map, Task Specs, Plan Graph, Goal Card, Policy/Verification Sheets, and the Replay Bundle** as versioned files in Git—treat them like IaC.

**Where ACM adds value immediately**

1. **Capability Map**: declare business-level tasks with schemas; planners must target these, not arbitrary tools.
2. **Task Spec**: single place for idempotency keys, typed failures, and compensations across *multi-tool* logic.
3. **Replay Bundle**: unify Temporal/engine histories with agent prompts/models and tool catalogs for reproducible audits. ([Temporal Documentation][9])

**Falsifiability**: If a product ships a first-class capability registry, reusable logical tasks with end-to-end idempotency, and a single replay bundle covering LLM planning + engine events, then ACM’s novelty collapses. Current public docs do not show such an all-in-one system. (Closest pairs: Temporal + agent logs; Argo/Flyte + GX/OPA; none unify the artifacts themselves.) ([Temporal Documentation][1])

---

# What ACM solves in the real world (concrete scenarios)

* **Refund workflows with fraud gates**
  *Problem:* today, teams scatter rules across services, workflows, and agents.
  *ACM:* Capability `compute_refund`, Task spec with typed errors; Policy gate “block if risk=HIGH” in OPA; Verification “txn exists; audit logged; budget ≤ $0.50.” Now the plan can change without rewriting rules, and audits replay end-to-end. ([openpolicyagent.org][6])

* **Customer-support summarize → propose fixes**
  *Problem:* agents jump tool-to-tool; retries duplicate actions.
  *ACM:* Logical task `cluster_issues` owns multi-tool chain (search, extract, cluster) under one idempotency key; Verification checks presence of clusters; Replay Bundle retains prompts/models + engine history for reproducibility. ([docs.greatexpectations.io][7])

* **Regulated data enrichment**
  *Problem:* policy/approval logic is embedded in code; audits are slow.
  *ACM:* Policy Sheet externalizes approvals/budgets in Rego; Capability Map constrains what plans can invoke; engine executes with recorded event history + verification docs. ([openpolicyagent.org][6])

---

# Limits and open questions (be honest)

* **Standardization:** ACM defines artifacts; it doesn’t select a single executor. That’s intentional—but it means interop schemas (esp. for the Replay Bundle and Verification grammar) still need community work.
* **Granularity:** where to draw the line between “logical task” and “separate tasks” remains domain-dependent. ACM surfaces, but doesn’t “solve,” that trade-off.
* **Tooling:** no off-the-shelf “Capability Map service” exists; you’ll start with OpenAPI/JSON-Schema in Git and a small registry. (This is a gap ACM highlights.)

---

# Bottom line

* The market is rich—but **fragmented along a critical seam**: the boundary between **human/LLM planning** and **system-level guarantees**.
* ACM’s contribution is a **thin, auditable contract layer**—Capability Map + Task Specs + replay/verification/policy artifacts—that **composes** existing tools rather than competing with them.
* On public evidence, **no single framework** currently provides this layer end-to-end; combining a workflow engine (e.g., Temporal), OPA, GE, and an agent stack gets you close—but **ACM is the missing glue** that makes their interaction explicit, testable, and replayable. ([Temporal Documentation][1])


[1]: https://docs.temporal.io/workflows?utm_source=chatgpt.com "Temporal Workflow | Temporal Platform Documentation"
[2]: https://argoproj.github.io/workflows/?utm_source=chatgpt.com "Argo Workflows"
[3]: https://flyte.org/?utm_source=chatgpt.com "Dynamic, crash-proof AI orchestration with Flyte"
[4]: https://dagster.io/glossary/software-defined-assets?utm_source=chatgpt.com "What Is Software-defined Asset"
[5]: https://docs.prefect.io/?utm_source=chatgpt.com "Prefect Docs"
[6]: https://openpolicyagent.org/docs?utm_source=chatgpt.com "Introduction"
[7]: https://docs.greatexpectations.io/docs/0.18/oss/guides/validation/validate_data_lp/?utm_source=chatgpt.com "Validate Data"
[8]: https://docs.langchain.com/oss/javascript/langchain/agents?utm_source=chatgpt.com "Agents - Docs by LangChain"
[9]: https://docs.temporal.io/workflow-execution/event?utm_source=chatgpt.com "Events and Event History | Temporal Platform Documentation"
[10]: https://docs.temporal.io/encyclopedia/event-history?utm_source=chatgpt.com "Event History | Temporal Platform Documentation"
