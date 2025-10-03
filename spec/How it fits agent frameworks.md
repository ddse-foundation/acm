**Microsoft’s new Agent Framework covers a lot of the runtime and orchestration pieces we discussed, but it does not (yet) ship the full “ACM thin-middle” as first-class artifacts.** It’s a solid execution spine (agents, multi-agent workflows, state, checkpointing, MCP tool integration, OpenTelemetry traces) you can build on—then layer ACM’s Capability Map + Task Specs + Replay Bundle on top.

Here’s the evidence-based comparison.

# What Microsoft Agent Framework actually includes

* **Agents + multi-agent workflows** with graph orchestration, type-based routing, checkpointing, human-in-the-loop, and long-running state. That’s explicitly called out in the Learn overview and the announcement. ([Microsoft Learn][1])
* **Tooling & protocol integration**: tools and **Model Context Protocol (MCP)** for dynamic tool connections. ([Microsoft Learn][1])
* **Observability**: OpenTelemetry-based tracing for agent workflows; Microsoft says they’re contributing OTEL extensions for agentic systems. ([Microsoft Azure][2])
* **Open-source SDK/runtime (.NET & Python)** with samples; positioned as a unification/successor to Semantic Kernel + AutoGen. ([Microsoft Learn][1])
* **Azure AI Foundry integration** for deployment, governance, and new “multi-agent workflows” in the managed Agent Service (private/public previews). ([Microsoft Azure][2])

# Where it overlaps with ACM

* **Plan (DAG of work)** → **Workflows**: AF gives you a graph runner with retries, checkpointing, state, and agent nodes. That maps to ACM’s *Plan* layer. ([Microsoft Learn][1])
* **Tools**: AF’s tool calls + MCP clients map cleanly to ACM’s *Tools*. ([Microsoft Learn][1])
* **Replay/telemetry (partial)**: AF + Azure AI Foundry provide histories/telemetry and OTEL traces—the execution half of ACM’s *Replay Bundle*. (ACM also expects preserving planning artifacts like prompts/model IDs/plan files.) ([Microsoft Azure][2])

# What’s still missing vs. ACM (today)

* **Capability Map (first-class, versioned catalog).** I couldn’t find a formal Microsoft artifact that defines a **registry of business-level capabilities** (names + I/O schemas + invariants) that planners must target. AF talks about tools/agents/workflows—not a capability registry spec. ([Microsoft Learn][1])
* **Task as a logical contract** (end-to-end idempotency across multi-tool internals, typed failure taxonomy, compensation policy). AF has workflow steps/agents, but no explicit *Task Spec* object with idempotency keys and post-conditions as a reusable contract. ([Microsoft Learn][1])
* **Unified Replay Bundle spec** spanning **LLM planning + engine execution** (goal text, plan graph file, capability map version, prompts, model versions, retrieval snapshot, tool catalog version, plus per-task I/O). AF/Foundry give observability and histories, but not a cross-layer replay artifact spec. ([Microsoft Azure][2])
* **Policy/verification DSL**: AF references responsible-AI features and governance in Foundry, but there’s no developer-facing, portable DSL akin to ACM’s Policy/Verification Sheets (e.g., Rego rules for budgets/approvals and post-conditions like “exists keys / budget ≤ X”). ([Microsoft Azure][2])

# Verdict

* **Does Microsoft Agent Framework address what we addressed here?**
  **Partially—on execution and orchestration.** It’s a strong base for *Plan* (workflows), *Tools*/MCP, and *observability*. It **does not** currently publish first-class artifacts for ACM’s *Capability Map*, *Task Spec* contracts, or a *Unified Replay Bundle* that includes LLM planning metadata. Those are the pieces you’d still model in your repo and validate before running AF workflows. ([Microsoft Learn][1])

# Practical way to combine them (today)

* Use **Agent Framework** for agents + multi-agent workflows and deployment to **Azure AI Foundry Agent Service**. ([Microsoft Azure][2])
* Keep **ACM artifacts in Git**:

  * **Capability Map** (versioned JSON/OpenAPI) for business-level capabilities.
  * **Task Specs** (idempotency keys, typed failures, compensations, verification checks).
  * **Replay Bundle** that *adds* planning artifacts (prompts, model IDs, plan file) to AF/Foundry telemetry exports.
* Enforce **plan-to-capability validation** before running AF workflows; wire **policy** via OPA/Rego if you need externalized budgets/approvals.


[1]: https://learn.microsoft.com/en-us/agent-framework/overview/agent-framework-overview "Introduction to Microsoft Agent Framework | Microsoft Learn"
[2]: https://azure.microsoft.com/en-us/blog/introducing-microsoft-agent-framework/ "Introducing Microsoft Agent Framework | Microsoft Azure Blog"
