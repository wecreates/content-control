#!/usr/bin/env python3
"""Verify a captured deployment payload against one exact expected source commit.

This verifier is intentionally read-only.  HTTP readiness and media evidence are
inputs to other gates; neither can substitute for a present, canonical source
identity that exactly matches the expected commit.
"""
import argparse
import json
import re
from pathlib import Path


SOURCE_COMMIT = re.compile(r"[0-9a-f]{40}")


def evaluate(payload, expected_source_commit):
    observed = payload.get("deployed_source_commit") if isinstance(payload, dict) else None
    expected_valid = (isinstance(expected_source_commit, str)
                      and SOURCE_COMMIT.fullmatch(expected_source_commit) is not None)
    observed_valid = (isinstance(observed, str)
                      and SOURCE_COMMIT.fullmatch(observed) is not None)
    exact_match = expected_valid and observed_valid and observed == expected_source_commit
    if not expected_valid:
        reason = "expected_source_commit_invalid"
    elif not observed_valid:
        reason = "deployed_source_commit_missing_or_invalid"
    elif not exact_match:
        reason = "deployed_source_commit_mismatch"
    else:
        reason = None
    return {
        "expected_source_commit": expected_source_commit,
        "deployed_source_commit": observed,
        "source_identity_verified": exact_match,
        "reason": reason,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("payload", type=Path)
    parser.add_argument("expected_source_commit")
    args = parser.parse_args()
    try:
        payload = json.loads(args.payload.read_text())
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise SystemExit(f"Cannot read deployment payload: {error}") from error
    report = evaluate(payload, args.expected_source_commit)
    print(json.dumps(report, sort_keys=True))
    raise SystemExit(0 if report["source_identity_verified"] else 2)


if __name__ == "__main__":
    main()
