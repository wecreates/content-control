#!/usr/bin/env python3
"""Verify captured owner-onboarding evidence against one deployed source commit.

The verifier is deliberately offline and read-only.  It consumes already
captured JSON responses; it never signs in, contacts a provider, starts a job,
deploys, publishes, or writes a receipt.  A successful result proves only the
sanitized onboarding observation described in the report.  It does not prove
phone playback, durable delivery, creative quality, or full audiovisual
acceptance.
"""
import argparse
import json
import re
import time
from pathlib import Path


SOURCE_COMMIT = re.compile(r"[0-9a-f]{40}")
SAFE_INTEGER_MAX = 2**53 - 1
READ_OPERATIONS = {"read_profile", "read_media", "read_analytics"}
PROVIDERS = {"youtube", "instagram"}
MAX_CAPTURE_AGE_MS = 300_000
MAX_RESPONSE_SKEW_MS = 30_000
ONBOARDING_KEYS = {
    "scope", "onboarding_journey", "providers", "publication_enabled",
    "external_writes_enabled", "worker_status", "deployed_source_commit",
    "observed_at",
}
JOURNEY_KEYS = {
    "status", "signup_status", "signup_completed_at", "provider_verified_at",
    "first_successful_job_completed_at", "publication_enabled",
    "external_writes_enabled", "scope",
}
PROVIDER_KEYS = {
    "platform", "status", "provider_verified", "first_read_completed_at",
    "first_read_operation", "first_read_job_status",
}


def _safe_timestamp(value):
    return (not isinstance(value, bool) and isinstance(value, int)
            and 0 < value <= SAFE_INTEGER_MAX)


def _exact_keys(value, allowed):
    return isinstance(value, dict) and set(value).issubset(allowed)


