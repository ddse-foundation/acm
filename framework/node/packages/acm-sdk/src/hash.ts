/**
 * Universal digest function — works in both Node.js and browser environments.
 *
 * Uses Node's crypto.createHash when available (server-side), falls back to a
 * fast synchronous hash for browser contexts where `crypto` is externalized
 * by Vite.  These digests are used for ledger entries, dedup, and context
 * packet IDs — NOT for security — so a non-cryptographic hash is acceptable.
 */

let _nodeCrypto: typeof import('crypto') | undefined;
try {
  // Dynamic require avoids Vite's static-analysis externalization.
  // In Node.js this succeeds; in the browser it throws.
  _nodeCrypto = (globalThis as any).__acm_crypto ??
    (() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const c = typeof require === 'function'
        ? require('crypto')
        : undefined;
      (globalThis as any).__acm_crypto = c;
      return c;
    })();
} catch {
  _nodeCrypto = undefined;
}

/**
 * Synchronous hex digest of the input string.
 *
 * - Node.js: SHA-256 via `crypto.createHash` (same output as before).
 * - Browser: FNV-1a 128-bit (two 64-bit passes with different offsets)
 *   producing a 32-char hex string — sufficient for dedup/ledger IDs.
 */
export function universalDigest(input: string): string {
  if (_nodeCrypto) {
    const hash = _nodeCrypto.createHash('sha256');
    hash.update(input);
    return hash.digest('hex');
  }
  return fnv1aHex128(input);
}

// ─── FNV-1a browser fallback ────────────────────────────────────────────────

/*
 * FNV-1a operating on 32-bit chunks.  We run 4 independent lanes with
 * staggered offsets to produce a 128-bit (32-char hex) digest.  This is
 * NOT cryptographically secure but has excellent distribution for the
 * short-to-medium strings used in ledger digests and context packet IDs.
 */

const FNV_PRIME = 0x01000193;
const FNV_OFFSETS = [
  0x811c9dc5,  // standard FNV-1a 32-bit offset
  0xa2ca53c9,  // custom offset 2
  0x3b2c1f7d,  // custom offset 3
  0xf5e8d4b1,  // custom offset 4
];

function fnv1a32(input: string, offset: number): number {
  let h = offset >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h >>> 0;
}

function fnv1aHex128(input: string): string {
  let hex = '';
  for (const offset of FNV_OFFSETS) {
    hex += fnv1a32(input, offset).toString(16).padStart(8, '0');
  }
  return hex;
}
