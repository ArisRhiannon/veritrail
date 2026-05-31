# ADR-0001: RFC 6962 domain-separated SHA-256 hashing

**Status**: Accepted · **Date**: 2026-05-31 · **Decider**: Aris Rhiannon

## Context
We need a hash construction for the Merkle tree that is interoperable, well-reviewed, and
resistant to second-preimage/leaf-node confusion attacks.

## Decision
Adopt RFC 6962 §2.1 exactly: `leafHash = SHA256(0x00 ‖ entry)`,
`nodeHash = SHA256(0x01 ‖ left ‖ right)`, `emptyRoot = SHA256("")`. SHA-256 comes from the
platform `node:crypto` (works on Node and Bun); no third-party crypto.

## Consequences
- **+** Interoperable with the large RFC 6962/9162 ecosystem; testable against the spec.
- **+** Domain separation prevents leaf/node confusion (a leaf hash can never be mistaken
  for an interior node), defeating a class of second-preimage attacks.
- **+** Zero runtime dependencies; trivially auditable.
- **−** SHA-256 is fixed for v1 (no agility). Acceptable; revisit only if a successor
  standard emerges. Domain tags make a future migration straightforward.
