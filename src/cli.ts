#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { FileStore } from "./store";
import { Log } from "./log";
import { merkleRoot, consistencyProof } from "./merkle";
import { toHex, utf8, equal } from "./hash";
import {
  inclusionToJSON, consistencyToJSON, verifyBundleJSON,
  signedCheckpointToJSON, signedCheckpointFromJSON,
  type InclusionBundle, type ConsistencyBundle,
} from "./serialize";
import {
  generateKeyPair, exportPublicKeyPem, exportPrivateKeyPem,
  importPrivateKeyPem, importPublicKeyPem, verifyCheckpoint,
} from "./checkpoint";

function die(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}

const HELP = `veritrail — tamper-evident verifiable logs
commands:
  append <store> <entry>        append an entry; prints size + root
  root <store>                  print current size + root
  prove <store> <index>         emit a JSON inclusion proof
  consistency <store> <m> <n>   emit a JSON consistency proof (sizes m<=n)
  verify <bundle.json|->         verify a proof bundle (exit 0 ok / 1 fail)
  keygen <priv.pem> <pub.pem>   generate an Ed25519 key pair
  sign <store> <priv.pem>       emit a signed checkpoint for current state
  audit <store> <signed.json> <pub.pem>   verify root + signature (exit 0/1)`;

const [cmd, ...args] = process.argv.slice(2);
const open = (f: string): Log => new Log(new FileStore(f));

switch (cmd) {
  case "append": {
    const [f, entry] = args;
    if (!f || entry === undefined) die("usage: append <store> <entry>");
    const l = open(f);
    const size = l.append(utf8(entry));
    console.log(`size=${size} root=${toHex(l.root())}`);
    break;
  }
  case "root": {
    const [f] = args;
    if (!f) die("usage: root <store>");
    const l = open(f);
    console.log(`size=${l.size} root=${toHex(l.root())}`);
    break;
  }
  case "prove": {
    const [f, idx] = args;
    if (!f || idx === undefined) die("usage: prove <store> <index>");
    const l = open(f);
    const i = Number(idx);
    if (!Number.isInteger(i) || i < 0 || i >= l.size) die(`index out of range (size=${l.size})`);
    const b: InclusionBundle = { type: "inclusion", index: i, treeSize: l.size, leaf: l.leaf(i), path: l.inclusionProof(i), root: l.root() };
    console.log(inclusionToJSON(b));
    break;
  }
  case "consistency": {
    const [f, ms, ns] = args;
    if (!f || ms === undefined || ns === undefined) die("usage: consistency <store> <m> <n>");
    const l = open(f);
    const m = Number(ms), n = Number(ns), es = l.entries();
    if (!(Number.isInteger(m) && Number.isInteger(n) && 0 < m && m <= n && n <= es.length)) die(`bad range (size=${es.length})`);
    const sub = es.slice(0, n);
    const b: ConsistencyBundle = { type: "consistency", first: m, second: n, firstRoot: merkleRoot(es.slice(0, m)), secondRoot: merkleRoot(sub), path: consistencyProof(m, sub) };
    console.log(consistencyToJSON(b));
    break;
  }
  case "verify": {
    const [f] = args;
    const json = f && f !== "-" ? readFileSync(f, "utf8") : readFileSync(0, "utf8");
    const ok = verifyBundleJSON(json);
    console.log(ok ? "OK" : "FAIL");
    process.exit(ok ? 0 : 1);
    break;
  }
  case "keygen": {
    const [priv, pub] = args;
    if (!priv || !pub) die("usage: keygen <priv.pem> <pub.pem>");
    const { publicKey, privateKey } = generateKeyPair();
    writeFileSync(priv, exportPrivateKeyPem(privateKey));
    writeFileSync(pub, exportPublicKeyPem(publicKey));
    console.log("keys written");
    break;
  }
  case "sign": {
    const [f, priv] = args;
    if (!f || !priv) die("usage: sign <store> <priv.pem>");
    const l = open(f);
    const sc = l.signedCheckpoint(importPrivateKeyPem(readFileSync(priv, "utf8")), Date.now());
    console.log(signedCheckpointToJSON(sc));
    break;
  }
  case "audit": {
    const [f, scFile, pubFile] = args;
    if (!f || !scFile || !pubFile) die("usage: audit <store> <signed.json> <pub.pem>");
    const l = open(f);
    const sc = signedCheckpointFromJSON(readFileSync(scFile, "utf8"));
    const pub = importPublicKeyPem(readFileSync(pubFile, "utf8"));
    if (sc.checkpoint.size > l.size) die(`TAMPERED: checkpoint size ${sc.checkpoint.size} > log size ${l.size}`);
    const recomputed = merkleRoot(l.entries().slice(0, sc.checkpoint.size));
    const rootOk = equal(recomputed, sc.checkpoint.rootHash);
    const sigOk = verifyCheckpoint(sc.checkpoint, sc.signature, pub);
    if (rootOk && sigOk) {
      console.log(`OK size=${sc.checkpoint.size} root=${toHex(sc.checkpoint.rootHash)}`);
      process.exit(0);
    }
    die(`TAMPERED rootOk=${rootOk} sigOk=${sigOk}`);
    break;
  }
  case "help": case "--help": case "-h": case undefined:
    console.log(HELP);
    break;
  default:
    die(`unknown command: ${cmd}\n\n${HELP}`, 2);
}
