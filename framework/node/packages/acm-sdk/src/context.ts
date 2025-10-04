// Context orchestration utilities

import { createHash } from 'crypto';
import type { ContextPacket, InternalContextScope, LedgerEntry } from './types.js';

export class ContextBuilder {
  private sources: ContextPacket['sources'] = [];
  private facts: Record<string, any> = {};
  private assumptions: string[] = [];
  private augmentations: ContextPacket['augmentations'] = [];
  private provenance: ContextPacket['provenance'] = {};

  addSource(uri: string, type?: string, content?: any): this {
    const digest = this.computeDigest(content ? JSON.stringify(content) : uri);
    this.sources!.push({ uri, digest, type });
    return this;
  }

  addFact(key: string, value: any): this {
    this.facts[key] = value;
    return this;
  }

  addFacts(facts: Record<string, any>): this {
    Object.assign(this.facts, facts);
    return this;
  }

  addAssumption(assumption: string): this {
    this.assumptions.push(assumption);
    return this;
  }

  addAugmentation(type: string, artifact: string): this {
    this.augmentations!.push({ type, artifact });
    return this;
  }

  setProvenance(provenance: ContextPacket['provenance']): this {
    this.provenance = provenance;
    return this;
  }

  build(version?: string): ContextPacket {
    const packet: ContextPacket = {
      id: this.computePacketId(),
      version,
      sources: this.sources,
      facts: this.facts,
      assumptions: this.assumptions.length > 0 ? this.assumptions : undefined,
      augmentations: this.augmentations,
      provenance: this.provenance,
    };

    return packet;
  }

  private computePacketId(): string {
    // Compute SHA-256 hash of the normalized packet
    const normalized = JSON.stringify({
      sources: this.sources,
      facts: this.facts,
      assumptions: this.assumptions,
      augmentations: this.augmentations,
    });
    const hash = createHash('sha256');
    hash.update(normalized);
    return `sha256-${hash.digest('hex')}`;
  }

  private computeDigest(content: string): string {
    const hash = createHash('sha256');
    hash.update(content);
    return `sha256-${hash.digest('hex').substring(0, 32)}`;
  }

  static computeContextRef(context: ContextPacket): string {
    // Compute full SHA-256 hash of the normalized context packet
    const normalized = JSON.stringify({
      sources: context.sources,
      facts: context.facts,
      assumptions: context.assumptions,
      augmentations: context.augmentations,
    });
    const hash = createHash('sha256');
    hash.update(normalized);
    return hash.digest('hex');
  }
}

export class InternalContextScopeImpl implements InternalContextScope {
  artifacts: Array<{
    id: string;
    type: string;
    content: any;
    digest: string;
    provenance?: {
      retrievedAt: number;
      tool?: string;
      rationale?: string;
    };
  }> = [];

  private ledgerAppend?: (entry: LedgerEntry) => void;
  private contextBuilder?: ContextBuilder;

  constructor(ledgerAppend?: (entry: LedgerEntry) => void) {
    this.ledgerAppend = ledgerAppend;
  }

  addArtifact(
    type: string,
    content: any,
    provenance?: {
      tool?: string;
      rationale?: string;
    }
  ): string {
    const id = `artifact-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const digest = this.computeDigest(JSON.stringify(content));

    this.artifacts.push({
      id,
      type,
      content,
      digest,
      provenance: provenance
        ? {
            retrievedAt: Date.now(),
            ...provenance,
          }
        : undefined,
    });

    // Record to ledger
    if (this.ledgerAppend) {
      this.ledgerAppend({
        id: `context-internal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        ts: Date.now(),
        type: 'CONTEXT_INTERNALIZED',
        details: {
          artifactId: id,
          type,
          digest,
          provenance,
        },
      });
    }

    return id;
  }

  async promote(artifactId: string): Promise<void> {
    const artifact = this.artifacts.find(a => a.id === artifactId);
    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }

    // In a real implementation, this would create a new Context Packet version
    // and append to the context builder
    if (this.contextBuilder) {
      this.contextBuilder.addAugmentation(artifact.type, artifact.id);
    }

    // Log promotion
    if (this.ledgerAppend) {
      this.ledgerAppend({
        id: `context-promote-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        ts: Date.now(),
        type: 'CONTEXT_INTERNALIZED',
        details: {
          action: 'promote',
          artifactId,
          digest: artifact.digest,
        },
      });
    }
  }

  getArtifact(id: string): any {
    const artifact = this.artifacts.find(a => a.id === id);
    return artifact?.content;
  }

  private computeDigest(content: string): string {
    const hash = createHash('sha256');
    hash.update(content);
    return hash.digest('hex').substring(0, 32);
  }
}
