import { test, expect, describe } from "bun:test";
import {
  Log, utf8, toHex,
  inclusionToJSON, verifyBundleJSON,
  checkpointFromJSON, checkpointToJSON,
  signedCheckpointFromJSON, generateKeyPair,
  type InclusionBundle,
} from "../src/index";

describe("verifyBundleJSON is total (never throws on untrusted input)", () => {
  const malformed: [string, string][] = [
    ["not json at all", "%%%"],
    ["empty string", ""],
    ["json null", "null"],
    ["json number", "42"],
    ["json string", '"hello"'],
    ["json array", "[]"],
    ["missing type", JSON.stringify({ index: 0, treeSize: 1 })],
    ["unknown type", JSON.stringify({ type: "bogus" })],
    ["inclusion: leaf not a string", JSON.stringify({ type: "inclusion", index: 0, treeSize: 1, leaf: 123, path: [], root: "00" })],
    ["inclusion: bad hex leaf", JSON.stringify({ type: "inclusion", index: 0, treeSize: 1, leaf: "zz", path: [], root: "00" })],
    ["inclusion: odd-length hex", JSON.stringify({ type: "inclusion", index: 0, treeSize: 1, leaf: "0", path: [], root: "00" })],
    ["inclusion: path not array", JSON.stringify({ type: "inclusion", index: 0, treeSize: 1, leaf: "00", path: "00", root: "00" })],
    ["inclusion: path element not string", JSON.stringify({ type: "inclusion", index: 0, treeSize: 1, leaf: "00", path: [5], root: "00" })],
    ["inclusion: missing fields", JSON.stringify({ type: "inclusion" })],
    ["consistency: bad hex firstRoot", JSON.stringify({ type: "consistency", first: 1, second: 2, firstRoot: "x", secondRoot: "00", path: [] })],
    ["consistency: missing fields", JSON.stringify({ type: "consistency" })],
  ];
  for (const [name, json] of malformed) {
    test(`returns false (no throw): ${name}`, () => {
      expect(() => verifyBundleJSON(json)).not.toThrow();
      expect(verifyBundleJSON(json)).toBe(false);
    });
  }

  test("a genuine bundle still verifies", () => {
    const log = new Log();
    for (let i = 0; i < 6; i++) log.append(utf8(`e${i}`));
    const b: InclusionBundle = {
      type: "inclusion", index: 2, treeSize: log.size,
      leaf: log.leaf(2), path: log.inclusionProof(2), root: log.root(),
    };
    expect(verifyBundleJSON(inclusionToJSON(b))).toBe(true);
  });
});

describe("checkpoint deserializers validate untrusted fields", () => {
  test("checkpoint round-trips", () => {
    const c = { size: 3, rootHash: utf8("0123456789abcdef0123456789abcdef"), timestamp: 1700000000 };
    const parsed = checkpointFromJSON(checkpointToJSON(c));
    expect(parsed.size).toBe(3);
    expect(toHex(parsed.rootHash)).toBe(toHex(c.rootHash));
  });
  test("rejects negative / non-integer / non-finite size & timestamp", () => {
    const root = toHex(utf8("x".repeat(16)));
    expect(() => checkpointFromJSON(JSON.stringify({ size: -1, rootHash: root, timestamp: 1 }))).toThrow();
    expect(() => checkpointFromJSON(JSON.stringify({ size: 1.5, rootHash: root, timestamp: 1 }))).toThrow();
    expect(() => checkpointFromJSON(JSON.stringify({ size: "x", rootHash: root, timestamp: 1 }))).toThrow();
    expect(() => checkpointFromJSON(JSON.stringify({ size: 1, rootHash: root, timestamp: "NaN" }))).toThrow();
    expect(() => checkpointFromJSON(JSON.stringify({ size: 1, rootHash: "zz", timestamp: 1 }))).toThrow();
  });
  test("signed checkpoint rejects missing checkpoint / bad signature", () => {
    const { publicKey, privateKey } = generateKeyPair(); void publicKey;
    const log = new Log(); log.append(utf8("a"));
    void privateKey;
    expect(() => signedCheckpointFromJSON(JSON.stringify({ signature: "00" }))).toThrow();
    expect(() => signedCheckpointFromJSON(JSON.stringify({ checkpoint: { size: 1, rootHash: "00", timestamp: 1 }, signature: "zz" }))).toThrow();
  });
});
