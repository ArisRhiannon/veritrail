import { test, expect, describe } from "bun:test";
import { verifyInclusion, verifyConsistency, leafHash, merkleRoot, utf8, verifyBundleJSON } from "../src/index";

describe("verifier boundary conditions (CRYPTO1/SEC1/TEST2)", () => {
  const es = [utf8("a"), utf8("b"), utf8("c")];
  const root = merkleRoot(es);

  test("inclusion rejects out-of-range / non-integer inputs", () => {
    expect(verifyInclusion([], -1, 3, leafHash(es[0]!), root)).toBe(false);
    expect(verifyInclusion([], 3, 3, leafHash(es[0]!), root)).toBe(false);
    expect(verifyInclusion([], 0, 0, leafHash(es[0]!), root)).toBe(false);
    expect(verifyInclusion([], Number.NaN, 3, leafHash(es[0]!), root)).toBe(false);
    expect(verifyInclusion([], 1.5, 3, leafHash(es[0]!), root)).toBe(false);
    expect(verifyInclusion([], Infinity, 3, leafHash(es[0]!), root)).toBe(false);
  });

  test("consistency rejects bad ranges / non-integer inputs", () => {
    expect(verifyConsistency([], 5, 3, root, root)).toBe(false);
    expect(verifyConsistency([], -1, 3, root, root)).toBe(false);
    expect(verifyConsistency([], 1.5, 3, root, root)).toBe(false);
    expect(verifyConsistency([], Number.NaN, 3, root, root)).toBe(false);
  });

  test("verifyBundleJSON rejects non-integer numeric fields", () => {
    expect(verifyBundleJSON(JSON.stringify({ type: "inclusion", index: "x", treeSize: 3, leaf: "00", path: [], root: "00" }))).toBe(false);
    expect(verifyBundleJSON(JSON.stringify({ type: "inclusion", index: 1.5, treeSize: 3, leaf: "00", path: [], root: "00" }))).toBe(false);
    expect(verifyBundleJSON(JSON.stringify({ type: "consistency", first: "y", second: 3, firstRoot: "00", secondRoot: "00", path: [] }))).toBe(false);
  });
});
