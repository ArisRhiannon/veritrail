import { readFileSync, existsSync, openSync, writeSync, fsyncSync, closeSync, renameSync, unlinkSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { toHex, fromHex } from "./hash.js";

const LOCK_STALE_MS = 10_000;
const LOCK_TIMEOUT_MS = 10_000;
const LOCK_POLL_MS = 10;

/** Synchronous sleep with no busy-spin (zero-dependency). */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

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
 *  Note: each append rewrites the whole file (O(n)); fine at library scale.
 *  Concurrency: appends across processes are serialized with an exclusive
 *  lock file, so concurrent writers cannot lose or corrupt entries. */
export class FileStore implements Store {
  private entries: Uint8Array[] = [];
  constructor(private readonly path: string) {
    this.load();
  }
  /** (Re)read entries from disk; throws on a corrupt store (fail-closed). */
  private load(): void {
    if (!existsSync(this.path)) {
      this.entries = [];
      return;
    }
    const arr = JSON.parse(readFileSync(this.path, "utf8")) as unknown;
    if (!Array.isArray(arr)) throw new Error(`corrupt store: ${this.path}`);
    this.entries = arr.map((h) => fromHex(String(h)));
  }
  /** Run `fn` while holding an exclusive lock file (O_CREAT|O_EXCL), with a
   *  bounded wait and stale-lock recovery so a crashed writer can't deadlock. */
  private withLock<T>(fn: () => T): T {
    const lock = `${this.path}.lock`;
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    for (;;) {
      try {
        closeSync(openSync(lock, "wx"));
        break;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        try {
          if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) {
            unlinkSync(lock); // steal a stale lock left by a crashed writer
            continue;
          }
        } catch {
          continue; // lock vanished between stat and use; retry immediately
        }
        if (Date.now() > deadline) throw new Error(`timeout acquiring lock: ${lock}`);
        sleepSync(LOCK_POLL_MS);
      }
    }
    try {
      return fn();
    } finally {
      try {
        unlinkSync(lock);
      } catch {
        /* already removed */
      }
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
    return this.withLock(() => {
      this.load(); // pick up entries appended by other processes since we loaded
      this.entries.push(copy(entry));
      this.persist();
      return this.entries.length;
    });
  }
  all(): Uint8Array[] {
    return this.entries.map(copy);
  }
}
