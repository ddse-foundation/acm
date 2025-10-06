---
id: policy-checks
sidebar_position: 4
title: Policy and Verification Hooks
---

Policy and verification hooks enforce runtime guardrails and acceptance criteria. They keep ACM runs compliant with regulatory expectations and internal controls.

## Policy engine integration

- **Declaration:** Tasks declare required policy bundles in their Task Specs. Each bundle references a digest tracked in source control.
- **Invocation:** During execution, the runtime evaluates policies before (`pre`) and after (`post`) the task body. The policy adapter MUST return a structured result with `verdict`, `explanations`, and `latencyMs`.
- **Escalations:** Denied decisions SHOULD provide escalation metadata so orchestration can route to human approval or compensating tasks.
- **Observability:** Stream `POLICY_DECISION` ledger entries to SIEM tools and configure alerting on repeated deny events.

## Verification grammar

Verification hooks validate task outputs against declarative assertions.

- Define verification rules in domain packages (for example, `@ddse/acm-verify-refunds`).
- Rules run synchronously after task completion; failure triggers `VERIFICATION_RESULT` with `status: failed` and optional remediation hints.
- Verification logic MUST be deterministic and side-effect free.

## Approvals and dual control

- High-risk capabilities SHOULD require dual approvals captured via policy hooks (`approval_required: true`).
- Approval artifacts (tickets, signatures) MUST be attached to replay bundles under `runtime/policy/`.
- Provide operator dashboards for pending approvals with SLA timers.

## Lifecycle management

- Version policies and verification rules alongside code (`policyBundles/v0.5/*`).
- Introduce backwards-compatible changes via additive rules; breaking changes require new bundle IDs.
- Maintain automated tests that execute policies against synthetic ledger fixtures.

## References

- `spec/acm-spec v0.5.md` Sections 3.2, 5.4
- `framework/node/src/runtime/policy` adapters
