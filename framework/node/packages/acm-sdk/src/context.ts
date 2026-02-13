// Context orchestration utilities

import { universalDigest } from './hash.js';
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
    // Compute digest of the normalized packet
    const normalized = JSON.stringify({
      sources: this.sources,
      facts: this.facts,
      assumptions: this.assumptions,
      augmentations: this.augmentations,
    });
    return `sha256-${universalDigest(normalized)}`;
  }

  private computeDigest(content: string): string {
    return `sha256-${universalDigest(content).substring(0, 32)}`;
  }

  static computeContextRef(context: ContextPacket): string {
    // Compute digest of the normalized context packet
    const normalized = JSON.stringify({
      sources: context.sources,
      facts: context.facts,
      assumptions: context.assumptions,
      augmentations: context.augmentations,
    });
    return universalDigest(normalized);
  }
}

export class InternalContextScopeImpl implements InternalContextScope {
  artifacts: Array<{
    id: string;
    type: string;
    content: any;
    digest: string;
    sizeBytes?: number;
    provenance?: {
      retrievedAt: number;
      tool?: string;
      rationale?: string;
      [key: string]: any;
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
      [extra: string]: any;  // allow sourceId, path, artifactId, etc.
    }
  ): string {
    const id = `artifact-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const serialized = typeof content === 'string' ? content : JSON.stringify(content);
    const digest = this.computeDigest(serialized);
    const sizeBytes = new TextEncoder().encode(serialized).byteLength;

    this.artifacts.push({
      id,
      type,
      content,
      digest,
      sizeBytes,
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
    return universalDigest(content).substring(0, 32);
  }
}
