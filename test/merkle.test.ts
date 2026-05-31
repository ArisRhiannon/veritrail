import { test, expect, describe } from "bun:test";
import {
  emptyRoot, leafHash, nodeHash, toHex, equal, utf8,
  merkleRoot, inclusionPath, verifyInclusion, consistencyProof, verifyConsistency,
} from "../src/index";

const E = (i: number): Uint8Array => utf8(`entry-${i}`);
const entries = (n: number): Uint8Array[] => Array.from({ length: n }, (_, i) => E(i));

/** Independent root oracle: incremental subtree stack + right-to-left fold.
 *  Structurally different from the recursive splitPoint implementation. */
function refRoot(es: Uint8Array[]): Uint8Array {
  if (es.length === 0) return emptyRoot();
  const stack: { size: number; hash: Uint8Array }[] = [];
  for (const e of es) {
    let node = { size: 1, hash: leafHash(e) };
    while (stack.length > 0 && stack[stack.length - 1]!.size === node.size) {
      const left = stack.pop()!;
      node = { size: left.size * 2, hash: nodeHash(left.hash, node.hash) };
    }
    stack.push(node);
  }
  let r = stack[stack.length - 1]!.hash;
  for (let i = stack.length - 2; i >= 0; i--) r = nodeHash(stack[i]!.hash, r);
  return r;
}

describe("RFC 6962 known vectors", () => {
  test("AC1.1 empty tree root = SHA256('')", () => {
    expect(toHex(merkleRoot([]))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
  test("AC1.2 single empty-leaf root = SHA256(0x00)", () => {
    expect(toHex(merkleRoot([new Uint8Array(0)]))).toBe("6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d");
  });
  test("structural: 2 and 3 leaves follow RFC split", () => {
    const e = entries(3);
    expect(equal(merkleRoot(e.slice(0, 2)), nodeHash(leafHash(e[0]!), leafHash(e[1]!)))).toBe(true);
    const expect3 = nodeHash(nodeHash(leafHash(e[0]!), leafHash(e[1]!)), leafHash(e[2]!));
    expect(equal(merkleRoot(e), expect3)).toBe(true);
  });
});

describe("AC1.3 root matches independent oracle for sizes 0..64", () => {
  for (let n = 0; n <= 64; n++) {
    test(`size ${n}`, () => {
      expect(equal(merkleRoot(entries(n)), refRoot(entries(n)))).toBe(true);
    });
  }
});

describe("AC1.4/AC1.5 inclusion proofs", () => {
  test("every leaf in trees of size 1..33 has a verifying proof", () => {
    for (let n = 1; n <= 33; n++) {
      const es = entries(n);
      const root = refRoot(es);
      for (let i = 0; i < n; i++) {
        const proof = inclusionPath(i, es);
        expect(verifyInclusion(proof, i, n, leafHash(E(i)), root)).toBe(true);
      }
    }
  });
  test("tampering any component breaks verification", () => {
    const n = 21, i = 5, es = entries(n), root = refRoot(es);
    const proof = inclusionPath(i, es);
    expect(verifyInclusion(proof, i, n, leafHash(E(i)), root)).toBe(true);
    // wrong leaf
    expect(verifyInclusion(proof, i, n, leafHash(E(999)), root)).toBe(false);
    // wrong index
    expect(verifyInclusion(proof, i + 1, n, leafHash(E(i)), root)).toBe(false);
    // mutated root
    const badRoot = Uint8Array.from(root); badRoot[0]! ^= 1;
    expect(verifyInclusion(proof, i, n, leafHash(E(i)), badRoot)).toBe(false);
    // mutated proof node
    if (proof.length > 0) {
      const bad = proof.map((p) => Uint8Array.from(p)); bad[0]![0]! ^= 1;
      expect(verifyInclusion(bad, i, n, leafHash(E(i)), root)).toBe(false);
    }
    // dropped proof node
    expect(verifyInclusion(proof.slice(1), i, n, leafHash(E(i)), root)).toBe(false);
  });
});

describe("AC1.6/AC1.7 consistency proofs", () => {
  test("verify for all 0<m<=n<=33", () => {
    for (let n = 1; n <= 33; n++) {
      const es = entries(n);
      const rootN = refRoot(es);
      for (let m = 1; m <= n; m++) {
        const proof = consistencyProof(m, es);
        const rootM = refRoot(entries(m));
        expect(verifyConsistency(proof, m, n, rootM, rootN)).toBe(true);
      }
    }
  });
  test("forked / edited history is rejected", () => {
    const m = 7, n = 13;
    const es = entries(n);
    const proof = consistencyProof(m, es);
    const rootM = refRoot(entries(m));
    const rootN = refRoot(es);
    expect(verifyConsistency(proof, m, n, rootM, rootN)).toBe(true);
    // a different first-tree root (history was edited) must fail
    const forkedM = refRoot([...entries(m - 1), utf8("tampered")]);
    expect(verifyConsistency(proof, m, n, forkedM, rootN)).toBe(false);
    // mutated proof node fails
    if (proof.length > 0) {
      const bad = proof.map((p) => Uint8Array.from(p)); bad[0]![0]! ^= 1;
      expect(verifyConsistency(bad, m, n, rootM, rootN)).toBe(false);
    }
    // wrong second root fails
    const badN = Uint8Array.from(rootN); badN[0]! ^= 1;
    expect(verifyConsistency(proof, m, n, rootM, badN)).toBe(false);
  });
});
