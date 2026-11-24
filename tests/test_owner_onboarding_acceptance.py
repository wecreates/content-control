import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest

from scripts.verify_owner_onboarding_acceptance import evaluate


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/verify_owner_onboarding_acceptance.py"
EXPECTED = "a" * 40
CAPTURED_AT = 1_700_000_000_000
VERIFIED_AT = CAPTURED_AT + 1_000


def valid_inputs():
    onboarding = {
        "scope": "Owner OAuth configuration and retained evidence for the current grant.",
        "onboarding_journey": {
            "status": "COMPLETE",
            "signup_status": "OWNER_IDENTITY_RETAINED",
            "signup_completed_at": 1000,
            "provider_verified_at": 2000,
            "first_successful_job_completed_at": 3000,
            "publication_enabled": False,
            "external_writes_enabled": False,
            "scope": "Sanitized chronological onboarding evidence.",
        },
        "providers": [{
            "platform": "youtube",
            "status": "FIRST_READ_RETAINED",
            "provider_verified": True,
            "first_read_completed_at": 3000,
            "first_read_operation": "read_profile",
            "first_read_job_status": "COMPLETED",
        }, {
            "platform": "instagram",
            "status": "PROVIDER_CONFIGURATION_REQUIRED",
            "provider_verified": False,
            "first_read_completed_at": None,
            "first_read_operation": None,
            "first_read_job_status": None,
        }],
        "publication_enabled": False,
        "external_writes_enabled": False,
        "worker_status": "SCHEDULER_ACTIVE",
        "deployed_source_commit": EXPECTED,
        "observed_at": CAPTURED_AT,
    }
    readiness = {
        "ok": True,
        "deployed_source_commit": EXPECTED,
        "observed_at": CAPTURED_AT + 10,
        "production_approved": False,
        "publication": False,
    }
    return onboarding, readiness