def evaluate(onboarding, readiness, expected_source_commit, verification_time=None):
    """Return a secret-safe, fail-closed acceptance report."""
    onboarding = onboarding if isinstance(onboarding, dict) else {}
    readiness = readiness if isinstance(readiness, dict) else {}
    journey = onboarding.get("onboarding_journey")
    journey = journey if isinstance(journey, dict) else {}
    providers = onboarding.get("providers")
    providers = providers if isinstance(providers, list) else []

    expected_valid = (isinstance(expected_source_commit, str)
                      and SOURCE_COMMIT.fullmatch(expected_source_commit) is not None)
    readiness_source = readiness.get("deployed_source_commit")
    onboarding_source = onboarding.get("deployed_source_commit")
    onboarding_observed_at = onboarding.get("observed_at")
    readiness_observed_at = readiness.get("observed_at")
    if verification_time is None:
        verification_time = int(time.time() * 1000)
    verification_time_valid = _safe_timestamp(verification_time)
    onboarding_time_valid = _safe_timestamp(onboarding_observed_at)
    readiness_time_valid = _safe_timestamp(readiness_observed_at)
    observations_not_future = (verification_time_valid and onboarding_time_valid
                               and readiness_time_valid
                               and max(onboarding_observed_at, readiness_observed_at) <= verification_time)
    observations_fresh = (observations_not_future
                          and verification_time - min(onboarding_observed_at, readiness_observed_at)
                          <= MAX_CAPTURE_AGE_MS)
    observations_same_window = (onboarding_time_valid and readiness_time_valid
                                and abs(onboarding_observed_at - readiness_observed_at)
                                <= MAX_RESPONSE_SKEW_MS)
    provider_shapes_safe = (len(providers) > 0 and all(
        _exact_keys(provider, PROVIDER_KEYS) for provider in providers
    ))
    platforms = [provider.get("platform") for provider in providers
                 if isinstance(provider, dict)]
    provider_set_safe = (provider_shapes_safe and len(platforms) == len(set(platforms))
                         and all(platform in PROVIDERS for platform in platforms))

    retained = []
    if provider_set_safe:
        retained = [provider for provider in providers
                    if provider.get("provider_verified") is True
                    and provider.get("status") == "FIRST_READ_RETAINED"
                    and provider.get("first_read_job_status") == "COMPLETED"
                    and provider.get("first_read_operation") in READ_OPERATIONS
                    and _safe_timestamp(provider.get("first_read_completed_at"))]

    signup_at = journey.get("signup_completed_at")
    provider_verified_at = journey.get("provider_verified_at")
    first_job_at = journey.get("first_successful_job_completed_at")
    timestamps_valid = all(_safe_timestamp(value)
                           for value in (signup_at, provider_verified_at, first_job_at))
    timestamps_ordered = timestamps_valid and signup_at <= provider_verified_at <= first_job_at
    retained_matches = (timestamps_ordered and any(
        provider["first_read_completed_at"] == first_job_at for provider in retained
    ))

    checks = {
        "expected_source_commit_valid": expected_valid,
        "readiness_source_commit_exact": expected_valid and readiness_source == expected_source_commit,
        "onboarding_source_commit_exact": expected_valid and onboarding_source == expected_source_commit,
        "response_source_identity_same": (expected_valid and onboarding_source == readiness_source
                                           and onboarding_source == expected_source_commit),
        "response_observation_times_valid": onboarding_time_valid and readiness_time_valid,
        "response_observations_not_future": observations_not_future,
        "response_observations_fresh": observations_fresh,
        "response_observations_same_window": observations_same_window,
        "readiness_green": readiness.get("ok") is True,
        "readiness_publication_disabled": readiness.get("publication") is False,
        "readiness_production_approval_disabled": readiness.get("production_approved") is False,
        "onboarding_shape_secret_safe": _exact_keys(onboarding, ONBOARDING_KEYS),
        "journey_shape_secret_safe": _exact_keys(journey, JOURNEY_KEYS),
        "provider_shapes_secret_safe": provider_set_safe,
        "onboarding_publication_disabled": onboarding.get("publication_enabled") is False,
        "onboarding_external_writes_disabled": onboarding.get("external_writes_enabled") is False,
        "journey_publication_disabled": journey.get("publication_enabled") is False,
        "journey_external_writes_disabled": journey.get("external_writes_enabled") is False,
        "scheduler_active": onboarding.get("worker_status") == "SCHEDULER_ACTIVE",
        "signup_retained": journey.get("signup_status") == "OWNER_IDENTITY_RETAINED",
        "journey_complete": journey.get("status") == "COMPLETE",
        "journey_timestamps_ordered": timestamps_ordered,
        "current_grant_first_read_retained": retained_matches,
    }
    status = "PASS" if all(checks.values()) else "FAIL"
    passing_provider = next((provider for provider in retained
                             if provider["first_read_completed_at"] == first_job_at), None)
    return {
        "schema_version": 1,
        "status": status,
        "onboarding_observed_at": onboarding_observed_at if onboarding_time_valid else None,
        "readiness_observed_at": readiness_observed_at if readiness_time_valid else None,
        "verified_at": verification_time if verification_time_valid else None,
        "expected_source_commit": expected_source_commit if expected_valid else None,
        "deployed_source_commit": readiness_source if SOURCE_COMMIT.fullmatch(str(readiness_source or "")) else None,
        "onboarding_status": journey.get("status") if isinstance(journey.get("status"), str) else None,
        "completed_provider": passing_provider.get("platform") if passing_provider else None,
        "signup_completed_at": signup_at if _safe_timestamp(signup_at) else None,
        "provider_verified_at": provider_verified_at if _safe_timestamp(provider_verified_at) else None,
        "first_successful_job_completed_at": first_job_at if _safe_timestamp(first_job_at) else None,
        "checks": checks,
        "failed_checks": [name for name, passed in checks.items() if not passed],
        "publication_enabled": False,
        "external_writes_enabled": False,
        "full_av_verified": False,
        "phone_playback_verified": False,
        "durable_delivery_verified": False,
        "scope": "Captured deployed-source and owner onboarding evidence only.",
    }


def _load(path):
    try:
        return json.loads(path.read_text())
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise SystemExit(f"Cannot read captured JSON: {error}") from error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("onboarding", type=Path,
                        help="captured owner-only /api/social/onboarding JSON")
    parser.add_argument("readiness", type=Path,
                        help="captured /readyz JSON from the same deployment")
    parser.add_argument("expected_source_commit")
    args = parser.parse_args()
    report = evaluate(_load(args.onboarding), _load(args.readiness),
                      args.expected_source_commit)
    print(json.dumps(report, sort_keys=True))
    raise SystemExit(0 if report["status"] == "PASS" else 2)


if __name__ == "__main__":
    main()
