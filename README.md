# veritrail

[![ci](https://github.com/ArisRhiannon/veritrail/actions/workflows/ci.yml/badge.svg)](https://github.com/ArisRhiannon/veritrail/actions/workflows/ci.yml)

**Tamper-evident, verifiable append-only logs and maps for TypeScript.** Zero
dependencies. RFC 6962 / RFC 9162 Merkle trees with **inclusion *and* consistency**
proofs, Ed25519-signed checkpoints, and a sparse-Merkle **verifiable map** (inclusion +
non-inclusion proofs). Runs anywhere Node or Bun runs. No server, no network, no AI.

## Why

The JS/TS ecosystem has generic Merkle-tree libraries, but no modern, dependency-light,
spec-faithful primitive for building your own *transparency logs* / tamper-evident audit
trails with both inclusion and consistency proofs. Robust implementations live in Rust
(`ct-merkle`) or in server-scale infrastructure (Trillian). `veritrail` fills that gap as
a small library you can read in an afternoon and trust in production.

Use it for: supply-chain / release transparency, compliance audit trails (provably
append-only), verifiable action logs for agents/automation, secure timestamping, and
key-transparency-style verifiable maps.

## Install

```sh
bun add veritrail     # or: npm i veritrail   (runs on Node >= 20 via a TS loader / build)
```

Or use from source: `git clone … && bun install && bun test`.

## Data model

Hashing follows RFC 6962 §2.1 (domain-separated):

```
leafHash(entry)        = SHA256(0x00 || entry)
nodeHash(left, right)  = SHA256(0x01 || left || right)
emptyRoot()            = SHA256("")
```

- **Log**: an ordered list of entries; its *Merkle Tree Head* (root) commits to the whole
  history. An **inclusion proof** shows an entry is in the tree; a **consistency proof**
  shows tree *n* is an append-only extension of tree *m* (nothing was edited or removed).
- **Checkpoint**: `{size, rootHash, timestamp}`, optionally **Ed25519-signed** — a
  portable, independently verifiable commitment to the log state.
- **Verifiable map** (sparse Merkle tree, 256-bit keys): proves `key → value`
  (inclusion) *and* `key is absent` (non-inclusion).

## Library quickstart

```ts
import { Log, verifyInclusion, verifyConsistency, generateKeyPair, verifyCheckpoint, utf8 } from "veritrail";

const log = new Log();
log.append(utf8("event-1"));
log.append(utf8("event-2"));

// Inclusion: prove entry 0 is in the log.
const n = log.size, root = log.root();
const proof = log.inclusionProof(0);
verifyInclusion(proof, 0, n, log.leaf(0), root); // => true

// Consistency: prove the size-2 tree extends the size-1 tree.
const before = new Log(); before.append(utf8("event-1"));
const cproof = log.consistencyProof(1);
verifyConsistency(cproof, 1, 2, before.root(), root); // => true

// Signed checkpoint.
const { publicKey, privateKey } = generateKeyPair();
const { checkpoint, signature } = log.signedCheckpoint(privateKey);
verifyCheckpoint(checkpoint, signature, publicKey); // => true
```

Verifiable map:

```ts
import { SparseMerkleTree, smtKey, verifyMapInclusion, verifyMapNonInclusion, utf8 } from "veritrail";

const t = new SparseMerkleTree();
t.set(smtKey("alice"), utf8("100"));
const root = t.root();
verifyMapInclusion(smtKey("alice"), utf8("100"), t.proof(smtKey("alice")), root);    // true
verifyMapNonInclusion(smtKey("bob"), t.proof(smtKey("bob")), root);                   // true
```

## CLI

```sh
veritrail keygen priv.pem pub.pem
veritrail append log.json "first entry"      # -> size=1 root=…
veritrail append log.json "second entry"     # -> size=2 root=…
veritrail prove log.json 0 > incl.json        # JSON inclusion proof
veritrail verify incl.json                     # -> OK            (exit 0)
veritrail consistency log.json 1 2 > cons.json
veritrail verify cons.json                     # -> OK
veritrail sign log.json priv.pem > signed.json
veritrail audit log.json signed.json pub.pem   # -> OK   (recomputes root + checks signature)
```

`verify` and `audit` exit `0` when valid and non-zero when tampering is detected.

## Threat model

Protects against **undetectable mutation of history**: editing, reordering, deleting, or
truncating past entries is caught by inclusion/consistency proof verification, and a
signed checkpoint binds a specific `(size, root)` to a key holder. It does **not** provide
confidentiality (entries are not encrypted), availability, or protection against an
attacker who controls the verifier's copy of the trusted root/public key. Crypto uses the
platform `node:crypto` (SHA-256, Ed25519); verification performs no secret-dependent work.

## API summary

| Area | Exports |
|------|---------|
| Hash | `sha256`, `leafHash`, `nodeHash`, `emptyRoot`, `equal`, `toHex`, `fromHex`, `utf8` |
| Merkle | `merkleRoot`, `inclusionPath`, `verifyInclusion`, `consistencyProof`, `verifyConsistency` |
| Log/Store | `Log`, `Store`, `MemoryStore`, `FileStore` |
| Checkpoint | `Checkpoint`, `generateKeyPair`, `signCheckpoint`, `verifyCheckpoint`, `encodeCheckpoint`, PEM import/export |
| Verifiable map | `SparseMerkleTree`, `smtKey`, `smtEmptyRoot`, `verifyMapInclusion`, `verifyMapNonInclusion` |
| Serialization | `inclusionToJSON`, `consistencyToJSON`, `verifyBundleJSON`, checkpoint (de)serializers |

## Status

v0.1 implements the full v1 scope (see `docs/PLAN.md`): Merkle core, append-only log with
signed checkpoints, verifiable map, CLI, RFC known-answer + 500-trial property tests, CI.
Decisions are recorded in `docs/adr/`. Roadmap: networked witness/gossip, tiled logs,
inclusion-proof batching.

## License

Source-available — **not** OSI open source. Free under the GNU **AGPL-3.0** for
individuals, non-profits, and organizations below **US$1M annual revenue and 50
employees**; larger organizations require a commercial license. See [LICENSE](LICENSE).

© 2026 Aris Rhiannon
