# ADR-0003: Sparse Merkle tree for the verifiable map

**Status**: Accepted · **Date**: 2026-05-31 · **Decider**: Aris Rhiannon

## Context
We want a verifiable key→value map supporting both inclusion and **non-inclusion** proofs,
without materializing a 2^256-node tree.

## Decision
Use a fixed-depth (256) sparse Merkle tree keyed by a 32-byte key (`smtKey = SHA256(s)`).
Empty subtrees collapse to precomputed default nodes: `D[256] = 32 zero bytes`,
`D[L] = nodeHash(D[L+1], D[L+1])`. Occupied leaves are `leafHash(value)` (never all-zero,
so an occupied leaf is distinguishable from the empty default). Roots and proofs are
computed by recursing only over populated branches; a non-inclusion proof reconstructs the
root with the empty-leaf default at the key's path.

## Consequences
- **+** Inclusion and non-inclusion proofs share one verification routine.
- **+** Order-independent: the root depends only on the key/value *set*.
- **+** Reuses the same `nodeHash`/`leafHash` domain separation as the log.
- **−** Proof generation recomputes subtree roots (O(k·depth)); fine at library scale.
  Caching/persistent nodes are future work.
