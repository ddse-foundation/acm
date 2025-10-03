// Memory ledger implementation
import type { LedgerEntry } from '@acm/sdk';

export class MemoryLedger {
  private entries: LedgerEntry[] = [];
  private nextId = 1;

  append(type: LedgerEntry['type'], details: Record<string, any>): LedgerEntry {
    const entry: LedgerEntry = {
      id: `ledger-${this.nextId++}`,
      ts: Date.now(),
      type,
      details,
    };
    this.entries.push(entry);
    return entry;
  }

  getEntries(): readonly LedgerEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }
}
