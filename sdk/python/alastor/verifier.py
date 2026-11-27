"""Offline Proof of Error verifier, 40-digit Decimal evaluator, and Arena HTTP client."""

from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass
from decimal import Decimal, getcontext
from pathlib import Path
from typing import Any

from .jcs import sha256_jcs


@dataclass(frozen=True)
class ProofVerificationReport:
    self_consistent: bool
    matches_trusted_digest: bool | None
    embedded_digest: str
    recomputed_digest: str
    canonical_bytes: int
    errors: tuple[str, ...]


def verify_proof_dict(
    document: dict[str, Any],
    trusted_registry_digest: str | None = None,
) -> ProofVerificationReport:
    errors: list[str] = []
    payload = document.get("payload")
    digest_env = document.get("digest")

    if not isinstance(payload, dict):
        raise ValueError("Proof document missing 'payload' object")
    if not isinstance(digest_env, dict):
        raise ValueError("Proof document missing 'digest' object")

    if payload.get("schema") != "alastor.proof-of-error":
        errors.append(f"Unexpected schema: {payload.get('schema')}")

    evidence = payload.get("evidenceSummary")
    if not isinstance(evidence, list) or len(evidence) == 0:
        errors.append("Proof payload must include non-empty evidenceSummary")

    if digest_env.get("algorithm") != "SHA-256" or digest_env.get("canonicalization") != "RFC8785-JCS":
        errors.append("Unsupported digest envelope header")

    canonical_str, recomputed = sha256_jcs(payload)
    embedded = str(digest_env.get("value", "")).lower()

    if embedded != recomputed:
        errors.append(f"Digest mismatch: embedded={embedded} recomputed={recomputed}")

    matches_trusted: bool | None = None
    if trusted_registry_digest is not None:
        matches_trusted = recomputed == trusted_registry_digest.lower()
        if not matches_trusted:
            errors.append("Recomputed digest does not match trusted registry reference")

    return ProofVerificationReport(
        self_consistent=(len(errors) == 0 and embedded == recomputed),
        matches_trusted_digest=matches_trusted,
        embedded_digest=embedded,
        recomputed_digest=recomputed,
        canonical_bytes=len(canonical_str.encode("utf-8")),
        errors=tuple(errors),
    )


def verify_proof_file(
    path: str | Path,
    trusted_registry_digest: str | None = None,
) -> ProofVerificationReport:
    raw = Path(path).read_text(encoding="utf-8")
    doc = json.loads(raw)
    return verify_proof_dict(doc, trusted_registry_digest=trusted_registry_digest)


def check_percentage_claim(
    initial: str,
    final: str,
    claimed_pct: str,
    tolerance_pct_points: str = "0.05",
) -> dict[str, Any]:
    getcontext().prec = 40
    init_val = Decimal(initial.replace(",", "").replace("_", ""))
    fin_val = Decimal(final.replace(",", "").replace("_", ""))
    claimed_val = Decimal(claimed_pct.replace(",", "").replace("_", "").replace("%", ""))
    tol_val = Decimal(tolerance_pct_points)

    if init_val == 0:
        raise ZeroDivisionError("initial value cannot be zero")

    computed = ((fin_val - init_val) / init_val) * Decimal(100)
    delta = abs(computed - claimed_val)

    return {
        "computed_pct": format(computed.normalize(), "f"),
        "claimed_pct": format(claimed_val.normalize(), "f"),
        "delta_pct_points": format(delta.normalize(), "f"),
        "consistent": delta <= tol_val,
    }


class AlastorArenaClient:
    def __init__(self, base_url: str = "https://alastor.tech") -> None:
        self.base_url = base_url.rstrip("/")

    def export_proof(self, proof_id: str) -> dict[str, Any]:
        url = f"{self.base_url}/api/proofs/{proof_id}/export"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
