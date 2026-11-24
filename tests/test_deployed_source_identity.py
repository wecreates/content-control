import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from scripts.verify_deployed_source_identity import evaluate


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/verify_deployed_source_identity.py"
EXPECTED = "a" * 40


class DeployedSourceIdentityTests(unittest.TestCase):
    def test_exact_canonical_identity_is_required(self):
        report = evaluate({"ok": True, "hashBound": True,
                           "deployed_source_commit": EXPECTED}, EXPECTED)
        self.assertTrue(report["source_identity_verified"])
        self.assertIsNone(report["reason"])

    def test_readiness_and_media_cannot_replace_source_identity(self):
        for observed in (None, "", "A" * 40, "b" * 40, "a" * 39):
            with self.subTest(observed=observed):
                payload = {"ok": True, "hashBound": True,
                           "expectedSha256": "c" * 64, "actualSha256": "c" * 64,
                           "deployed_source_commit": observed}
                self.assertFalse(evaluate(payload, EXPECTED)["source_identity_verified"])

    def test_invalid_expected_identity_fails_closed(self):
        for expected in (None, "", "A" * 40, "a" * 39):
            with self.subTest(expected=expected):
                report = evaluate({"deployed_source_commit": EXPECTED}, expected)
                self.assertFalse(report["source_identity_verified"])
                self.assertEqual(report["reason"], "expected_source_commit_invalid")

    def test_cli_is_read_only_and_uses_distinct_exit_status(self):
        with tempfile.TemporaryDirectory() as tmp:
            payload = Path(tmp) / "readyz.json"
            payload.write_text(json.dumps({"deployed_source_commit": EXPECTED}))
            before = payload.read_bytes()
            passed = subprocess.run([sys.executable, str(SCRIPT), str(payload), EXPECTED],
                                    text=True, capture_output=True)
            self.assertEqual(passed.returncode, 0, passed.stderr)
            failed = subprocess.run([sys.executable, str(SCRIPT), str(payload), "b" * 40],
                                    text=True, capture_output=True)
            self.assertEqual(failed.returncode, 2, failed.stderr)
            self.assertEqual(payload.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
