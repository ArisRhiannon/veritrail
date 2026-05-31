import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "veritrail-cli-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const dec = new TextDecoder();

function run(...a: string[]): { code: number; out: string } {
  const p = Bun.spawnSync(["bun", "src/cli.ts", ...a], { cwd: process.cwd() });
  return { code: p.exitCode ?? -1, out: dec.decode(p.stdout) + dec.decode(p.stderr) };
}

const store = join(tmp, "log.json");
const priv = join(tmp, "priv.pem");
const pub = join(tmp, "pub.pem");

describe("CLI end-to-end (AC4.x)", () => {
  test("AC4.1 append prints growing size + root", () => {
    expect(run("keygen", priv, pub).code).toBe(0);
    expect(run("append", store, "alpha").code).toBe(0);
    expect(run("append", store, "beta").code).toBe(0);
    const r = run("append", store, "gamma");
    expect(r.code).toBe(0);
    expect(r.out).toContain("size=3");
  });

  test("AC4.2 root prints size + 64-hex root", () => {
    const r = run("root", store);
    expect(r.out).toContain("size=3");
    expect(r.out).toMatch(/root=[0-9a-f]{64}/);
  });

  test("AC4.3/AC4.6 inclusion proof round-trips and tamper fails", () => {
    const b = run("prove", store, "1");
    expect(b.code).toBe(0);
    const bf = join(tmp, "incl.json");
    writeFileSync(bf, b.out.trim());
    const v = run("verify", bf);
    expect(v.code).toBe(0);
    expect(v.out).toContain("OK");
    const o = JSON.parse(readFileSync(bf, "utf8")) as { root: string };
    o.root = (o.root[0] === "0" ? "1" : "0") + o.root.slice(1);
    writeFileSync(bf, JSON.stringify(o));
    const v2 = run("verify", bf);
    expect(v2.code).toBe(1);
    expect(v2.out).toContain("FAIL");
  });

  test("AC4.4 consistency proof verifies; bad range fails", () => {
    const b = run("consistency", store, "2", "3");
    expect(b.code).toBe(0);
    const bf = join(tmp, "cons.json");
    writeFileSync(bf, b.out.trim());
    expect(run("verify", bf).code).toBe(0);
    expect(run("consistency", store, "3", "2").code).not.toBe(0);
  });

  test("AC4.5 sign + audit; store tamper is detected", () => {
    const s = run("sign", store, priv);
    expect(s.code).toBe(0);
    const sf = join(tmp, "signed.json");
    writeFileSync(sf, s.out.trim());
    expect(run("audit", store, sf, pub).code).toBe(0);
    // tamper an entry in the store and re-audit against the signed checkpoint
    const arr = JSON.parse(readFileSync(store, "utf8")) as string[];
    const e = arr[1] as string;
    arr[1] = (e[0] === "0" ? "1" : "0") + e.slice(1);
    writeFileSync(store, JSON.stringify(arr));
    expect(run("audit", store, sf, pub).code).not.toBe(0);
  });
});
