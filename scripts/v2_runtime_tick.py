#!/usr/bin/env python3
"""Validate a persisted preview; rendering belongs on the production worker.

A periodic web-host tick must never invoke Remotion, TTS, or replace a candidate.
Persisted QA assertions are not a fresh creative review. The metadata heuristic
in v2_orchestrator is structural preflight only and cannot approve a video.
"""
import hashlib
import json
import os
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public-review/v2-boss-fight.mp4"
HEALTH = ROOT / "state/v2-health.json"
RUNTIME_STATUS = ROOT / "state/v2-runtime-validation.json"


def validate_candidate(health_path, candidate_path, publication_enabled=False):
    reasons = []
    result = {
        "status": "BLOCKED", "mode": "persisted_artifact_validation",
        "publication_enabled": False, "updated_at": int(time.time()),
        "render_attempted": False, "fresh_creative_review": False,
        "qa_evidence_scope": "persisted assertions; no new media or creative review",
    }
    if publication_enabled:
        reasons.append("publication_enabled_environment")
    try:
        health = json.loads(Path(health_path).read_text())
        if not isinstance(health, dict):
            raise ValueError("health must be an object")
    except (OSError, ValueError) as exc:
        result.update(reasons=reasons + ["health_missing_or_invalid"], error=str(exc))
        return result
    if health.get("status") != "READY":
        reasons.append("persisted_candidate_not_accepted")
    if health.get("publication_enabled") is not False:
        reasons.append("publication_not_explicitly_disabled")
    for gate in ("technical_qa", "creative_qa", "visual_parity_qa"):
        if health.get(gate) is not True:
            reasons.append(gate + "_not_verified")
    # Legacy runtime generated creative_qa from these metadata-only metrics.
    # Preserve its record, but never interpret that heuristic as rendered review.
    review = health.get("creative_review")
    if "metrics" in health and not isinstance(review, dict):
        reasons.append("creative_evidence_is_metadata_only")
    if isinstance(review, dict):
        if review.get("status") != "PASS" or review.get("candidate_sha256") != health.get("candidate_sha256"):
            reasons.append("creative_review_not_hash_bound")
        if review.get("method") in ("metadata", "structural_preflight", "v2_orchestrator"):
            reasons.append("creative_evidence_is_metadata_only")
    expected = health.get("candidate_sha256")
    if not isinstance(expected, str) or len(expected) != 64 or any(c not in "0123456789abcdef" for c in expected):
        reasons.append("candidate_sha256_missing_or_invalid")
    try:
        digest = hashlib.sha256()
        size = 0
        with Path(candidate_path).open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                size += len(chunk)
                digest.update(chunk)
        actual = digest.hexdigest()
        result["candidate_sha256"] = actual
        if not size:
            reasons.append("candidate_empty")
        if actual != expected:
            reasons.append("candidate_sha256_mismatch")
    except OSError as exc:
        reasons.append("candidate_missing_or_unreadable")
        result["error"] = str(exc)
    result["reasons"] = reasons
    if not reasons:
        result["status"] = "READY"
    return result


def tick():
    result = validate_candidate(
        HEALTH, OUT,
        publication_enabled=os.getenv("PUBLICATION_ENABLED", "false").lower() != "false",
    )
    # Separate observational status; never overwrite acceptance evidence or video.
    RUNTIME_STATUS.parent.mkdir(parents=True, exist_ok=True)
    temporary = RUNTIME_STATUS.with_suffix(".tmp")
    temporary.write_text(json.dumps(result, indent=2) + "\n")
    temporary.replace(RUNTIME_STATUS)
    return result


if __name__ == "__main__":
    print(json.dumps(tick()))
