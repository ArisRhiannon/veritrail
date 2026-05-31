import { emptyRoot, leafHash, nodeHash, equal } from "./hash";

/** Largest power of two strictly less than n (n >= 2). Uses multiplication to
 *  stay correct beyond 2^31 (a signed `<<` would overflow). */
function splitPoint(n: number): number {
  let k = 1;
  while (k * 2 < n) k *= 2;
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
 * Tree sizes up to Number.MAX_SAFE_INTEGER (2^53 − 1) are supported.
 */
export function verifyInclusion(
  path: Uint8Array[],
  index: number,
  treeSize: number,
  leaf: Uint8Array,
  root: Uint8Array,
): boolean {
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(treeSize) || index < 0 || index >= treeSize) return false;
  let fn = index;
  let sn = treeSize - 1;
  let r = leaf;
  for (const p of path) {
    if (sn === 0) return false;
    if (fn % 2 === 1 || fn === sn) {
      r = nodeHash(p, r);
      if (fn % 2 === 0) {
        do {
          fn = Math.floor(fn / 2);
          sn = Math.floor(sn / 2);
        } while (fn % 2 === 0 && fn !== 0);
      }
    } else {
      r = nodeHash(r, p);
    }
    fn = Math.floor(fn / 2);
    sn = Math.floor(sn / 2);
  }
  return sn === 0 && equal(r, root);
}

function isPowerOfTwo(x: number): boolean {
  if (x <= 0) return false;
  const b = BigInt(x);
  return (b & (b - 1n)) === 0n;
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
 * Sizes up to Number.MAX_SAFE_INTEGER (2^53 − 1) are supported.
 */
export function verifyConsistency(
  path: Uint8Array[],
  first: number,
  second: number,
  firstRoot: Uint8Array,
  secondRoot: Uint8Array,
): boolean {
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(second) || first < 0 || first > second) return false;
  if (first === 0) return path.length === 0;
  if (first === second) return path.length === 0 && equal(firstRoot, secondRoot);

  const work = isPowerOfTwo(first) ? [firstRoot, ...path] : path;
  if (work.length === 0) return false;

  let fn = first - 1;
  let sn = second - 1;
  while (fn % 2 === 1) {
    fn = Math.floor(fn / 2);
    sn = Math.floor(sn / 2);
  }
  let fr = work[0] as Uint8Array;
  let sr = work[0] as Uint8Array;
  for (let i = 1; i < work.length; i++) {
    const c = work[i] as Uint8Array;
    if (sn === 0) return false;
    if (fn % 2 === 1 || fn === sn) {
      fr = nodeHash(c, fr);
      sr = nodeHash(c, sr);
      if (fn % 2 === 0) {
        do {
          fn = Math.floor(fn / 2);
          sn = Math.floor(sn / 2);
        } while (fn % 2 === 0 && fn !== 0);
      }
    } else {
      sr = nodeHash(sr, c);
    }
    fn = Math.floor(fn / 2);
    sn = Math.floor(sn / 2);
  }
  return sn === 0 && equal(fr, firstRoot) && equal(sr, secondRoot);
}
