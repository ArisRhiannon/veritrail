import { readFileSync, writeFileSync, existsSync } from "node:fs";
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

/** File-backed store. Persists entries as a JSON array of hex strings. */
export class FileStore implements Store {
  private entries: Uint8Array[] = [];
  constructor(private readonly path: string) {
    if (existsSync(path)) {
      const arr = JSON.parse(readFileSync(path, "utf8")) as unknown;
      if (!Array.isArray(arr)) throw new Error(`corrupt store: ${path}`);
      this.entries = arr.map((h) => fromHex(String(h)));
    }
  }
  private persist(): void {
    writeFileSync(this.path, JSON.stringify(this.entries.map(toHex)));
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
