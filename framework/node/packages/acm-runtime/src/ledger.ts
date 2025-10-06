// Memory ledger implementation
import type { LedgerEntry } from '@ddse/acm-sdk';
import { createHash } from 'crypto';

export class MemoryLedger {
  private entries: LedgerEntry[] = [];
  private nextId = 1;

  append(type: LedgerEntry['type'], details: Record<string, any>, computeDigest = true): LedgerEntry {
    const entry: LedgerEntry = {
      id: `ledger-${this.nextId++}`,
      ts: Date.now(),
      type,
      details,
    };

    // Compute digest for tamper detection if requested
    if (computeDigest) {
      entry.digest = this.computeDigest(entry);
    }

    this.entries.push(entry);
    return entry;
  }

  getEntries(): readonly LedgerEntry[] {
    return [...this.entries];
  }

  getEntriesByType(type: LedgerEntry['type']): readonly LedgerEntry[] {
    return this.entries.filter(e => e.type === type);
  }

  clear(): void {
    this.entries = [];
  }

  // Validate ledger integrity
  validate(): boolean {
    for (const entry of this.entries) {
      if (entry.digest) {
        const computed = this.computeDigest(entry);
        if (computed !== entry.digest) {
          console.error(`Ledger entry ${entry.id} failed integrity check`);
          return false;
        }
      }
    }
    return true;
  }

  private computeDigest(entry: LedgerEntry): string {
    const normalized = JSON.stringify({
      id: entry.id,
      ts: entry.ts,
      type: entry.type,
      details: entry.details,
    });
    const hash = createHash('sha256');
    hash.update(normalized);
    return hash.digest('hex').substring(0, 32);
  }
}
