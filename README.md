# ALASTOR — Adversarial Intelligence Verification Protocol

[![Protocol](https://img.shields.io/badge/ALASTOR-Adversarial_Verification-FF5000?style=flat-square)](https://alastor.tech)
[![Chain](https://img.shields.io/badge/Robinhood_Chain-4663-111111?style=flat-square)](https://alastor.tech)
[![Proof Spec](https://img.shields.io/badge/Proof_of_Error-RFC_8785_%2B_SHA--256-292929?style=flat-square)](./docs/PROOF_OF_ERROR_SPEC.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-5C5C58?style=flat-square)](./LICENSE)

**Making Intelligence Accountable.**  
Live Verification Arena & Proof Registry: **[https://alastor.tech](https://alastor.tech)**

CA: 0xbf131d2ab39fe1d1c60406413321214424736da4
ALASTOR is an adversarial verification protocol that separates claim investigation (**HUNTER** agents) from evidence adjudication (**JUDGE** agents) behind a deterministic **Evidence Gate**. Confirmed factual, numerical, citation, or on-chain discrepancies are serialized under **RFC 8785 JSON Canonicalization Scheme (JCS)** and signed as SHA-256 **`Proof of Error`** artifacts (`alastor.proof-of-error`).

This repository contains the open-source **multi-language verification SDKs, CLI verifiers, cryptographic test vectors, and Robinhood Chain (`4663`) anchoring contracts** for integrating and independently auditing ALASTOR verdicts without trusting the hosted Arena coordinator.

---

## Protocol Architecture

```text
  [ User / AI Agent / Protocol ]
                │
                ▼  Submit 1..5 Claims
  ┌─────────────────────────────┐
  │   01 · Claim Decomposition  │  Bounded atomic statements (On-Chain, Numerical, DOI, General)
  └─────────────┬───────────────┘
                │
      ┌─────────┴─────────┐
      ▼                   ▼
┌───────────┐       ┌───────────┐
│ HUNTER-01 │       │ HUNTER-02 │  Read-only RPC, DEX/Launchpad feeds, 40-digit math, Crossref, Wikidata
│  (Direct) │       │ (Advers.) │
└─────┬─────┘       └─────┬─────┘
      └─────────┬─────────┘
                ▼
  ┌─────────────────────────────┐
  │  02 · Deterministic Gate    │  Strips hallucinated or cross-claim evidence IDs in code
  └─────────────┬───────────────┘
                │
                ▼  Primary Tool Traces Only (Zero HUNTER Chain-of-Thought)
  ┌─────────────────────────────┐
  │      03 · JUDGE Audit       │  40% reserved token budget; renders Accepted / Rejected / Unresolved
  └─────────────┬───────────────┘
                │
                ▼  Accepted Error + Primary Evidence
  ┌─────────────────────────────┐
  │   04 · Proof of Error (v1)  │  SHA-256(RFC8785(payload)) ──► Robinhood Chain (4663) Merkle Anchor
  └─────────────────────────────┘
```

---

## Multi-Language Repository Layout

| Path | Language | Component | Description |
| :--- | :--- | :--- | :--- |
| [`sdk/typescript`](./sdk/typescript) | **TypeScript** | `@alastor/sdk` | RFC 8785 + SHA-256 Proof verifier, 40-digit non-`eval` decimal engine, Evidence Gate, and Arena REST client |
| [`crates/alastor-verifier`](./crates/alastor-verifier) | **Rust** | `alastor-verifier` | Zero-copy native RFC 8785 canonicalizer, SHA-256 Proof verifier, and basis-point tolerance engine |
| [`contracts`](./contracts) | **Solidity** | `AlastorProofAnchor` | Robinhood Chain (`4663`) Merkle root & digest anchoring + bonded `HUNTER`/`JUDGE` operator staking vault |
| [`sdk/python`](./sdk/python) | **Python** | `alastor` | Zero-dependency Python 3.11+ offline Proof verifier, 40-digit `Decimal` checker, CLI, and API client |
| [`cli/go`](./cli/go) | **Go** | `alastor-verify` | Standalone CLI binary for verifying `.proof.json` artifacts in CI/CD and research pipelines |
| [`vectors`](./vectors) | **JSON** | Test Vectors | Cross-language `alastor.proof-of-error` v1 canonical reference vectors |
| [`docs`](./docs) | **Markdown** | Specification | Formal `Proof of Error` (`v1`) schema, digest rules, and security boundaries |

> **Scope Note:** Managed task scheduling, anti-Sybil rate controls, model-routing workers, and database persistence operate as hosted infrastructure behind [alastor.tech](https://alastor.tech). Every public verdict and `Proof of Error` artifact produced by the Arena is independently verifiable offline using any implementation in this repository.

---

## Quickstart Across Languages

### 1. TypeScript (`@alastor/sdk`)

```ts
import { verifyProofDocument, evaluatePercentageClaim, AlastorClient } from "@alastor/sdk";

// 1. Fetch and cryptographically verify a published Proof of Error
const client = new AlastorClient({ baseUrl: "https://alastor.tech" });
const proofDoc = await client.exportProof("d4e8b2c0-7a1f-4e92-9b3c-1102a8f47c19");

const result = await verifyProofDocument(proofDoc);
console.log(result.selfConsistent, result.recomputedDigest);

// 2. Run deterministic 40-digit percentage verification (no eval)
const mathCheck = evaluatePercentageClaim({
  initialValue: "1000000",
  finalValue: "750000",
  claimedPercentChange: "-33.3",
  tolerancePctPoints: "0.05",
});
console.log(mathCheck.outcome); // "inconsistent" (exact change is -25%)
```

### 2. Python (`sdk/python`)

```bash
cd sdk/python
python -m unittest discover -s tests
python -m alastor.cli verify ../../vectors/sample-proof-v1.json
```

```python
from alastor import verify_proof_file, check_percentage_claim

verification = verify_proof_file("../../vectors/sample-proof-v1.json")
assert verification.self_consistent is True

calc = check_percentage_claim(initial="1200", final="1500", claimed_pct="30")
assert calc["consistent"] is False  # actual = +25%
```

### 3. Rust (`crates/alastor-verifier`)

```bash
cd crates/alastor-verifier
cargo test
```

```rust
use alastor_verifier::{verify_proof_json, check_basis_points_delta};

let raw = std::fs::read_to_string("../../vectors/sample-proof-v1.json")?;
let report = verify_proof_json(&raw, None)?;
assert!(report.self_consistent);
```

### 4. Go CLI (`cli/go`)

```bash
cd cli/go
go run ./cmd/alastor-verify ../../vectors/sample-proof-v1.json
```

### 5. Solidity — Robinhood Chain (`4663`) On-Chain Inclusion Check

```solidity
import {IAlastorProofAnchor} from "./interfaces/IAlastorProofAnchor.sol";

bool anchored = IAlastorProofAnchor(anchorAddress).verifyProofInclusion(
    batchId,
    proofContentHash, // SHA-256 digest of RFC 8785 canonical payload
    merkleSiblingPath
);
```

---

## Protocol & Token Utility

1. **Verification Bounties & Priority Queues** — Protocols, launchpads, and users fund priority multi-agent verification pools settled strictly upon deterministic Evidence Gate and JUDGE acceptance.
2. **HUNTER & JUDGE Operator Staking** — External node operators post collateral to serve verification tasks across diverse LLM families; fabricated citations trigger programmatic slashing.
3. **Adversarial Dispute Collateral** — Any participant can challenge a verdict by bonding stake alongside new deterministic counter-evidence to escalate to multi-model arbitration.
4. **High-Throughput Verification API** — Exchanges, DeFi frontends, and autonomous AI agents meter pre-execution claim and contract-state checks.
5. **Robinhood Chain Proof Anchoring** — Canonical `Proof of Error` digests are batched into Merkle roots and anchored on Robinhood Chain (`4663`).
6. **Tool Registry Governance** — Stakers curate approved read-only data adapters, RPC endpoints, and per-category evidence thresholds.

---

## Roadmap

- **Phase 01 · Genesis Arena (Completed)** — Dual-role `HUNTER` / `JUDGE` pipeline, TypeScript Evidence Gate, Robinhood Chain (`4663`) RPC + DEX/launchpad + 40-digit math + Crossref/Wikidata tools, RFC 8785 `Proof of Error` Registry.
- **Phase 02 · Token Utility & Robinhood Chain Anchoring** — Protocol token activation, priority queues, on-chain Merkle root anchoring on Robinhood Chain (`4663`), and public multi-language verification SDKs.
- **Phase 03 · Bonded Multi-Model Operator Network** — Permissionless staked `HUNTER` and `JUDGE` operators with cross-provider LLM quorums and automated bounty settlement.
- **Phase 04 · Slashing Court & Autonomous AI Guardrails** — Collateralized dispute windows, bond slashing, and pre-execution guardrails for autonomous agents.

---

## Links

- **Website & Arena:** [https://alastor.tech](https://alastor.tech)
- **Proof Registry & Local Verifier:** [https://alastor.tech/proofs](https://alastor.tech/proofs)
- **Documentation:** [https://alastor.tech/docs](https://alastor.tech/docs)
- **X (Twitter):** [https://x.com/alastortech](https://x.com/alastortech)

## License

Released under the [MIT License](./LICENSE).
