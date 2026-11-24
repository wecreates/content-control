#!/usr/bin/env python3
"""Bind deployed preview, durable delivery, and phone-playback evidence.

This verifier is offline and read-only. It does not deploy, play, publish, or
approve a video. A PASS means the captured receipts and the retained phone
evidence file agree on one source commit, candidate, captions, and externally
supplied delivery identity. The recording still needs independent audiovisual
review before phone playback or creative acceptance can be claimed.
"""
import argparse
import hashlib
import json
import math
import re
import time
from pathlib import Path


SHA256 = re.compile(r"[0-9a-f]{64}")
SOURCE_COMMIT = re.compile(r"[0-9a-f]{40}")
JOB_ID = re.compile(r"[A-Za-z0-9_-]{1,64}")
SAFE_INTEGER_MAX = 2**53 - 1
MAX_CAPTURE_AGE_MS = 30 * 60 * 1000
MAX_CAPTURE_SKEW_MS = 5 * 60 * 1000
MAX_EVIDENCE_BYTES = 1024 * 1024 * 1024
FALSE_GATES = {
    "publication_enabled", "paid_generation_enabled", "production_ready",
    "production_approved", "full_av_review",
}
READINESS_KEYS = {
    "ok", "deployed_source_commit", "observed_at", "production_approved", "id",
    "engine", "publication", "qaStatus", "expectedSha256", "actualSha256",
    "hashBound", "captionReady", "captionSha256", "captionCandidateSha256",
    "identityConsistent", "identityFailedChecks", "watchUrl", "mediaUrl",
    "captionsUrl", "renderStatus",
}
DELIVERY_KEYS = {
    "schema_version", "status", *FALSE_GATES, "candidate_sha256", "archive",
    "archive_sha256", "entrypoint", "entrypoint_sha256", "package_sha256",
    "files_sha256", "delivery_identity_sha256", "provenance", "scope",
}
VERIFICATION_KEYS = {
    "schema_version", "status", *FALSE_GATES, "candidate_sha256",
    "package_sha256", "archive_sha256", "entrypoint", "entrypoint_sha256",
    "delivery_identity_sha256", "scope",
}
PHONE_KEYS = {
    "schema_version", "status", "evidence_type", "evidence_sha256",
    "observed_at", "deployed_source_commit", "candidate_sha256",
    "caption_sha256", "delivery_identity_sha256", "media_duration_seconds",
    "played_duration_seconds", "playback_started", "playback_completed",
    "audio_heard", "captions_visible", "inline_playback",
    "observer_attestation", "publication_enabled", "external_writes_enabled",
}


def _exact(value, keys):
    return isinstance(value, dict) and set(value) == keys


def _safe_timestamp(value):
    return (type(value) is int and 0 < value <= SAFE_INTEGER_MAX)


def _duration(value):
    return type(value) in (int, float) and math.isfinite(value) and value > 0


def _false_gates(value):
    return all(value.get(key) is False for key in FALSE_GATES)


def _delivery_identity(delivery):
    """Rebuild the Money Factory cycle export identity from its canonical fields."""
    provenance = delivery.get("provenance")
    files = delivery.get("files_sha256")
    if not isinstance(provenance, dict) or not isinstance(files, dict):
        return None
    job_id = provenance.get("job_id")
    job_digest = provenance.get("job_digest")
    attempt = provenance.get("attempt")
    if (not isinstance(job_id, str) or JOB_ID.fullmatch(job_id) is None
            or not isinstance(job_digest, str) or SHA256.fullmatch(job_digest) is None
            or type(attempt) is not int or attempt < 1):
        return None

    identity = {
        "job_id": job_id,
        "job_digest": job_digest,
        "attempt": attempt,
        "candidate_sha256": delivery.get("candidate_sha256"),
        "package_sha256": delivery.get("package_sha256"),
        "archive_sha256": delivery.get("archive_sha256"),
        "entrypoint": delivery.get("entrypoint"),
        "entrypoint_sha256": delivery.get("entrypoint_sha256"),
        "files_sha256": files,
        "provenance": provenance,
        **{key: delivery.get(key) for key in FALSE_GATES},
    }
    try:
        serialized = json.dumps(identity, sort_keys=True, separators=(",", ":"), allow_nan=False)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    except (TypeError, ValueError, RecursionError):
        return None


