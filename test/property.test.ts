import { test, expect, describe } from "bun:test";
import {
  merkleRoot, inclusionPath, verifyInclusion, consistencyProof, verifyConsistency, leafHash,
} from "../src/index";

// Deterministic seeded RNG (mulberry32) so CI runs are reproducible.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randEntries(r: () => number, n: number): Uint8Array[] {
  return Array.from({ length: n }, () => {
    const len = 1 + ((r() * 32) | 0);
    const b = new Uint8Array(len);
    for (let i = 0; i < len; i++) b[i] = (r() * 256) | 0;
    return b;
  });
}

const TRIALS = 500;

describe("AC5.2 property: inclusion (>=500 trials)", () => {
  test("random proofs verify; random tamper rejected", () => {
    const r = rng(0xC0FFEE);
    let ok = 0;
    for (let t = 0; t < TRIALS; t++) {
      const n = 1 + ((r() * 200) | 0);
      const es = randEntries(r, n);
      const i = (r() * n) | 0;
      const root = merkleRoot(es);
      const proof = inclusionPath(i, es);
      expect(verifyInclusion(proof, i, n, leafHash(es[i]!), root)).toBe(true);
      const bad = Uint8Array.from(root); bad[(r() * 32) | 0]! ^= 1 + ((r() * 255) | 0);
      expect(verifyInclusion(proof, i, n, leafHash(es[i]!), bad)).toBe(false);
      ok++;
    }
    expect(ok).toBe(TRIALS);
  });
});

describe("AC5.2 property: consistency (>=500 trials)", () => {
  test("random proofs verify; tamper rejected", () => {
    const r = rng(0xBADF00D);
    let ok = 0;
    for (let t = 0; t < TRIALS; t++) {
      const n = 1 + ((r() * 200) | 0);
      const es = randEntries(r, n);
      const m = 1 + ((r() * n) | 0); // 1..n
      const sub = es.slice(0, n);
      const proof = consistencyProof(m, sub);
      const rootM = merkleRoot(es.slice(0, m));
      const rootN = merkleRoot(sub);
      expect(verifyConsistency(proof, m, n, rootM, rootN)).toBe(true);
      if (m < n) {
        const bad = Uint8Array.from(rootN); bad[(r() * 32) | 0]! ^= 1 + ((r() * 255) | 0);
        expect(verifyConsistency(proof, m, n, rootM, bad)).toBe(false);
      }
      ok++;
    }
    expect(ok).toBe(TRIALS);
  });
});
