import { readFileSync, existsSync, openSync, writeSync, fsyncSync, closeSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { toHex, fromHex } from "./hash";

/** Append-only entry storage. Implementations must preserve insertion order. */
export interface Store {
  size(): number;
  get(index: number): Uint8Array;
  append(entry: Uint8Array): number;
  all(): Uint8Array[];
}

function copy(e: Uint8Array): Uint8Array {
  return Uint8Array.from(e);
}

export class MemoryStore implements Store {
  private entries: Uint8Array[];
  constructor(initial?: Uint8Array[]) {
    this.entries = initial ? initial.map(copy) : [];
  }
  size(): number {
    return this.entries.length;
  }
  get(index: number): Uint8Array {
    const e = this.entries[index];
    if (!e) throw new RangeError(`index ${index} out of range for size ${this.entries.length}`);
    return copy(e);
  }
  append(entry: Uint8Array): number {
    this.entries.push(copy(entry));
    return this.entries.length;
  }
  all(): Uint8Array[] {
    return this.entries.map(copy);
  }
}

/** File-backed store. Persists entries as a JSON array of hex strings.
 *  Note: each append rewrites the whole file (O(n)); fine at library scale. */
export class FileStore implements Store {
  private entries: Uint8Array[] = [];
  constructor(private readonly path: string) {
    if (existsSync(path)) {
      const arr = JSON.parse(readFileSync(path, "utf8")) as unknown;
      if (!Array.isArray(arr)) throw new Error(`corrupt store: ${path}`);
      this.entries = arr.map((h) => fromHex(String(h)));
    }
  }
  /** Atomic + durable: write a temp file, fsync it, then rename over the target.
   *  A crash mid-write can never leave a partially written or truncated store.
   *  The directory is then fsync'd so the rename itself survives power loss
   *  (best-effort: silently skipped on platforms without directory fsync). */
  private persist(): void {
    const tmp = `${this.path}.tmp`;
    const data = Buffer.from(JSON.stringify(this.entries.map(toHex)));
    const fd = openSync(tmp, "w");
    try {
      writeSync(fd, data);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, this.path);
    try {
      const dir = openSync(dirname(this.path) || ".", "r");
      try {
        fsyncSync(dir);
      } finally {
        closeSync(dir);
      }
    } catch {
      // directory fsync is unsupported on some platforms (e.g. Windows); the
      // temp+fsync+rename above already guarantees the store is never corrupt.
    }
  }
  size(): number {
    return this.entries.length;
  }
  get(index: number): Uint8Array {
    const e = this.entries[index];
    if (!e) throw new RangeError(`index ${index} out of range for size ${this.entries.length}`);
    return copy(e);
  }
  append(entry: Uint8Array): number {
    this.entries.push(copy(entry));
    this.persist();
    return this.entries.length;
  }
  all(): Uint8Array[] {
    return this.entries.map(copy);
  }
}
