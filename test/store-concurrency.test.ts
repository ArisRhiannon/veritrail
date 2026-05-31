import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, rmSync, existsSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Log, FileStore, utf8 } from "../src/index";

const tmp = mkdtempSync(join(tmpdir(), "veritrail-conc-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("FileStore concurrency", () => {
  test("N concurrent cross-process appends all land (no lost updates)", async () => {
    const store = join(tmp, "conc.json");
    const N = 16;
    const codes = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        Bun.spawn(["bun", "src/cli.ts", "append", store, `entry-${i}`], {
          cwd: process.cwd(), stdout: "ignore", stderr: "ignore",
        }).exited,
      ),
    );
    expect(codes.every((c) => c === 0)).toBe(true);
    expect(new Log(new FileStore(store)).size).toBe(N); // every append survived
    expect(existsSync(`${store}.lock`)).toBe(false); // lock released
  });

  test("a stale lock left by a crashed writer is reclaimed", () => {
    const store = join(tmp, "stale.json");
    const a = new FileStore(store);
    a.append(utf8("first"));
    const lock = `${store}.lock`;
    writeFileSync(lock, ""); // simulate a crashed writer's leftover lock
    const old = Date.now() / 1000 - 60; // back-date beyond the stale window
    utimesSync(lock, old, old);
    expect(() => new FileStore(store).append(utf8("second"))).not.toThrow();
    expect(new Log(new FileStore(store)).size).toBe(2);
    expect(existsSync(lock)).toBe(false);
  });
});
