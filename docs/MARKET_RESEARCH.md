# Market Research — verifiable / tamper-evident data structures for TypeScript

Role: Market Researcher. Author: Aris Rhiannon. Status: complete → feeds VISION.md.

## 1. Method

Applied `market-sizing-analysis` (TAM/SAM/SOM, adapted from $ to OSS adoption potential),
`competitive-landscape` (prior-art survey + differentiation), and RICE scoring from
`product-manager-toolkit`. Goal: find an **underserved, high-complexity, self-contained
(non-SaaS, no-AI)** software gap that is buildable **and fully verifiable** in this
environment (Bun 1.3.11 / Node v24; Rust/Go not confirmed installed).

Selection constraints (hard):
- Self-contained: no server, no network, no external service, no AI at runtime.
- High complexity but **spec-anchored** so correctness is objective (avoids "AI-slop").
- Deterministically testable here (unit + property + known test vectors).
- Real, current demand.

## 2. Candidates surveyed

### A. Verifiable append-only logs / Merkle data structures (RFC 6962 / RFC 9162)
Prior art:
- `ctjs` (npm) — last published ~2018; scoped to *consuming/validating Certificate
  Transparency log responses*, not a general primitive; effectively unmaintained.
- `ct-merkle` (Rust) — strong, but Rust only.
- Google `Trillian` (Go) — server-scale infrastructure, not an embeddable library.
- `merkletreejs` (JS) — generic Merkle trees, but **no RFC 6962 leaf/node domain
  separation, no consistency proofs**, and not built for append-only transparency logs.
Signal: growing demand for transparency/audit logs in software supply chain
(Sigstore/Rekor style) and, newly, **verifiable audit trails for AI agents** (A2A/MCP;
e.g. "Foxbook" RFC-9162-shaped log). 
**Gap: clear.** No modern, dependency-light, spec-faithful TS library offering BOTH
inclusion and consistency proofs as a reusable building block.

### B. Structured / semantic 3-way merge (JSON/YAML/code)
Prior art (2024–2025): `Mergiraf` (Rust, tree-sitter), `Ataraxy-Labs/weave` (tree-sitter
merge driver), `LastMerge` (academic 2025), `git-json-merge`, `awesome-merge-drivers`.
**Gap: weak / closing fast.** Rejected.

### C. Deterministic Simulation Testing (DST) for async TS
Prior art: Rust `madsim`/`turmoil`, commercial `Antithesis`; JS/TS essentially bare.
Gap exists, but a credible DST framework must deterministically control the event loop,
timers, microtasks, RNG and I/O — extremely hard to make correct *and* to prove correct
in a bounded build, i.e. high risk of shipping a toy. **Rejected** (conflicts with the
"no-slop / must really work" requirement).

## 3. RICE scoring (0–10 reach/impact/confidence; effort in dev-units; here, fit)

| Candidate | Reach | Impact | Confidence (we can ship it *correct*) | Effort | RICE |
|-----------|------:|------:|--------------------------------------:|------:|-----:|
| A. Verifiable logs | 7 | 8 | 9 (spec-anchored, testable) | 5 | **10.1** |
| B. Structured merge | 8 | 7 | 4 (crowded, parser-heavy) | 8 | 2.8 |
| C. DST for TS | 6 | 9 | 3 (runtime control, slop risk) | 9 | 1.8 |

Winner: **A**. Highest because correctness is objective (RFC vectors + properties),
it is genuinely complex, self-contained, and the TS gap is real.

## 4. Target users & use cases

- Supply-chain / release engineers building Rekor-style transparency or signed-build logs.
- Platform teams needing **tamper-evident audit trails** (compliance: who-did-what,
  provable append-only, detect retroactive edits).
- Agent/automation builders needing verifiable action logs (A2A/MCP).
- Secure-timestamping, verifiable databases, key-transparency (verifiable map).

## 5. Market sizing (adapted to OSS adoption potential)

- TAM (bottom-up): JS/TS is the largest language ecosystem (npm ~ tens of millions of
  devs / millions of weekly downloads for popular crypto utils). Any team needing
  tamper-evidence is addressable. Order of magnitude: hundreds of thousands of projects.
- SAM: projects that (a) run on Node/Bun, (b) need provable append-only logs / verifiable
  maps, (c) want zero-dep + spec compliance → tens of thousands.
- SOM (3–5y, realistic for a focused OSS lib): low single-digit-% adoption within SAM →
  hundreds–low-thousands of dependent repos is a strong outcome. (Note: OSS "share" =
  adoption/stars/dependents, not revenue; no monetization assumed.)

## 6. Differentiation (why this, not the prior art)

1. **Spec-faithful** RFC 6962 hashing (leaf `H(0x00‖e)`, node `H(0x01‖l‖r)`) + RFC 6962
   inclusion *and* consistency proof algorithms — matched against published test vectors.
2. **Zero runtime dependencies** (Node/Bun `crypto` only) → trivially auditable, tiny.
3. **Reusable primitive**, not a CT-response parser and not a server.
4. Adds a **sparse Merkle tree verifiable map** (inclusion + non-inclusion proofs).
5. **Signed checkpoints** (Ed25519) so a log's state is independently verifiable/portable.
6. First-class TypeScript types, CLI, and serializable proofs.

## 7. Risks & mitigations

- *Risk:* subtle index math in consistency proofs. *Mitigation:* RFC test vectors +
  property tests (`verify(prove(i)) == true` for all i; consistency holds for all n≤m).
- *Risk:* "yet another merkle lib." *Mitigation:* lead with consistency proofs + verifiable
  map + signed checkpoints, which the JS field lacks together.
- *Risk:* crypto footguns. *Mitigation:* SHA-256/Ed25519 from platform `crypto`; no custom
  primitives; constant work, no secret-dependent branching in verification.

Decision: proceed to VISION.md with product **veritrail**.
