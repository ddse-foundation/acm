---
id: compliance
sidebar_position: 5
title: Compliance Checklist
---

Use this checklist to evaluate ACM deployments before promoting them to regulated environments.

## Artifact discipline

- [ ] Capability Map, Task Specs, Goal templates, and Tool manifests stored in a version-controlled repository.
- [ ] Replay bundle schema validated against `@ddse/acm-replay` templates.
- [ ] Context Packet builder produces signed digests with provenance.

## Operational readiness

- [ ] Decision ledger retention ≥ 180 days with tamper detection.
- [ ] Policy engine and verification hooks configured for high-risk capabilities.
- [ ] Pager/alerting on ledger anomalies or repeated policy denies.
- [ ] Backup and disaster recovery playbooks tested quarterly.

## Fairness & audit

- [ ] Plans referencing protected attributes documented with justification or proof of omission.
- [ ] Replay bundles sampled weekly and re-run for drift detection.
- [ ] Human approvals (where required) captured with identity and timestamp.

## Data governance

- [ ] Data classification tags preserved in Context Packets and replay bundles.
- [ ] Redaction workflow validated against privacy regulations (GDPR/CCPA).
- [ ] Third-party integrations (MCP servers, adapters) reviewed for data transfer compliance.

## Sign-off

- [ ] Governance lead sign-off recorded in release notes with bundle references.
- [ ] Security review completed for new capabilities/tools.
- [ ] Compliance attestation archived with immutable identifiers.

Keep the checklist in source control and adapt thresholds to your jurisdiction and company policies. Failing any item SHOULD block promotion until remedied.
