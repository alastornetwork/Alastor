from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from alastor import canonicalize_jcs, check_percentage_claim, verify_proof_dict, verify_proof_file

VECTOR_PATH = Path(__file__).resolve().parents[3] / "vectors" / "sample-proof-v1.json"


class TestAlastorPythonVerifier(unittest.TestCase):
    def test_jcs_key_ordering_and_escaping(self) -> None:
        raw = {"z": 1, "a": [True, False, None], "nested": {"beta": "line\nbreak", "alpha": "ok"}}
        expected = '{"a":[true,false,null],"nested":{"alpha":"ok","beta":"line\\nbreak"},"z":1}'
        self.assertEqual(canonicalize_jcs(raw), expected)

    def test_sample_proof_vector_is_valid(self) -> None:
        report = verify_proof_file(VECTOR_PATH)
        self.assertTrue(report.self_consistent)
        self.assertEqual(report.embedded_digest, report.recomputed_digest)
        self.assertEqual(len(report.errors), 0)

    def test_tampered_claim_fails_verification(self) -> None:
        doc = json.loads(VECTOR_PATH.read_text(encoding="utf-8"))
        tampered = copy.deepcopy(doc)
        tampered["payload"]["claimText"] = "Tampered claim text after signing."
        report = verify_proof_dict(tampered, trusted_registry_digest=doc["digest"]["value"])
        self.assertFalse(report.self_consistent)
        self.assertFalse(report.matches_trusted_digest)

    def test_40_digit_percentage_discrepancy(self) -> None:
        result = check_percentage_claim(initial="1,000,000", final="750,000", claimed_pct="-33.3")
        self.assertEqual(result["computed_pct"], "-25")
        self.assertFalse(result["consistent"])


if __name__ == "__main__":
    unittest.main()
