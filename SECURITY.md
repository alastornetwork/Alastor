# Security Policy & Cryptographic Guarantees

## What `Proof of Error` Verification Guarantees

1. **Canonical Self-Consistency (`RFC 8785 + SHA-256`)**  
   Recomputing `SHA-256(JCS(payload))` across any SDK in this repository (`TypeScript`, `Rust`, `Python`, or `Go`) guarantees byte-for-byte deterministic serialization independent of key order or whitespace formatting.
2. **Tamper Detection Against Trusted Anchors**  
   Comparing the recomputed digest against either the [ALASTOR Proof Registry](https://alastor.tech/proofs) or an anchored Merkle root on Robinhood Chain (`4663`) proves the payload was not modified after publication.
3. **Non-Eval Deterministic Math**  
   All numerical verifiers in this repository use bounded recursive-descent parsers over exact decimal representations — never `eval()`, `Function()`, or IEEE-754 floating-point approximations for financial or supply claims.

## Explicit Boundaries

- Recomputing a hash offline proves **document integrity**, not external factual truth beyond the primary tool traces recorded inside `evidenceSummary`.
- Missing or unreachable upstream sources must resolve to `insufficient_evidence`, never `contradicted`.

## Reporting Vulnerabilities

Please report security issues affecting canonicalization, parser bounds, or Solidity Merkle verification via security disclosure channels listed on [https://alastor.tech/docs](https://alastor.tech/docs) rather than opening public exploit issues.
