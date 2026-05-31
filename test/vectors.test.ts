import { test, expect, describe } from "bun:test";
import { merkleRoot, toHex, utf8, smtEmptyRoot } from "../src/index";

// Known-answer vectors. Sizes 0 and 1 are RFC 6962 base cases (SHA256("") and
// SHA256(0x00)); sizes 2..8 are committed regression snapshots cross-validated by
// the independent oracle in merkle.test.ts (AC1.3).
const ROOTS: Record<number, string> = {
  0: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  1: "40766b2033429026f53d54502679a839706b4741f8dcaf3a8bba5f41b5ffe075",
  2: "2f27a5082c1d42afa488ac350a9fc4390c084f54f71ecdff859e98db8429b479",
  3: "a64bf26e09128f6fe2fe6f8b2d8c801e166b57c047a7cd9b2b809e7a96a2f1cb",
  4: "256b9e8825e5d370a4ae005d0901ea291977e2927f5cf8e3e72660dd09519edb",
  5: "1aa68d3074905a581f84cbbd0f753794904fd80451bc4c13e69d9a53bc59502c",
  6: "08783a523d260480de2ccf0976d7411ed8adaf06f75d5a5de2254c58f968eca9",
  7: "9139601cc1ca8ab2a7a0c2c134c04845f2b1ba549a83d6c845cfcda439cc585d",
  8: "dfcc13b9b0ca932c68de3d59eaaa8fe266a9c8091c0300e8405ebfeb0d0e5832",
};

describe("AC5.1 known-answer vectors", () => {
  for (const [n, hex] of Object.entries(ROOTS)) {
    test(`root(size=${n})`, () => {
      const es = Array.from({ length: Number(n) }, (_, i) => utf8(`entry-${i}`));
      expect(toHex(merkleRoot(es))).toBe(hex);
    });
  }
  test("SMT empty root", () => {
    expect(toHex(smtEmptyRoot())).toBe("6155289130893872355eac98042d22aefa2c2e708bea169402760e3b55f9a2dc");
  });
});
