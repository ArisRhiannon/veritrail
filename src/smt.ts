import { sha256, leafHash, nodeHash, equal, utf8 } from "./hash.js";

/**
 * Sparse Merkle Tree over a 256-bit key space (depth 256).
 * - Empty subtree at level L is a precomputed default: D[256] = 32 zero bytes,
 *   D[L] = nodeHash(D[L+1], D[L+1]).
 * - An occupied leaf is `leafHash(value)` (domain-separated, never all-zero).
 * - Supports inclusion AND non-inclusion proofs (a non-inclusion proof shows the
 *   leaf at the key's path is the empty default).
 */
const KEY_BYTES = 32;
const DEPTH = 256;
const ZERO = new Uint8Array(KEY_BYTES);

const DEFAULTS: Uint8Array[] = (() => {
  const d: Uint8Array[] = new Array(DEPTH + 1);
  d[DEPTH] = ZERO;
  for (let L = DEPTH - 1; L >= 0; L--) d[L] = nodeHash(d[L + 1] as Uint8Array, d[L + 1] as Uint8Array);
  return d;
})();

/** Root of the empty map (= DEFAULTS[0]). */
export function smtEmptyRoot(): Uint8Array {
  return DEFAULTS[0] as Uint8Array;
}

/** Derive a 32-byte key from an arbitrary string. */
export function smtKey(s: string): Uint8Array {
  return sha256(utf8(s));
}

function bit(key: Uint8Array, index: number): number {
  return ((key[index >> 3] as number) >> (7 - (index & 7))) & 1;
}

interface Item {
  key: Uint8Array;
  leaf: Uint8Array;
}

function computeRoot(level: number, items: Item[]): Uint8Array {
  if (items.length === 0) return DEFAULTS[level] as Uint8Array;
  if (level === DEPTH) return (items[0] as Item).leaf;
  const left: Item[] = [];
  const right: Item[] = [];
  for (const it of items) (bit(it.key, level) === 0 ? left : right).push(it);
  return nodeHash(computeRoot(level + 1, left), computeRoot(level + 1, right));
}

function proofPath(level: number, items: Item[], key: Uint8Array): Uint8Array[] {
  if (level === DEPTH) return [];
  const left: Item[] = [];
  const right: Item[] = [];
  for (const it of items) (bit(it.key, level) === 0 ? left : right).push(it);
  if (bit(key, level) === 0) return [computeRoot(level + 1, right), ...proofPath(level + 1, left, key)];
  return [computeRoot(level + 1, left), ...proofPath(level + 1, right, key)];
}

/** Reconstruct the root from a leaf + 256 sibling hashes (top→bottom order). */
function reconstruct(key: Uint8Array, leaf: Uint8Array, proof: Uint8Array[]): Uint8Array | null {
  if (proof.length !== DEPTH) return null;
  let cur = leaf;
  for (let L = DEPTH - 1; L >= 0; L--) {
    const sib = proof[L] as Uint8Array;
    cur = bit(key, L) === 0 ? nodeHash(cur, sib) : nodeHash(sib, cur);
  }
  return cur;
}

export class SparseMerkleTree {
  private items = new Map<string, Item>();

  private static hex(k: Uint8Array): string {
    return Buffer.from(k).toString("hex");
  }
  private static checkKey(key: Uint8Array): void {
    if (key.length !== KEY_BYTES) throw new RangeError(`key must be ${KEY_BYTES} bytes`);
  }

  get size(): number {
    return this.items.size;
  }
  set(key: Uint8Array, value: Uint8Array): void {
    SparseMerkleTree.checkKey(key);
    this.items.set(SparseMerkleTree.hex(key), { key: Uint8Array.from(key), leaf: leafHash(value) });
  }
  delete(key: Uint8Array): void {
    this.items.delete(SparseMerkleTree.hex(key));
  }
  has(key: Uint8Array): boolean {
    return this.items.has(SparseMerkleTree.hex(key));
  }
  root(): Uint8Array {
    return computeRoot(0, [...this.items.values()]);
  }
  proof(key: Uint8Array): Uint8Array[] {
    SparseMerkleTree.checkKey(key);
    return proofPath(0, [...this.items.values()], key);
  }
}

/** Verify that `key` maps to `value` under `root`. */
export function verifyMapInclusion(key: Uint8Array, value: Uint8Array, proof: Uint8Array[], root: Uint8Array): boolean {
  if (key.length !== KEY_BYTES) return false;
  const r = reconstruct(key, leafHash(value), proof);
  return r !== null && equal(r, root);
}

/** Verify that `key` is absent under `root` (its leaf is the empty default). */
export function verifyMapNonInclusion(key: Uint8Array, proof: Uint8Array[], root: Uint8Array): boolean {
  if (key.length !== KEY_BYTES) return false;
  const r = reconstruct(key, ZERO, proof);
  return r !== null && equal(r, root);
}
