import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Log, FileStore, equal, utf8 } from "../src/index";

const tmp = mkdtempSync(join(tmpdir(), "veritrail-store-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("FileStore durability", () => {
  test("append leaves no temp file and the store is valid JSON", () => {
    const path = join(tmp, "a.json");
    const log = new Log(new FileStore(path));
    for (let i = 0; i < 5; i++) log.append(utf8(`e${i}`));
    expect(existsSync(`${path}.tmp`)).toBe(false);
    const parsed = JSON.parse(readFileSync(path, "utf8")) as string[];
    expect(parsed.length).toBe(5);
  });

  test("reload reproduces the same root", () => {
    const path = join(tmp, "b.json");
    const a = new Log(new FileStore(path));
    for (let i = 0; i < 9; i++) a.append(utf8(`x${i}`));
    const root = a.root();
    const b = new Log(new FileStore(path));
    expect(b.size).toBe(9);
    expect(equal(b.root(), root)).toBe(true);
  });

  test("a stale .tmp from a previous crash does not corrupt a fresh append", () => {
    const path = join(tmp, "c.json");
    writeFileSync(`${path}.tmp`, "garbage-from-an-interrupted-write");
    const log = new Log(new FileStore(path));
    log.append(utf8("ok"));
    expect(log.size).toBe(1);
    expect(equal(new Log(new FileStore(path)).root(), log.root())).toBe(true);
  });

  test("constructing over a corrupt store throws (fail-closed)", () => {
    const notJson = join(tmp, "d.json");
    writeFileSync(notJson, "{not json");
    expect(() => new FileStore(notJson)).toThrow();

    const notArray = join(tmp, "e.json");
    writeFileSync(notArray, JSON.stringify({ size: 1 }));
    expect(() => new FileStore(notArray)).toThrow();

    const badHex = join(tmp, "f.json");
    writeFileSync(badHex, JSON.stringify(["zz"]));
    expect(() => new FileStore(badHex)).toThrow();
  });
});
