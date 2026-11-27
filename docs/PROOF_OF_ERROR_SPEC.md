# Proof of Error Specification (`alastor.proof-of-error` v1)

## 1. Overview

A **Proof of Error** is emitted only when:
1. One or more `HUNTER` runs submit an error finding (`contradicted`, `calculation_error`, `invalid_reference`, or `unsupported_by_cited_source`) citing primary read-only tool executions from the same run.
2. The programmatic **Evidence Gate** confirms every cited `evidenceId` exists and matches the target `claimId`.
3. An independent `JUDGE` run reviews the raw claim and primary tool outputs (without access to `HUNTER` hidden reasoning) and renders `decision = "accepted"`.

## 2. Document Envelope

```json
{
  "payload": {
    "schema": "alastor.proof-of-error",
    "version": "1.0.0",
    "proofId": "uuid-v4",
    "taskId": "uuid-v4",
    "claimId": "claim-1",
    "findingId": "uuid-v4",
    "category": "numerical",
    "claimText": "Burning 250,000 tokens from a 1,000,000 supply reduces total supply by 33.3%.",
    "verdict": "calculation_error",
    "severity": "high",
    "judgeSummary": "250,000 divided by the initial 1,000,000 supply equals a 25% reduction, not 33.3%.",
    "hunterInstanceId": "hunter-01",
    "judgeInstanceId": "judge-01",
    "evidenceSummary": [
      {
        "evidenceId": "ev-01",
        "toolName": "percentage_check",
        "sourceLocator": "deterministic://decimal-40/percentage_check",
        "observedOutcome": "computed=-25%, claimed=-33.3%, delta=8.3pp (inconsistent)",
        "capturedAt": "2026-11-27T00:00:00.000Z"
      }
    ],
    "limitations": [
      "Evaluates internal mathematical consistency of stated figures."
    ],
    "publishedAt": "2026-11-27T00:00:05.000Z"
  },
  "digest": {
    "algorithm": "SHA-256",
    "canonicalization": "RFC8785-JCS",
    "value": "<64-char-lowercase-hex>"
  }
}
```

## 3. Canonicalization & Hashing Procedure

1. Extract `document.payload`.
2. Serialize `payload` strictly according to **RFC 8785 (JSON Canonicalization Scheme)**:
   - Object properties sorted lexicographically by UTF-16 code units at every nesting depth.
   - No insignificant whitespace between tokens.
   - Strings escaped per RFC 8785 Section 3.2.2.2.
   - Numbers formatted per ECMA-262 `Number.prototype.toString()`.
3. Encode the canonical string as UTF-8 bytes and compute `SHA-256`.
4. Format the 32-byte digest as 64 lowercase hexadecimal characters.
5. Verify `recomputed === document.digest.value.toLowerCase()`.

## 4. On-Chain Merkle Batching (Robinhood Chain `4663`)

For batch anchoring in `AlastorProofAnchor.sol`:
- Each leaf is `bytes32(proofContentHash)` (the raw 32-byte SHA-256 digest of the canonical payload).
- Internal Merkle nodes are computed using sorted-pair `keccak256(abi.encodePacked(min(a, b), max(a, b)))` to allow compact, direction-agnostic inclusion proofs.
