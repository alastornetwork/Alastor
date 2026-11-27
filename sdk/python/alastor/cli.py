"""CLI entrypoint for verifying ALASTOR Proof of Error JSON documents."""

from __future__ import annotations

import argparse
import json
import sys

from .verifier import verify_proof_file


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="alastor-verify", description="Verify an ALASTOR Proof of Error JSON file")
    sub = parser.add_subparsers(dest="command", required=True)

    verify_cmd = sub.add_parser("verify", help="Recompute RFC 8785 + SHA-256 digest of a proof artifact")
    verify_cmd.add_argument("file", help="Path to exported .json Proof of Error document")
    verify_cmd.add_argument("--trusted-digest", default=None, help="Optional trusted registry SHA-256 hex digest")

    args = parser.parse_args(argv)
    if args.command == "verify":
        report = verify_proof_file(args.file, trusted_registry_digest=args.trusted_digest)
        print(
            json.dumps(
                {
                    "selfConsistent": report.self_consistent,
                    "matchesTrustedDigest": report.matches_trusted_digest,
                    "embeddedDigest": report.embedded_digest,
                    "recomputedDigest": report.recomputed_digest,
                    "canonicalBytes": report.canonical_bytes,
                    "errors": list(report.errors),
                },
                indent=2,
            )
        )
        return 0 if report.self_consistent and (report.matches_trusted_digest in (None, True)) else 1
    return 1


if __name__ == "__main__":
    sys.exit(main())
