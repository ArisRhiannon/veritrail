import { test, expect, describe } from "bun:test";
import {
  verifyInclusion, verifyConsistency, leafHash, merkleRoot, utf8, verifyBundleJSON,
  SparseMerkleTree, smtKey, verifyMapInclusion, verifyMapNonInclusion,
} from "../src/index";

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

describe("verifiers reject sizes beyond Number.MAX_SAFE_INTEGER", () => {
  const leaf = leafHash(utf8("a"));
  const root = merkleRoot([utf8("a")]);
  test("inclusion rejects treeSize > MAX_SAFE_INTEGER", () => {
    expect(verifyInclusion([], 0, Number.MAX_SAFE_INTEGER + 1, leaf, root)).toBe(false);
    expect(verifyInclusion([], Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER + 2, leaf, root)).toBe(false);
  });
  test("consistency rejects sizes > MAX_SAFE_INTEGER", () => {
    expect(verifyConsistency([], 1, Number.MAX_SAFE_INTEGER + 1, root, root)).toBe(false);
    expect(verifyConsistency([], Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER + 2, root, root)).toBe(false);
  });
});

describe("SMT verifiers reject wrong-length keys", () => {
  const t = new SparseMerkleTree();
  for (let i = 0; i < 8; i++) t.set(smtKey(`k${i}`), utf8(`v${i}`));
  const root = t.root();
  const k = smtKey("k3");
  const proof = t.proof(k);
  test("a 31-byte key fails inclusion and non-inclusion (no throw)", () => {
    const short = k.slice(0, 31);
    expect(() => verifyMapInclusion(short, utf8("v3"), proof, root)).not.toThrow();
    expect(verifyMapInclusion(short, utf8("v3"), proof, root)).toBe(false);
    expect(verifyMapNonInclusion(short, proof, root)).toBe(false);
  });
  test("the correct 32-byte key still verifies", () => {
    expect(verifyMapInclusion(k, utf8("v3"), proof, root)).toBe(true);
  });
});
