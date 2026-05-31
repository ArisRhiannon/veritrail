import { leafHash } from "./hash.js";
import { merkleRoot, inclusionPath, consistencyProof } from "./merkle.js";
import { MemoryStore, type Store } from "./store.js";
import { type Checkpoint, signCheckpoint } from "./checkpoint.js";
import type { KeyObject } from "node:crypto";

/** An append-only, tamper-evident log over a pluggable Store. */
export class Log {
  constructor(private readonly store: Store = new MemoryStore()) {}

  get size(): number {
    return this.store.size();
  }
  append(entry: Uint8Array): number {
    return this.store.append(entry);
  }
  entries(): Uint8Array[] {
    return this.store.all();
  }
  entry(index: number): Uint8Array {
    return this.store.get(index);
  }
  /** Leaf hash of the entry at `index`. */
  leaf(index: number): Uint8Array {
    return leafHash(this.store.get(index));
  }
  /** Current Merkle tree head (root). */
  root(): Uint8Array {
    return merkleRoot(this.store.all());
  }
  inclusionProof(index: number): Uint8Array[] {
    return inclusionPath(index, this.store.all());
  }
  consistencyProof(first: number): Uint8Array[] {
    return consistencyProof(first, this.store.all());
  }
  checkpoint(timestamp: number = Date.now()): Checkpoint {
    return { size: this.size, rootHash: this.root(), timestamp };
  }
  signedCheckpoint(
    privateKey: KeyObject,
    timestamp: number = Date.now(),
  ): { checkpoint: Checkpoint; signature: Uint8Array } {
    const checkpoint = this.checkpoint(timestamp);
    return { checkpoint, signature: signCheckpoint(checkpoint, privateKey) };
  }
}
