import { test, expect, describe } from "bun:test";
import {
  SparseMerkleTree, smtKey, smtEmptyRoot, verifyMapInclusion, verifyMapNonInclusion,
  equal, utf8,
} from "../src/index";

describe("AC3.1 empty map", () => {
  test("root equals the documented empty default", () => {
    expect(equal(new SparseMerkleTree().root(), smtEmptyRoot())).toBe(true);
  });
});

describe("AC3.2 inclusion", () => {
  test("set then prove verifies against the new root", () => {
    const t = new SparseMerkleTree();
    for (let i = 0; i < 25; i++) t.set(smtKey(`k${i}`), utf8(`v${i}`));
    const root = t.root();
    for (let i = 0; i < 25; i++) {
      const k = smtKey(`k${i}`);
      expect(verifyMapInclusion(k, utf8(`v${i}`), t.proof(k), root)).toBe(true);
    }
  });
});

describe("AC3.3 non-inclusion", () => {
  test("absent key proves non-inclusion; present key does not", () => {
    const t = new SparseMerkleTree();
    for (let i = 0; i < 10; i++) t.set(smtKey(`have${i}`), utf8(`v${i}`));
    const absent = smtKey("nope");
    expect(verifyMapNonInclusion(absent, t.proof(absent), t.root())).toBe(true);
    // after inserting it, non-inclusion must fail and inclusion must hold
    t.set(absent, utf8("now-here"));
    expect(verifyMapNonInclusion(absent, t.proof(absent), t.root())).toBe(false);
    expect(verifyMapInclusion(absent, utf8("now-here"), t.proof(absent), t.root())).toBe(true);
  });
});

describe("AC3.4 order independence", () => {
  test("same key/value set in any order yields the same root", () => {
    const pairs = Array.from({ length: 24 }, (_, i) => [smtKey(`o${i}`), utf8(`val${i}`)] as const);
    const a = new SparseMerkleTree();
    for (const [k, v] of pairs) a.set(k, v);
    const b = new SparseMerkleTree();
    for (const [k, v] of [...pairs].reverse()) b.set(k, v);
    const c = new SparseMerkleTree();
    for (const [k, v] of [...pairs.slice(7), ...pairs.slice(0, 7)]) c.set(k, v);
    expect(equal(a.root(), b.root())).toBe(true);
    expect(equal(a.root(), c.root())).toBe(true);
  });
});

describe("AC3.5 tamper rejection", () => {
  test("mutating value/key/sibling/root breaks verification", () => {
    const t = new SparseMerkleTree();
    for (let i = 0; i < 16; i++) t.set(smtKey(`t${i}`), utf8(`d${i}`));
    const k = smtKey("t7");
    const root = t.root();
    const proof = t.proof(k);
    expect(verifyMapInclusion(k, utf8("d7"), proof, root)).toBe(true);
    // wrong value
    expect(verifyMapInclusion(k, utf8("d8"), proof, root)).toBe(false);
    // wrong key
    expect(verifyMapInclusion(smtKey("t6"), utf8("d7"), proof, root)).toBe(false);
    // mutated sibling
    const bad = proof.map((p) => Uint8Array.from(p)); bad[255]![0]! ^= 1;
    expect(verifyMapInclusion(k, utf8("d7"), bad, root)).toBe(false);
    // mutated root
    const badRoot = Uint8Array.from(root); badRoot[0]! ^= 1;
    expect(verifyMapInclusion(k, utf8("d7"), proof, badRoot)).toBe(false);
    // wrong proof length
    expect(verifyMapInclusion(k, utf8("d7"), proof.slice(1), root)).toBe(false);
  });
});
