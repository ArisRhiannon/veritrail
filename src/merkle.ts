import { emptyRoot, leafHash, nodeHash, equal } from "./hash";

/** Largest power of two strictly less than n (n >= 2). */
function splitPoint(n: number): number {
  let k = 1;
  while (k << 1 < n) k <<= 1;
  return k;
}

/**
 * Merkle Tree Hash (RFC 6962 §2.1). `entries` are raw leaf data (NOT pre-hashed).
 * MTH({}) = SHA256(""); MTH({d0}) = leafHash(d0);
 * MTH(D) = nodeHash(MTH(D[0:k]), MTH(D[k:n])), k = largest power of 2 < n.
 */
export function merkleRoot(entries: Uint8Array[]): Uint8Array {
  const n = entries.length;
  if (n === 0) return emptyRoot();
  if (n === 1) return leafHash(entries[0] as Uint8Array);
  const k = splitPoint(n);
  return nodeHash(merkleRoot(entries.slice(0, k)), merkleRoot(entries.slice(k)));
}

/** Inclusion (audit) path for leaf index m in a tree of entries (RFC 6962 §2.1.1). */
export function inclusionPath(m: number, entries: Uint8Array[]): Uint8Array[] {
  const n = entries.length;
  if (m < 0 || m >= n) throw new RangeError(`index ${m} out of range for size ${n}`);
  if (n === 1) return [];
  const k = splitPoint(n);
  if (m < k) return [...inclusionPath(m, entries.slice(0, k)), merkleRoot(entries.slice(k))];
  return [...inclusionPath(m - k, entries.slice(k)), merkleRoot(entries.slice(0, k))];
}

/**
 * Verify an inclusion proof (RFC 9162 §2.1.3.2). `leaf` is the leaf hash.
 * Reconstructs the root from `leaf` + `path` and compares to `root`.
 * Note: sizes are bounded to < 2^32 (uses 32-bit unsigned index arithmetic).
 */
export function verifyInclusion(
  path: Uint8Array[],
  index: number,
  treeSize: number,
  leaf: Uint8Array,
  root: Uint8Array,
): boolean {
  if (!Number.isInteger(index) || !Number.isInteger(treeSize) || index < 0 || treeSize < 0 || index >= treeSize) return false;
  let fn = index;
  let sn = treeSize - 1;
  let r = leaf;
  for (const p of path) {
    if (sn === 0) return false;
    if ((fn & 1) === 1 || fn === sn) {
      r = nodeHash(p, r);
      if ((fn & 1) === 0) {
        do {
          fn >>>= 1;
          sn >>>= 1;
        } while ((fn & 1) === 0 && fn !== 0);
      }
    } else {
      r = nodeHash(r, p);
    }
    fn >>>= 1;
    sn >>>= 1;
  }
  return sn === 0 && equal(r, root);
}

function isPowerOfTwo(x: number): boolean {
  return x > 0 && (x & (x - 1)) === 0;
}

/** SUBPROOF helper (RFC 6962 §2.1.2). */
function subproof(m: number, entries: Uint8Array[], b: boolean): Uint8Array[] {
  const n = entries.length;
  if (m === n) return b ? [] : [merkleRoot(entries)];
  const k = splitPoint(n);
  if (m <= k) return [...subproof(m, entries.slice(0, k), b), merkleRoot(entries.slice(k))];
  return [...subproof(m - k, entries.slice(k), false), merkleRoot(entries.slice(0, k))];
}

/** Consistency proof between first size m and full tree (RFC 6962 §2.1.2). 0 < m <= n. */
export function consistencyProof(m: number, entries: Uint8Array[]): Uint8Array[] {
  const n = entries.length;
  if (m <= 0 || m > n) throw new RangeError(`first size ${m} out of range for size ${n}`);
  if (m === n) return [];
  return subproof(m, entries, true);
}

/**
 * Verify a consistency proof (RFC 9162 §2.1.4.2).
 * Sizes are bounded to < 2^32 (uses 32-bit unsigned arithmetic).
 */
export function verifyConsistency(
  path: Uint8Array[],
  first: number,
  second: number,
  firstRoot: Uint8Array,
  secondRoot: Uint8Array,
): boolean {
  if (!Number.isInteger(first) || !Number.isInteger(second) || first < 0 || second < 0 || first > second) return false;
  if (first === 0) return path.length === 0;
  if (first === second) return path.length === 0 && equal(firstRoot, secondRoot);

  const work = isPowerOfTwo(first) ? [firstRoot, ...path] : path;
  if (work.length === 0) return false;

  let fn = first - 1;
  let sn = second - 1;
  while ((fn & 1) === 1) {
    fn >>>= 1;
    sn >>>= 1;
  }
  let fr = work[0] as Uint8Array;
  let sr = work[0] as Uint8Array;
  for (let i = 1; i < work.length; i++) {
    const c = work[i] as Uint8Array;
    if (sn === 0) return false;
    if ((fn & 1) === 1 || fn === sn) {
      fr = nodeHash(c, fr);
      sr = nodeHash(c, sr);
      if ((fn & 1) === 0) {
        do {
          fn >>>= 1;
          sn >>>= 1;
        } while ((fn & 1) === 0 && fn !== 0);
      }
    } else {
      sr = nodeHash(sr, c);
    }
    fn >>>= 1;
    sn >>>= 1;
  }
  return sn === 0 && equal(fr, firstRoot) && equal(sr, secondRoot);
}
