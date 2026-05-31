import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Log, MemoryStore, FileStore, equal, utf8, toHex,
  verifyInclusion, leafHash,
  generateKeyPair, signCheckpoint, verifyCheckpoint, encodeCheckpoint,
} from "../src/index";

const tmp = mkdtempSync(join(tmpdir(), "veritrail-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("AC2.1 append semantics", () => {
  test("size increments, root changes, order matters", () => {
    const log = new Log();
    expect(log.size).toBe(0);
    const r0 = log.root();
    log.append(utf8("a"));
    expect(log.size).toBe(1);
    const r1 = log.root();
    expect(equal(r0, r1)).toBe(false);
    log.append(utf8("b"));
    const ab = log.root();
    const other = new Log();
    other.append(utf8("b"));
    other.append(utf8("a"));
    expect(equal(ab, other.root())).toBe(false); // order-sensitive
  });
});

describe("AC2.2 proof integration", () => {
  test("every appended entry has a verifying inclusion proof", () => {
    const log = new Log();
    for (let i = 0; i < 40; i++) log.append(utf8(`x${i}`));
    const n = log.size, root = log.root();
    for (let i = 0; i < n; i++) {
      expect(verifyInclusion(log.inclusionProof(i), i, n, log.leaf(i), root)).toBe(true);
    }
  });
});

describe("AC2.3/AC2.4 signed checkpoints", () => {
  test("deterministic encoding", () => {
    const c = { size: 3, rootHash: leafHash(utf8("r")), timestamp: 1717171717 };
    expect(toHex(encodeCheckpoint(c))).toBe(toHex(encodeCheckpoint({ ...c })));
  });
  test("signature verifies; tampering size/root/signature fails", () => {
    const { publicKey, privateKey } = generateKeyPair();
    const log = new Log();
    for (let i = 0; i < 5; i++) log.append(utf8(`e${i}`));
    const { checkpoint, signature } = log.signedCheckpoint(privateKey, 1700000000);
    expect(verifyCheckpoint(checkpoint, signature, publicKey)).toBe(true);
    expect(verifyCheckpoint({ ...checkpoint, size: 6 }, signature, publicKey)).toBe(false);
    const badRoot = Uint8Array.from(checkpoint.rootHash); badRoot[0]! ^= 1;
    expect(verifyCheckpoint({ ...checkpoint, rootHash: badRoot }, signature, publicKey)).toBe(false);
    const badSig = Uint8Array.from(signature); badSig[0]! ^= 1;
    expect(verifyCheckpoint(checkpoint, badSig, publicKey)).toBe(false);
    // signature from a different checkpoint must not verify
    const other = signCheckpoint({ ...checkpoint, timestamp: 1700000001 }, privateKey);
    expect(verifyCheckpoint(checkpoint, other, publicKey)).toBe(false);
  });
});

describe("AC2.5/AC2.6 store equivalence & persistence", () => {
  test("MemoryStore and FileStore yield identical roots", () => {
    const seq = Array.from({ length: 30 }, (_, i) => utf8(`item-${i}`));
    const mem = new Log(new MemoryStore());
    const file = new Log(new FileStore(join(tmp, "a.json")));
    for (const e of seq) { mem.append(e); file.append(e); }
    expect(equal(mem.root(), file.root())).toBe(true);
  });
  test("reloading a FileStore reproduces the same root", () => {
    const path = join(tmp, "b.json");
    const a = new Log(new FileStore(path));
    for (let i = 0; i < 17; i++) a.append(utf8(`p${i}`));
    const root = a.root();
    const reloaded = new Log(new FileStore(path)); // reads from disk
    expect(reloaded.size).toBe(17);
    expect(equal(reloaded.root(), root)).toBe(true);
  });
});
