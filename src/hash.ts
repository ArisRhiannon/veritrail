import { createHash } from "node:crypto";

/** Domain-separation prefixes per RFC 6962 §2.1. */
export const LEAF_PREFIX = 0x00;
export const NODE_PREFIX = 0x01;

/** SHA-256 over the concatenation of chunks. */
export function sha256(...chunks: Uint8Array[]): Uint8Array {
  const h = createHash("sha256");
  for (const c of chunks) h.update(c);
  return new Uint8Array(h.digest());
}

/** Leaf hash: SHA-256(0x00 || entry). */
export function leafHash(entry: Uint8Array): Uint8Array {
  return sha256(Uint8Array.of(LEAF_PREFIX), entry);
}

/** Interior node hash: SHA-256(0x01 || left || right). */
export function nodeHash(left: Uint8Array, right: Uint8Array): Uint8Array {
  return sha256(Uint8Array.of(NODE_PREFIX), left, right);
}

/** Root of the empty tree: SHA-256(""). */
export function emptyRoot(): Uint8Array {
  return sha256(new Uint8Array(0));
}

/** Constant-time-ish equality for hashes (no early exit). */
export function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= (a[i] as number) ^ (b[i] as number);
  return d === 0;
}

export function toHex(b: Uint8Array): string {
  return Buffer.from(b).toString("hex");
}

export function fromHex(s: string): Uint8Array {
  if (s.length % 2 !== 0 || /[^0-9a-fA-F]/.test(s)) throw new Error("invalid hex");
  return new Uint8Array(Buffer.from(s, "hex"));
}

export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
