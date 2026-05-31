import { generateKeyPairSync, sign, verify, createPublicKey, createPrivateKey, type KeyObject } from "node:crypto";
import { toHex, utf8 } from "./hash.js";

/** A signed-tree-head: a commitment to the log state at a point in time. */
export interface Checkpoint {
  size: number;
  rootHash: Uint8Array;
  timestamp: number;
}

/** Deterministic, unambiguous byte encoding used as the signing payload. */
export function encodeCheckpoint(c: Checkpoint): Uint8Array {
  return utf8(`veritrail-checkpoint\n${c.size}\n${toHex(c.rootHash)}\n${c.timestamp}\n`);
}

export function generateKeyPair(): { publicKey: KeyObject; privateKey: KeyObject } {
  return generateKeyPairSync("ed25519");
}

export function signCheckpoint(c: Checkpoint, privateKey: KeyObject): Uint8Array {
  return new Uint8Array(sign(null, encodeCheckpoint(c), privateKey));
}

export function verifyCheckpoint(c: Checkpoint, signature: Uint8Array, publicKey: KeyObject): boolean {
  return verify(null, encodeCheckpoint(c), publicKey, signature);
}

export function exportPublicKeyPem(key: KeyObject): string {
  return key.export({ type: "spki", format: "pem" }).toString();
}

export function exportPrivateKeyPem(key: KeyObject): string {
  return key.export({ type: "pkcs8", format: "pem" }).toString();
}

export function importPublicKeyPem(pem: string): KeyObject {
  return createPublicKey(pem);
}

export function importPrivateKeyPem(pem: string): KeyObject {
  return createPrivateKey(pem);
}