class OwnerOnboardingAcceptanceTests(unittest.TestCase):
    def test_complete_journey_is_bound_to_exact_deployed_source(self):
        onboarding, readiness = valid_inputs()
        report = evaluate(onboarding, readiness, EXPECTED, VERIFIED_AT)
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(report["completed_provider"], "youtube")
        self.assertEqual(report["onboarding_observed_at"], CAPTURED_AT)
        self.assertEqual(report["readiness_observed_at"], CAPTURED_AT + 10)
        self.assertEqual(report["verified_at"], VERIFIED_AT)
        self.assertEqual(report["failed_checks"], [])
        self.assertFalse(report["full_av_verified"])
        self.assertFalse(report["phone_playback_verified"])
        self.assertFalse(report["durable_delivery_verified"])

    def test_http_green_cannot_replace_exact_source_identity(self):
        onboarding, readiness = valid_inputs()
        for observed in (None, "", "A" * 40, "b" * 40, "a" * 39):
            with self.subTest(observed=observed):
                readiness["deployed_source_commit"] = observed
                report = evaluate(onboarding, readiness, EXPECTED, VERIFIED_AT)
                self.assertEqual(report["status"], "FAIL")
                self.assertIn("readiness_source_commit_exact", report["failed_checks"])

    def test_onboarding_from_another_deployment_cannot_borrow_green_readiness(self):
        onboarding, readiness = valid_inputs()
        onboarding["deployed_source_commit"] = "b" * 40
        report = evaluate(onboarding, readiness, EXPECTED, VERIFIED_AT)
        self.assertEqual(report["status"], "FAIL")
        self.assertIn("onboarding_source_commit_exact", report["failed_checks"])
        self.assertIn("response_source_identity_same", report["failed_checks"])

    def test_stale_or_future_onboarding_capture_cannot_be_made_fresh_by_verifier(self):
        onboarding, readiness = valid_inputs()
        onboarding["observed_at"] = VERIFIED_AT - 300_001
        readiness["observed_at"] = VERIFIED_AT - 300_000
        report = evaluate(onboarding, readiness, EXPECTED, VERIFIED_AT)
        self.assertEqual(report["status"], "FAIL")
        self.assertIn("response_observations_fresh", report["failed_checks"])

        onboarding, readiness = valid_inputs()
        onboarding["observed_at"] = VERIFIED_AT + 1
        readiness["observed_at"] = VERIFIED_AT
        report = evaluate(onboarding, readiness, EXPECTED, VERIFIED_AT)
        self.assertEqual(report["status"], "FAIL")
        self.assertIn("response_observations_not_future", report["failed_checks"])

    def test_responses_outside_one_capture_window_fail(self):
        onboarding, readiness = valid_inputs()
        readiness["observed_at"] = onboarding["observed_at"] + 30_001
        report = evaluate(onboarding, readiness, EXPECTED, VERIFIED_AT + 30_000)
        self.assertEqual(report["status"], "FAIL")
        self.assertIn("response_observations_same_window", report["failed_checks"])

    def test_incomplete_journey_stages_do_not_pass(self):
        for status in ("SIGNUP_REQUIRED", "CONNECTION_REQUIRED", "FIRST_JOB_REQUIRED"):
            with self.subTest(status=status):
                onboarding, readiness = valid_inputs()
                onboarding["onboarding_journey"]["status"] = status
                report = evaluate(onboarding, readiness, EXPECTED, VERIFIED_AT)
                self.assertEqual(report["status"], "FAIL")
                self.assertIn("journey_complete", report["failed_checks"])

    def test_scheduler_and_current_grant_read_are_required(self):
        onboarding, readiness = valid_inputs()
        onboarding["worker_status"] = "DISABLED"
        onboarding["providers"][0]["first_read_completed_at"] = 2999
        report = evaluate(onboarding, readiness, EXPECTED, VERIFIED_AT)
        self.assertEqual(report["status"], "FAIL")
        self.assertIn("scheduler_active", report["failed_checks"])
        self.assertIn("current_grant_first_read_retained", report["failed_checks"])

    def test_chronology_must_be_safe_and_ordered(self):
        for timestamps in ((2000, 1000, 3000), (1000, 3000, 2000),
                           (True, 2000, 3000), (1000, 2000, 2**53)):
            with self.subTest(timestamps=timestamps):
                onboarding, readiness = valid_inputs()
                journey = onboarding["onboarding_journey"]
                journey["signup_completed_at"], journey["provider_verified_at"], journey["first_successful_job_completed_at"] = timestamps
                report = evaluate(onboarding, readiness, EXPECTED, VERIFIED_AT)
                self.assertEqual(report["status"], "FAIL")
                self.assertIn("journey_timestamps_ordered", report["failed_checks"])

    def test_unexpected_fields_fail_closed_without_echoing_private_values(self):
        onboarding, readiness = valid_inputs()
        onboarding["account_id"] = "PRIVATE_ACCOUNT"
        onboarding["providers"][0]["access_token"] = "PRIVATE_TOKEN"
        onboarding["onboarding_journey"]["job_id"] = "PRIVATE_JOB"
        report = evaluate(onboarding, readiness, EXPECTED, VERIFIED_AT)
        encoded = json.dumps(report)
        self.assertEqual(report["status"], "FAIL")
        self.assertFalse(report["checks"]["onboarding_shape_secret_safe"])
        self.assertFalse(report["checks"]["journey_shape_secret_safe"])
        self.assertFalse(report["checks"]["provider_shapes_secret_safe"])
        for private in ("PRIVATE_ACCOUNT", "PRIVATE_TOKEN", "PRIVATE_JOB"):
            self.assertNotIn(private, encoded)

    def test_enabled_write_or_approval_gate_fails(self):
        onboarding, readiness = valid_inputs()
        onboarding["publication_enabled"] = True
        onboarding["external_writes_enabled"] = True
        readiness["publication"] = True
        readiness["production_approved"] = True
        report = evaluate(onboarding, readiness, EXPECTED, VERIFIED_AT)
        self.assertEqual(report["status"], "FAIL")
        self.assertFalse(report["checks"]["readiness_publication_disabled"])
        self.assertFalse(report["checks"]["readiness_production_approval_disabled"])
        self.assertFalse(report["checks"]["onboarding_publication_disabled"])
        self.assertFalse(report["checks"]["onboarding_external_writes_disabled"])

    def test_cli_is_read_only_and_uses_distinct_failure_status(self):
        onboarding, readiness = valid_inputs()
        now = int(time.time() * 1000)
        onboarding["observed_at"] = now
        readiness["observed_at"] = now
        with tempfile.TemporaryDirectory() as tmp:
            onboarding_path = Path(tmp) / "onboarding.json"
            readiness_path = Path(tmp) / "readyz.json"
            onboarding_path.write_text(json.dumps(onboarding))
            readiness_path.write_text(json.dumps(readiness))
            before = (onboarding_path.read_bytes(), readiness_path.read_bytes())
            passed = subprocess.run(
                [sys.executable, str(SCRIPT), str(onboarding_path),
                 str(readiness_path), EXPECTED], text=True, capture_output=True,
            )
            self.assertEqual(passed.returncode, 0, passed.stderr)
            self.assertEqual(json.loads(passed.stdout)["status"], "PASS")
            failed = subprocess.run(
                [sys.executable, str(SCRIPT), str(onboarding_path),
                 str(readiness_path), "b" * 40], text=True, capture_output=True,
            )
            self.assertEqual(failed.returncode, 2, failed.stderr)
            self.assertEqual((onboarding_path.read_bytes(), readiness_path.read_bytes()), before)


if __name__ == "__main__":
    unittest.main()
