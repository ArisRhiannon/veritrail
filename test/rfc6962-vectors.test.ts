import { test, expect, describe } from "bun:test";
import {
  merkleRoot, inclusionPath, verifyInclusion, consistencyProof, verifyConsistency,
  leafHash, nodeHash, emptyRoot, fromHex, toHex, utf8,
} from "../src/index";

// External, authoritative RFC 6962 vectors copied verbatim from the REFERENCE
// implementation transparency-dev/merkle (Google, Apache-2.0):
//   - rfc6962/rfc6962_test.go : leaf/node/empty hashing KATs (each reproducible
//     via `echo -n <hex> | xxd -r -p | sha256sum`).
//   - testonly/constants.go   : canonical leaf inputs + per-size root hashes.
// These hashes were produced by an INDEPENDENT codebase, so matching them is a
// genuine cross-implementation interoperability check — not self-comparison.

// LeafInputs() from testonly/constants.go (hex-encoded leaf bytes).
const LEAVES = ["", "00", "10", "2021", "3031", "40414243", "5051525354555657", "606162636465666768696a6b6c6d6e6f"].map(fromHex);

// RootHashes() from testonly/constants.go, indexed by tree size 0..8.
const ROOTS = [
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d",
  "fac54203e7cc696cf0dfcb42c92a1d9dbaf70ad9e621f4bd8d98662f00e3c125",
  "aeb6bcfe274b70a14fb067a5e5578264db0fa9b51af5e0ba159158f329e06e77",
  "d37ee418976dd95753c1c73862b9398fa2a2cf9b4ff0fdfe8b30cd95209614b7",
  "4e3bbb1f7b478dcfe71fb631631519a3bca12c9aefca1612bfce4c13a86264d4",
  "76e67dadbcdf1e10e1b74ddc608abd2f98dfb16fbce75277b5232a127f2087ef",
  "ddb89be403809e325750d3d263cd78929c2942b7942a34b77e122c9594a74c8c",
  "5dc9da79a70659a9ad559cb701ded9a2ab9d823aad2f4960cfe370eff4604328",
];

describe("RFC 6962 cross-implementation vectors (transparency-dev/merkle)", () => {
  test("leaf/node/empty hashing KATs match the reference byte-for-byte", () => {
    expect(toHex(emptyRoot())).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(toHex(leafHash(fromHex("")))).toBe("6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d");
    expect(toHex(leafHash(utf8("L123456")))).toBe("395aa064aa4c29f7010acfe3f25db9485bbd4b91897b6ad7ad547639252b4d56");
    expect(toHex(nodeHash(utf8("N123"), utf8("N456")))).toBe("aa217fe888e47007fa15edab33c2b492a722cb106c64667fc2b044444de66bbb");
  });

  test("root hashes for sizes 0..8 match the reference tree", () => {
    for (let n = 0; n <= 8; n++) {
      expect(toHex(merkleRoot(LEAVES.slice(0, n)))).toBe(ROOTS[n] as string);
    }
  });

  test("inclusion proofs verify against the reference size-8 root", () => {
    const root = fromHex(ROOTS[8] as string);
    for (let i = 0; i < 8; i++) {
      expect(verifyInclusion(inclusionPath(i, LEAVES), i, 8, leafHash(LEAVES[i] as Uint8Array), root)).toBe(true);
    }
  });

  test("consistency proofs link the reference roots for all 1<=m<=8", () => {
    for (let m = 1; m <= 8; m++) {
      const proof = consistencyProof(m, LEAVES);
      expect(verifyConsistency(proof, m, 8, fromHex(ROOTS[m] as string), fromHex(ROOTS[8] as string))).toBe(true);
    }
  });
});