def evaluate(readiness, delivery, verified_delivery, phone, expected_source_commit,
             expected_delivery_identity, observed_evidence_sha256,
             verification_time=None):
    """Return a fail-closed, secret-safe evidence-coherence report."""
    readiness = readiness if isinstance(readiness, dict) else {}
    delivery = delivery if isinstance(delivery, dict) else {}
    verified_delivery = verified_delivery if isinstance(verified_delivery, dict) else {}
    phone = phone if isinstance(phone, dict) else {}
    files = delivery.get("files_sha256")
    files = files if isinstance(files, dict) else {}
    if verification_time is None:
        verification_time = int(time.time() * 1000)

    source_valid = (isinstance(expected_source_commit, str)
                    and SOURCE_COMMIT.fullmatch(expected_source_commit) is not None)
    delivery_identity_valid = (isinstance(expected_delivery_identity, str)
                               and SHA256.fullmatch(expected_delivery_identity) is not None)
    recomputed_delivery_identity = _delivery_identity(delivery)
    evidence_hash_valid = (isinstance(observed_evidence_sha256, str)
                           and SHA256.fullmatch(observed_evidence_sha256) is not None)
    candidate = readiness.get("actualSha256")
    captions = readiness.get("captionSha256")
    candidate_valid = isinstance(candidate, str) and SHA256.fullmatch(candidate) is not None
    captions_valid = isinstance(captions, str) and SHA256.fullmatch(captions) is not None
    ready_at = readiness.get("observed_at")
    phone_at = phone.get("observed_at")
    now_valid = _safe_timestamp(verification_time)
    times_valid = _safe_timestamp(ready_at) and _safe_timestamp(phone_at)
    times_not_future = times_valid and now_valid and max(ready_at, phone_at) <= verification_time
    times_fresh = (times_not_future
                   and verification_time - min(ready_at, phone_at) <= MAX_CAPTURE_AGE_MS)
    times_same_window = times_valid and abs(ready_at - phone_at) <= MAX_CAPTURE_SKEW_MS
    media_duration = phone.get("media_duration_seconds")
    played_duration = phone.get("played_duration_seconds")
    duration_complete = (_duration(media_duration) and _duration(played_duration)
                         and played_duration + 0.5 >= media_duration
                         and played_duration <= media_duration + 5)
    primary_delivery_hashes = (
        delivery.get("package_sha256"), delivery.get("archive_sha256"),
        delivery.get("entrypoint_sha256"),
        verified_delivery.get("package_sha256"), verified_delivery.get("archive_sha256"),
        verified_delivery.get("entrypoint_sha256"),
    )

    checks = {
        "expected_source_commit_valid": source_valid,
        "expected_delivery_identity_valid": delivery_identity_valid,
        "observed_phone_evidence_hash_valid": evidence_hash_valid,
        "readiness_shape_exact": _exact(readiness, READINESS_KEYS),
        "delivery_shape_exact": _exact(delivery, DELIVERY_KEYS),
        "delivery_verification_shape_exact": _exact(verified_delivery, VERIFICATION_KEYS),
        "phone_observation_shape_exact": _exact(phone, PHONE_KEYS),
        "readiness_exact_source": source_valid and readiness.get("deployed_source_commit") == expected_source_commit,
        "phone_exact_source": source_valid and phone.get("deployed_source_commit") == expected_source_commit,
        "readiness_fresh": times_fresh,
        "readiness_phone_same_window": times_same_window,
        "readiness_green": (readiness.get("ok") is True
                            and readiness.get("qaStatus") == "GREEN"
                            and readiness.get("hashBound") is True
                            and readiness.get("captionReady") is True),
        "readiness_identity_consistent": (readiness.get("identityConsistent") is True
                                          and readiness.get("identityFailedChecks") == []),
        "readiness_canonical_route_bound": (
            candidate_valid and captions_valid
            and readiness.get("id") == "episode1-v10-free"
            and readiness.get("engine") == "remotion-v10-free"
            and readiness.get("watchUrl") == f"/watch?sha256={candidate}&caption_sha256={captions}"
            and readiness.get("mediaUrl") == f"/media?sha256={candidate}"
            and readiness.get("captionsUrl") == f"/captions?sha256={captions}"
        ),
        "readiness_publication_disabled": (readiness.get("publication") is False
                                            and readiness.get("production_approved") is False),
        "readiness_candidate_bound": (candidate_valid
                                      and candidate == readiness.get("expectedSha256")
                                      and candidate == readiness.get("captionCandidateSha256")),
        "readiness_caption_bound": captions_valid,
        "delivery_receipt_unpublished": (delivery.get("schema_version") == 1
                                         and delivery.get("status") == "AWAITING_REVIEW"
                                         and _false_gates(delivery)
                                         and delivery.get("archive") == "review-package.zip"
                                         and delivery.get("entrypoint") == "review/index.html"
                                         and delivery.get("scope") == "Exact unpublished private preview delivery; playback and creative acceptance remain unverified"),
        "delivery_verifier_passed": (verified_delivery.get("schema_version") == 1
                                     and verified_delivery.get("status") == "PASS"
                                     and _false_gates(verified_delivery)
                                     and verified_delivery.get("entrypoint") == "review/index.html"
                                     and verified_delivery.get("scope") == "Caller-supplied delivery identity matched durable private bytes; playback and creative acceptance remain unverified"),
        "delivery_identity_exact": (delivery_identity_valid
                                    and delivery.get("delivery_identity_sha256") == expected_delivery_identity
                                    and verified_delivery.get("delivery_identity_sha256") == expected_delivery_identity),
        "delivery_identity_recomputed": (delivery_identity_valid
                                         and recomputed_delivery_identity == expected_delivery_identity),
        "delivery_candidate_exact": (candidate is not None
                                     and delivery.get("candidate_sha256") == candidate
                                     and verified_delivery.get("candidate_sha256") == candidate
                                     and files.get("review/video.mp4") == candidate),
        "delivery_caption_exact": captions is not None and files.get("review/captions.vtt") == captions,
        "delivery_primary_identities_exact": (
            all(SHA256.fullmatch(str(value or "")) for value in primary_delivery_hashes)
            and delivery.get("package_sha256") == verified_delivery.get("package_sha256")
            and delivery.get("archive_sha256") == verified_delivery.get("archive_sha256")
            and delivery.get("entrypoint") == verified_delivery.get("entrypoint")
            and delivery.get("entrypoint_sha256") == verified_delivery.get("entrypoint_sha256")
        ),
        "phone_receipt_passed": (phone.get("schema_version") == 1
                                 and phone.get("status") == "PASS"
                                 and phone.get("evidence_type") == "PHYSICAL_PHONE_SCREEN_RECORDING"
                                 and phone.get("observer_attestation") == "HUMAN_OBSERVED_COMPLETE_PLAYBACK"),
        "phone_evidence_file_exact": (evidence_hash_valid
                                      and phone.get("evidence_sha256") == observed_evidence_sha256),
        "phone_identities_exact": (phone.get("candidate_sha256") == candidate
                                   and phone.get("caption_sha256") == captions
                                   and phone.get("delivery_identity_sha256") == expected_delivery_identity),
        "phone_complete_playback_attested": (phone.get("playback_started") is True
                                             and phone.get("playback_completed") is True
                                             and phone.get("audio_heard") is True
                                             and phone.get("captions_visible") is True
                                             and phone.get("inline_playback") is True
                                             and duration_complete),
        "phone_writes_disabled": (phone.get("publication_enabled") is False
                                  and phone.get("external_writes_enabled") is False),
    }
    passed = all(checks.values())
    return {
        "schema_version": 1,
        "status": "PASS" if passed else "FAIL",
        "verified_at": verification_time if now_valid else None,
        "readiness_observed_at": ready_at if _safe_timestamp(ready_at) else None,
        "phone_observed_at": phone_at if _safe_timestamp(phone_at) else None,
        "expected_source_commit": expected_source_commit if source_valid else None,
        "deployed_source_commit": (readiness.get("deployed_source_commit")
                                   if SOURCE_COMMIT.fullmatch(str(readiness.get("deployed_source_commit") or "")) else None),
        "candidate_sha256": candidate if candidate_valid else None,
        "caption_sha256": captions if captions_valid else None,
        "delivery_identity_sha256": expected_delivery_identity if delivery_identity_valid else None,
        "phone_evidence_sha256": observed_evidence_sha256 if evidence_hash_valid else None,
        "checks": checks,
        "failed_checks": [name for name, passed_check in checks.items() if not passed_check],
        "publication_enabled": False,
        "external_writes_enabled": False,
        "phone_playback_receipt_bound": passed,
        "durable_delivery_receipt_bound": passed,
        "phone_playback_verified": False,
        "full_av_verified": False,
        "independent_evidence_review_required": True,
        "scope": "Receipt and evidence-file identity coherence only; independent phone audiovisual review remains required.",
    }


