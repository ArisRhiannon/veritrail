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

function hexArray(a: unknown): Uint8Array[] {
  if (!Array.isArray(a)) throw new Error("expected array");
  return a.map((x) => fromHex(String(x)));
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
export function verifyBundleJSON(json: string): boolean {
  const o = JSON.parse(json) as Record<string, unknown>;
  if (o.type === "inclusion") {
    return verifyInclusion(hexArray(o.path), Number(o.index), Number(o.treeSize), fromHex(String(o.leaf)), fromHex(String(o.root)));
  }
  if (o.type === "consistency") {
    return verifyConsistency(hexArray(o.path), Number(o.first), Number(o.second), fromHex(String(o.firstRoot)), fromHex(String(o.secondRoot)));
  }
  throw new Error(`unknown bundle type: ${String(o.type)}`);
}

export function checkpointToJSON(c: Checkpoint): string {
  return JSON.stringify({ size: c.size, rootHash: toHex(c.rootHash), timestamp: c.timestamp });
}
export function checkpointFromJSON(s: string): Checkpoint {
  const o = JSON.parse(s) as Record<string, unknown>;
  return { size: Number(o.size), rootHash: fromHex(String(o.rootHash)), timestamp: Number(o.timestamp) };
}

export function signedCheckpointToJSON(sc: { checkpoint: Checkpoint; signature: Uint8Array }): string {
  return JSON.stringify({
    checkpoint: { size: sc.checkpoint.size, rootHash: toHex(sc.checkpoint.rootHash), timestamp: sc.checkpoint.timestamp },
    signature: toHex(sc.signature),
  });
}
export function signedCheckpointFromJSON(s: string): { checkpoint: Checkpoint; signature: Uint8Array } {
  const o = JSON.parse(s) as { checkpoint: Record<string, unknown>; signature: unknown };
  return {
    checkpoint: { size: Number(o.checkpoint.size), rootHash: fromHex(String(o.checkpoint.rootHash)), timestamp: Number(o.checkpoint.timestamp) },
    signature: fromHex(String(o.signature)),
  };
}
