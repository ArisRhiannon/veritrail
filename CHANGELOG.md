# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-31

### Added
- Cross-implementation RFC 6962 test vectors taken from the reference implementation
  `transparency-dev/merkle` (leaf/node/empty hashing KATs and per-size root hashes for
  the canonical 8-leaf tree); inclusion and consistency proofs are verified against those
  external roots.
- Compiled distribution: the package now ships ESM JavaScript and `.d.ts` type
  declarations in `dist/`, importable under plain Node ≥ 20 (no loader) and via the
  `veritrail` CLI on Node.
- `FileStore` cross-process concurrency safety via an exclusive lock file with bounded
  wait and stale-lock recovery.
- `Performance & scale` documentation section.

### Changed
- **License changed from AGPL-3.0 + commercial to MIT.**
- Proof verifiers (`verifyInclusion`, `verifyConsistency`) now support tree sizes up to
  `Number.MAX_SAFE_INTEGER` (was bounded below 2³¹ by 32-bit shift arithmetic).
- `verifyBundleJSON` is now total: it never throws on malformed/untrusted input and
  returns `false` instead.
- `FileStore` writes are atomic and durable (`temp → fsync → rename`, plus a best-effort
  directory fsync).
- CLI exit-code contract is now consistent: `0` valid, `1` verification FAIL, `2`
  usage/format/IO errors.

### Security
- Checkpoint deserializers validate `size`/`timestamp`/hex fields.
- Sparse-Merkle verifiers reject keys that are not 32 bytes.

## [0.1.0] - 2026-05-31

### Added
- Initial release: RFC 6962 Merkle log with inclusion and consistency proofs, Ed25519
  signed checkpoints, a sparse-Merkle verifiable map (inclusion + non-inclusion), a CLI,
  `MemoryStore`/`FileStore`, JSON proof serialization, and known-answer + property tests.

[0.2.0]: https://github.com/ArisRhiannon/veritrail/releases/tag/v0.2.0
[0.1.0]: https://github.com/ArisRhiannon/veritrail/releases/tag/v0.1.0
