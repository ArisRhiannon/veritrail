# Contributing

Thanks for your interest in `veritrail`. It's a small, zero-runtime-dependency
cryptographic library, so correctness and clarity outrank features.

## Development

```sh
bun install
bun run check     # typecheck (strict) + full test suite
bun run build     # emit dist/ (ESM + .d.ts) — what gets published
bun test path/to/file.test.ts
```

Requirements: Bun ≥ 1.1 for the test suite (tests use `bun:test`); the built `dist/` runs
on Node ≥ 20.

## Expectations for changes

- **No new runtime dependencies.** `dependencies` must stay empty.
- **Strict types.** `bun run typecheck` must pass; no `any`, no non-null assertions on
  untrusted input.
- **Tests are mandatory**, especially for anything touching hashing, proofs, or
  verification. Prefer property tests and, where applicable, assert against the external
  RFC 6962 vectors in `test/rfc6962-vectors.test.ts`. A change to a hashing or proof path
  that doesn't update/extend vectors will not be accepted.
- **Verifiers must be total** — never throw on untrusted input; return a boolean verdict.
- Keep the core readable; document non-obvious algorithmic decisions in `docs/adr/`.

## Commits & PRs

- Conventional-commit style messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Update `CHANGELOG.md` under "Unreleased" for user-visible changes.
- CI (typecheck + tests on Bun across OSes, plus a Node build/import smoke) must be green.

By contributing you agree your contributions are licensed under the project's
[MIT License](LICENSE).
