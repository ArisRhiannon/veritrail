# Security Policy

## Supported versions

`veritrail` is pre-1.0. Security fixes are applied to the latest `0.x` minor release.

## Reporting a vulnerability

Please report suspected vulnerabilities privately via GitHub Security Advisories
("Report a vulnerability" on the repository's **Security** tab) rather than opening a
public issue. Include a description, affected version/commit, and a reproduction (a
failing input or proof bundle is ideal). Expect an initial acknowledgement within a few
days.

## Scope

`veritrail` is a cryptographic primitive for tamper-evident, append-only logs. It detects
**undetectable mutation of history** — editing, reordering, deleting, or truncating past
entries is caught by inclusion/consistency proof verification, and a signed checkpoint
binds a specific `(size, root)` to a key holder.

It does **not** provide:

- confidentiality (entries are not encrypted);
- availability / DoS resistance;
- protection against an attacker who controls the verifier's copy of the trusted root or
  public key.

Cryptography uses the platform `node:crypto` (SHA-256, Ed25519). Verification performs no
secret-dependent work. In-scope reports include: a proof that verifies against a root it
should not, a verifier that can be made to throw or hang on untrusted input, a hashing
deviation from RFC 6962, or signature-verification bypass.