def _load(path):
    try:
        return json.loads(path.read_text())
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise SystemExit(f"Cannot read captured JSON: {error}") from error


def _evidence_digest(path):
    try:
        absolute = path.absolute()
        if any(item.is_symlink() for item in (absolute, *absolute.parents)):
            raise ValueError("symlinks are not permitted in phone evidence paths")
        resolved = absolute.resolve(strict=True)
        size = resolved.stat().st_size
        if not resolved.is_file() or not 0 < size <= MAX_EVIDENCE_BYTES:
            raise ValueError("phone evidence must be a regular file within the size limit")
        digest = hashlib.sha256()
        with resolved.open("rb") as stream:
            while chunk := stream.read(1024 * 1024):
                digest.update(chunk)
        return digest.hexdigest()
    except (OSError, ValueError) as error:
        raise SystemExit(f"Cannot read phone evidence: {error}") from error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("readiness", type=Path, help="captured deployed /readyz JSON")
    parser.add_argument("delivery", type=Path, help="retained private delivery package.json")
    parser.add_argument("verified_delivery", type=Path,
                        help="output of Money-factory review_delivery verify")
    parser.add_argument("phone", type=Path, help="structured physical-phone observation JSON")
    parser.add_argument("phone_evidence", type=Path, help="retained physical-phone screen recording")
    parser.add_argument("expected_source_commit")
    parser.add_argument("expected_delivery_identity")
    args = parser.parse_args()
    report = evaluate(
        _load(args.readiness), _load(args.delivery), _load(args.verified_delivery),
        _load(args.phone), args.expected_source_commit, args.expected_delivery_identity,
        _evidence_digest(args.phone_evidence),
    )
    print(json.dumps(report, sort_keys=True))
    raise SystemExit(0 if report["status"] == "PASS" else 2)


if __name__ == "__main__":
    main()
