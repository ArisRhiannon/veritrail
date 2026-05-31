# Plan — veritrail (phased, gated)

Role: Project Manager. Author: Aris Rhiannon.
Each phase uses the `create-issue-gate` contract: acceptance criteria are **testable /
pass-fail**. A phase's Exit Gate is `allowed` only when every criterion has a passing,
automated check. TDD per `writing-plans` (red → green → commit).

Tech: TypeScript (strict), runtime = Node/Bun, test = `bun test`, zero runtime deps,
crypto = platform `node:crypto` (SHA-256, Ed25519). Hash domain per RFC 6962:
`leafHash = SHA256(0x00 ‖ entry)`, `nodeHash = SHA256(0x01 ‖ left ‖ right)`.

---

## Phase 0 — Scaffold & tooling
**Problem:** Need a reproducible, dependency-light TS project that builds, types, tests, CI.
**Goal:** Green skeleton ready for TDD.
**Scope:** package.json, tsconfig (strict), .gitignore, LICENSE (MIT, Aris Rhiannon),
README skeleton, src/ + test/ layout, GitHub Actions CI, community files.
**Non-Goals:** any algorithm logic.
**Acceptance Criteria:**
- AC0.1 `bun test` runs and discovers ≥1 (placeholder) test → exit 0.
- AC0.2 `tsc --noEmit` (or `bun x tsc`) passes under `"strict": true`.
- AC0.3 `package.json` has 0 entries in `dependencies`.
- AC0.4 CI workflow runs install + typecheck + test on push/PR.
**Exit Gate:** allowed when AC0.1–0.4 verified locally.

## Phase 1 — Merkle core (RFC 6962): MTH + inclusion + consistency
**Problem:** Need the cryptographic tree with spec-correct proofs.
**Goal:** Pure functions for root, inclusion proof + verify, consistency proof + verify.
**Scope:** `src/hash.ts`, `src/merkle.ts`. Algorithms: `MTH(D[0:n])`, `PATH(m, D)`,
`PROOF(m, n)` (consistency), `verifyInclusion`, `verifyConsistency`.
**Non-Goals:** storage, signing, CLI.
**Acceptance Criteria:**
- AC1.1 Empty-tree root = SHA-256 of empty string (RFC 6962 base case). (vector)
- AC1.2 Single-leaf root = `leafHash(entry)`. (vector)
- AC1.3 Roots for sizes 1..8 match independently recomputed RFC 6962 reference values. (vector)
- AC1.4 ∀ n∈[1,33], ∀ i∈[0,n): `verifyInclusion(proof(i,n), i, n, leaf_i, root_n)` = true. (property)
- AC1.5 Flipping any byte of {leaf, any proof node, index, root} ⇒ AC1.4 verify = false. (property)
- AC1.6 ∀ 0≤m≤n≤33: `verifyConsistency(proof(m,n), m, n, root_m, root_n)` = true. (property)
- AC1.7 A consistency proof between a root and a *mutated-history* root of the same size fails. (property)
- AC1.8 All functions are pure (no I/O), inputs/outputs are `Uint8Array`/typed. (review+types)
**Exit Gate:** allowed when AC1.1–1.8 green.

## Phase 2 — Append-only Log + signed checkpoints
**Problem:** Users need an ergonomic log object with portable, verifiable state.
**Goal:** `Log` with append/size/root, checkpoint issue/verify, Ed25519 signing, pluggable store.
**Scope:** `src/store.ts` (interface + MemoryStore + FileStore), `src/log.ts`, `src/checkpoint.ts`.
**Non-Goals:** networking, witnesses.
**Acceptance Criteria:**
- AC2.1 `append` increments size by 1 and root changes; appends are order-preserving. (test)
- AC2.2 `log.inclusionProof(i)` integrates with Phase 1 verify for every appended i. (test)
- AC2.3 Checkpoint = {size, rootHash, timestamp}; serialize→parse round-trips byte-stable. (test)
- AC2.4 An Ed25519-signed checkpoint verifies with its public key; altering size, root, or
  signature ⇒ verify = false. (test)
- AC2.5 `MemoryStore` and `FileStore` produce identical roots for identical input sequences. (test)
- AC2.6 Reloading a `FileStore`-backed log reproduces the same root (persistence integrity). (test)
**Exit Gate:** allowed when AC2.1–2.6 green.

## Phase 3 — Sparse Merkle verifiable map
**Problem:** Need verifiable key→value with inclusion AND non-inclusion proofs.
**Goal:** `SparseMerkleTree` (256-bit keyspace, default-empty subtree optimization).
**Scope:** `src/smt.ts`.
**Non-Goals:** range proofs, history.
**Acceptance Criteria:**
- AC3.1 Empty map has a fixed, documented root (function of empty-node hashing). (test)
- AC3.2 `set(k,v)` then `proveInclusion(k)` verifies against the new root. (test)
- AC3.3 For an absent key, `proveNonInclusion(k)` verifies against the root; after `set`,
  a non-inclusion proof for that key fails. (test)
- AC3.4 Applying the same set of `(k,v)` pairs in any order yields the same root. (property)
- AC3.5 Tampering with value, key, proof sibling, or root ⇒ verify = false. (property)
**Exit Gate:** allowed when AC3.1–3.5 green.

## Phase 4 — CLI + serialization
**Problem:** Make it usable from the shell and across processes.
**Goal:** `veritrail` CLI + stable JSON proof/checkpoint serialization.
**Scope:** `src/serialize.ts`, `src/cli.ts`, `bin`.
**Non-Goals:** TUI, daemon.
**Acceptance Criteria:**
- AC4.1 `append <file> <entry>` adds an entry and prints new size+root; exit 0. (test)
- AC4.2 `root <file>` prints current size+root hex. (test)
- AC4.3 `prove <file> <index>` emits a JSON inclusion proof; `verify` of it ⇒ exit 0;
  a tampered proof ⇒ nonzero exit. (test)
- AC4.4 `consistency <file> <m> <n>` emits a proof that `verify` accepts; bad range ⇒ nonzero. (test)
- AC4.5 `audit <file>` recomputes the whole log and verifies the latest checkpoint signature;
  exit 0 on intact, nonzero on any tamper. (test)
- AC4.6 All proofs serialize→parse→verify across a process boundary (round-trip test). (test)
**Exit Gate:** allowed when AC4.1–4.6 green.

## Phase 5 — Hardening, docs, release
**Problem:** Trust requires vectors, property coverage, docs, CI.
**Goal:** Ship v1.0 with confidence.
**Scope:** RFC vector fixtures, property tests, README/threat-model, ADRs, CI matrix.
**Non-Goals:** new features.
**Acceptance Criteria:**
- AC5.1 RFC 6962 known-answer vectors committed as fixtures and asserted. (test)
- AC5.2 Property tests run ≥500 randomized trials each for inclusion & consistency; all pass. (test)
- AC5.3 `dependencies` is empty; `bun test` green; `tsc` strict clean. (CI)
- AC5.4 README has model, threat model, API table, runnable CLI examples; ≥2 ADRs in docs/adr. (review)
- AC5.5 CI green on GitHub Actions (install→typecheck→test). (CI run)
**Exit Gate:** allowed when AC5.1–5.5 green → VALIDATION.md verdict PASS.

---

## Role mapping
- CEO / PM / Developer / Tester: acted by me (per user authorization).
- QA: `code-reviewer` subagent (multi-dimensional review); findings addressed.
- Validator: independent subagent checks each AC against artifacts + test output → VALIDATION.md.
- Market Researcher: completed (docs/MARKET_RESEARCH.md).
