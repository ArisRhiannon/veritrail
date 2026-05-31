# ADR-0002: Pluggable storage + Ed25519 signed checkpoints

**Status**: Accepted · **Date**: 2026-05-31 · **Decider**: Aris Rhiannon

## Context
The library must stay self-contained (no DB/server) yet support persistence, and let a log
publish a portable, independently verifiable commitment to its state.

## Decision
- Define a tiny `Store` interface (`size/get/append/all`) with `MemoryStore` and
  `FileStore` (JSON array of hex) implementations; `Log` depends only on the interface.
- A `Checkpoint` is `{size, rootHash, timestamp}` with a **deterministic** byte encoding
  (`veritrail-checkpoint\n{size}\n{rootHex}\n{timestamp}\n`) used as the signing payload.
- Signatures use **Ed25519** via `node:crypto` (`sign(null, …)`); keys are `KeyObject`s
  with PEM import/export for portability.

## Consequences
- **+** Embeddable; users can supply their own `Store` (e.g. SQLite) without touching core.
- **+** Deterministic encoding ⇒ signatures are reproducible and unambiguous.
- **+** Ed25519: small, fast, misuse-resistant, built into the platform.
- **−** `FileStore` rewrites the whole file per append (O(n)); fine for moderate logs.
  A tiled/append-only on-disk format is future work.
