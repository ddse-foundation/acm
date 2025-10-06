---
id: artifacts
sidebar_position: 2
title: Artifact Details
---

This page distills the normative artifacts from `acm-spec v0.5` and provides ready-to-use templates.

## Goal Card

- **Required fields:** `intent.summary`, `actors[]`, `constraints`, `acceptance`, `policy_context`, `context_required`.
- **Template:** `packages/acm-examples/data/goals/*.yaml`.
- **Best practice:** bind `contextRef` during planning so replay bundles link intent to context.

## Capability Map

- Maintained as machine-readable JSON Schema documents.
- Include invariants, allowed tools, and version tags.
- Generate from code via `pnpm acm-sdk generate:capabilities`.

## Context Packet

- Enforce lifecycle: ingest → snapshot → augment → version.
- Store digests for raw sources and derived augmentations.
- Reference builder provenance (tool names, LLM providers, temperature).

## Plan Set

- Capture multiple plans with rationale.
- Define guard expressions referencing ledger facts or prior task outputs.
- Persist planner telemetry (prompt digests, nucleus metadata) alongside plan graphs.

## Task Spec

- Record idempotency strategy, retry policy, and compensation plan.
- Declare policy and verification hooks with bundle digests.
- Ensure tool contracts include schema references and rate limits.

## Tool Catalog

- Tools reference OpenAPI or JSON Schema definitions.
- Tag with service ownership, deployment region, and maturity state (beta/ga).
- Align with MCP manifests when exposing via Model Context Protocol.

## Validation pipeline

1. Generate or update artifacts in code.
2. Run `pnpm acm-spec lint` to validate against JSON/YAML schemas.
3. Commit artifacts with version bump notes in `RELEASE_NOTES_v0.5.0.md`.
4. Publish artifacts to registry/storage for planners and runtimes.
