import { toHex, fromHex } from "./hash";
import { verifyInclusion, verifyConsistency } from "./merkle";
import type { Checkpoint } from "./checkpoint";

export interface InclusionBundle {
  type: "inclusion";
  index: number;
  treeSize: number;
  leaf: Uint8Array;
  path: Uint8Array[];
  root: Uint8Array;
}
export interface ConsistencyBundle {
  type: "consistency";
  first: number;
  second: number;
  firstRoot: Uint8Array;
  secondRoot: Uint8Array;
  path: Uint8Array[];
}

function hexStr(x: unknown): Uint8Array {
  if (typeof x !== "string") throw new TypeError("expected hex string");
  return fromHex(x);
}

function hexArray(a: unknown): Uint8Array[] {
  if (!Array.isArray(a)) throw new Error("expected array");
  return a.map(hexStr);
}

export function inclusionToJSON(b: InclusionBundle): string {
  return JSON.stringify({
    type: "inclusion", index: b.index, treeSize: b.treeSize,
    leaf: toHex(b.leaf), path: b.path.map(toHex), root: toHex(b.root),
  });
}

export function consistencyToJSON(b: ConsistencyBundle): string {
  return JSON.stringify({
    type: "consistency", first: b.first, second: b.second,
    firstRoot: toHex(b.firstRoot), secondRoot: toHex(b.secondRoot), path: b.path.map(toHex),
  });
}

/** Parse a proof bundle and verify it self-consistently. Returns the verdict. */
function uint(x: unknown): number {
  const v = Number(x);
  return Number.isSafeInteger(v) && v >= 0 ? v : NaN;
}

/**
 * Verify a serialized proof bundle. This is the untrusted-input trust boundary:
 * it is TOTAL — any malformed input (bad JSON, missing/typed-wrong fields,
 * invalid hex, unknown type) yields `false` rather than throwing.
 */
export function verifyBundleJSON(json: string): boolean {
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return false;
  }
  try {
    if (o?.type === "inclusion") {
      const index = uint(o.index), treeSize = uint(o.treeSize);
      if (Number.isNaN(index) || Number.isNaN(treeSize)) return false;
      return verifyInclusion(hexArray(o.path), index, treeSize, hexStr(o.leaf), hexStr(o.root));
    }
    if (o?.type === "consistency") {
      const first = uint(o.first), second = uint(o.second);
      if (Number.isNaN(first) || Number.isNaN(second)) return false;
      return verifyConsistency(hexArray(o.path), first, second, hexStr(o.firstRoot), hexStr(o.secondRoot));
    }
    return false; // unknown or missing bundle type
  } catch {
    return false; // invalid hex, wrong field types, etc.
  }
}

function reqUint(x: unknown, field: string): number {
  const v = Number(x);
  if (!Number.isSafeInteger(v) || v < 0) throw new Error(`invalid checkpoint field: ${field}`);
  return v;
}
function reqFinite(x: unknown, field: string): number {
  const v = Number(x);
  if (!Number.isFinite(v)) throw new Error(`invalid checkpoint field: ${field}`);
  return v;
}

export function checkpointToJSON(c: Checkpoint): string {
  return JSON.stringify({ size: c.size, rootHash: toHex(c.rootHash), timestamp: c.timestamp });
}
export function checkpointFromJSON(s: string): Checkpoint {
  const o = JSON.parse(s) as Record<string, unknown>;
  return { size: reqUint(o.size, "size"), rootHash: hexStr(o.rootHash), timestamp: reqFinite(o.timestamp, "timestamp") };
}

export function signedCheckpointToJSON(sc: { checkpoint: Checkpoint; signature: Uint8Array }): string {
  return JSON.stringify({
    checkpoint: { size: sc.checkpoint.size, rootHash: toHex(sc.checkpoint.rootHash), timestamp: sc.checkpoint.timestamp },
    signature: toHex(sc.signature),
  });
}
export function signedCheckpointFromJSON(s: string): { checkpoint: Checkpoint; signature: Uint8Array } {
  const o = JSON.parse(s) as { checkpoint?: Record<string, unknown>; signature: unknown };
  const c = o.checkpoint;
  if (typeof c !== "object" || c === null) throw new Error("invalid signed checkpoint: missing checkpoint");
  return {
    checkpoint: { size: reqUint(c.size, "size"), rootHash: hexStr(c.rootHash), timestamp: reqFinite(c.timestamp, "timestamp") },
    signature: hexStr(o.signature),
  };
}
