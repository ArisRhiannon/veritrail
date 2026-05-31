# Vision — veritrail

Role: CEO. Author: Aris Rhiannon. Status: accepted.

## One-liner
`veritrail` — tamper-evident, verifiable append-only logs and maps for TypeScript.
Zero dependencies, RFC 6962 / RFC 9162 Merkle trees, inclusion **and** consistency
proofs, Ed25519-signed checkpoints, and a sparse-Merkle verifiable map. Runs anywhere
Node or Bun runs. No server, no network.

## Problem
Teams that need to *prove* a log was only appended to (never secretly edited or
reordered) — audit trails, supply-chain/release logs, agent action logs — have no
modern, dependency-light, spec-faithful TypeScript primitive. They must either pull in
server-scale infrastructure (Trillian), drop to Rust (`ct-merkle`), or use generic
Merkle libs that lack consistency proofs and append-only semantics.

## Vision
The default building block in the JS/TS ecosystem for verifiable, tamper-evident data:
small enough to read in an afternoon, correct enough to trust in production, and
complete enough that you never reach for a server.

## North Star metric
**Verified proofs in the wild** — proxied during development by: % of acceptance
criteria backed by passing automated tests, and # of RFC test vectors reproduced.

## Principles
1. **Spec first.** Match RFC 6962/9162 byte-for-byte; cite the spec at each algorithm.
2. **Zero runtime deps.** Only the platform `crypto` module.
3. **Deterministic & verifiable.** Every claim has a pass/fail test; property tests for
   universal invariants; published test vectors for compliance.
4. **No network, no I/O coupling.** Storage is a tiny injectable interface.
5. **Minimal, dense, honest code.** No speculative abstractions; no dead code.
6. **Safe crypto.** Platform primitives only; verification does no secret-dependent work.

## Measurable success criteria (v1.0)
- SC1: Merkle tree head (root) matches RFC 6962 test vectors for sizes 0..N. (test)
- SC2: For a tree of size n, an inclusion proof for **every** leaf i∈[0,n) verifies, and
  any single-byte mutation of leaf/proof/root makes it fail. (property test)
- SC3: For all 0≤m≤n≤64, a consistency proof between sizes m and n verifies; tampering
  fails; an inconsistent (forked/edited) history is rejected. (property test)
- SC4: Append-only Log produces monotonic checkpoints; an Ed25519-signed checkpoint
  verifies with the public key and fails if the tree head or signature is altered. (test)
- SC5: Sparse Merkle map supports inclusion AND non-inclusion proofs that verify, and
  updates change the root deterministically (order-independent for the same key set). (test/property)
- SC6: A public CLI can `append`, `root`, `prove`, `verify`, `consistency`, and
  `audit` (full-log integrity), with stable exit codes (0 ok / nonzero fail). (test)
- SC7: Zero runtime dependencies; `bun test` green; typechecks under `strict`; CI passes
  on a clean machine. (CI)
- SC8: README documents the model, threat model, API, and CLI with runnable examples.

## Scope (v1)
Merkle tree core (MTH + inclusion + consistency), append-only Log + signed checkpoints,
sparse Merkle verifiable map, serializable proofs, CLI, docs, tests, CI.

## Non-goals (v1)
- No networked log server / gossip / witness federation (future).
- No persistence engine beyond a pluggable in-memory + file store interface.
- No certificate parsing / X.509 (we are the primitive, not a CT client).
- No consensus, no distributed replication.
- No GUI.

## Definition of done
All SC1–SC8 met and independently validated (VALIDATION.md), QA findings addressed,
pushed to GitHub under ArisRhiannon (MIT, OSI-approved open source), CI green.
