import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[1]
WATCHDOG = ROOT / ".github/workflows/free-production-watchdog.yml"
QA = ROOT / ".github/workflows/free-vision-qa.yml"
REGRESSION = ROOT / "scripts/enforce_free_qa_regression.py"
HEALTH = ROOT / "scripts/verify_free_production_health.py"

@contextlib.contextmanager
def working_directory(path):
    previous = Path.cwd()
    os.chdir(path)
    try:
        yield
    finally:
        os.chdir(previous)

def write_json(root, name, value):
    p = root / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, sort_keys=True) + "\n")
    return p

def run_routes(failed):
    source = WATCHDOG.read_text().split("          python - <<'PY' > /tmp/repair-workflows\n", 1)[1].split("\n          PY\n", 1)[0]
    with tempfile.TemporaryDirectory() as tmp, working_directory(tmp):
        write_json(Path(tmp), "state/free-production-watchdog.json", {"failed_checks": failed})
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            exec(compile(textwrap.dedent(source), str(WATCHDOG), "exec"), {})
        return set(output.getvalue().splitlines())

def cleanup(root):
    # Run only the actual bounded preparation prefix, never render or dispatch.
    source = QA.read_text().split("      - name: Render local-only V10\n", 1)[1].split("        run: |\n", 1)[1].split("          npx remotion", 1)[0]
    return subprocess.run(["bash", "-eu", "-c", textwrap.dedent(source)], cwd=root, text=True, capture_output=True)

def receipt(candidate="a" * 64, edge=0.6):
    return {
        "status": "FREE_QA_GREEN", "publication_enabled": False,
        "paid_vision_dependency": False, "credit_cost": 0,
        "candidate_sha256": candidate, "duration_seconds": 30,
        "semantic": {"checks": {"florence_completed": True}, "global_similarity": 0.65, "mean_best_frame_similarity": 0.42},
        "deterministic": {"edge_density_ratio": edge, "motion_active_fraction": 1, "checks": {"duration_30s": True}},
        "audio": {"verdict": "PASS", "mean_volume_db": -28, "max_volume_db": -4,
                  "max_long_silence_seconds": 0, "sample_rate_hz": 48000,
                  "channels": 2, "checks": {"analysis_complete": True}},
    }

def run_regression(root, value):
    write_json(root, "qa-output/free/final-receipt.json", value)
    return subprocess.run([sys.executable, "-B", str(REGRESSION)], cwd=root, text=True, capture_output=True)

class RepairRoutingTests(unittest.TestCase):
    def test_python_security_routes_only_to_security(self):
        self.assertEqual(run_routes(["python_dependency_security_clean"]), {"runtime-security-audit.yml"})

    def test_both_security_failures_deduplicate_without_render(self):
        self.assertEqual(run_routes(["dependency_security_clean", "python_dependency_security_clean"]), {"runtime-security-audit.yml"})

    def test_observed_failure_set_does_not_render(self):
        failed = ["dependency_security_clean", "python_dependency_security_clean", "live_deployment_green",
                  "caption_candidate_match", "caption_health_green", "provenance_inputs_current",
                  "candidate_identity_consistent", "candidate_converged"]
        self.assertEqual(run_routes(failed), {"runtime-security-audit.yml", "narration-transcription-gate.yml"})

    def test_real_video_failure_still_routes_to_qa(self):
        self.assertEqual(run_routes(["python_dependency_security_clean", "video_hash_bound"]),
                         {"runtime-security-audit.yml", "free-vision-qa.yml"})

    def test_unknown_failure_still_routes_to_qa(self):
        self.assertEqual(run_routes(["unknown_invariant"]), {"free-vision-qa.yml"})

    def test_promotion_order_remains_earliest_first(self):
        self.assertEqual(run_routes(["caption_health_green", "review_server_smoke_green", "provenance_inputs_current", "live_deployment_green"]),
                         {"narration-transcription-gate.yml"})
        self.assertEqual(run_routes(["review_server_smoke_green", "provenance_inputs_current", "live_deployment_green"]),
                         {"review-server-smoke.yml"})
        self.assertEqual(run_routes(["provenance_inputs_current", "live_deployment_green"]), {"runtime-provenance.yml"})
        self.assertEqual(run_routes(["live_deployment_green"]), {"live-render-deployment-smoke.yml"})

    def test_no_failures_no_repair(self):
        self.assertEqual(run_routes([]), set())

    def test_focused_regressions_are_wired_into_watchdog(self):
        source = WATCHDOG.read_text()
        self.assertIn("      - 'tests/test_watchdog_routing_history.py'", source)
        self.assertIn("python -m unittest tests.test_watchdog_scope tests.test_watchdog_routing_history", source)

    def test_security_failure_exit_step_is_preserved(self):
        self.assertIn("      - name: Fail watchdog when repair is required\n        if: steps.verify.outcome == 'failure'\n        run: exit 2", WATCHDOG.read_text())

class HistoryTests(unittest.TestCase):
    def test_cleanup_preserves_history_and_removes_stale_current_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            prior = write_json(root, "qa-output/free/history/" + "a" * 64 + ".json", {"old": True})
            before = prior.read_bytes()
            stale = write_json(root, "qa-output/free/candidate-frames/old.json", {"old": True})
            write_json(root, "qa-output/free/final-receipt.json", {"old": True})
            result = cleanup(root)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue(prior.is_file(), "Cleanup deleted prior candidate history")
            self.assertEqual(prior.read_bytes(), before)
            self.assertFalse(stale.exists())
            self.assertFalse((root / "qa-output/free/final-receipt.json").exists())
            self.assertTrue((root / "qa-output/free/candidate-frames").is_dir())

    def test_first_history_and_health_are_written(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            result = run_regression(root, receipt())
            self.assertEqual(result.returncode, 0, result.stderr)
            h = json.loads((root / ("qa-output/free/history/" + "a" * 64 + ".json")).read_text())
            self.assertEqual(h["candidate_sha256"], "a" * 64)
            self.assertTrue(h["accepted"])
            self.assertFalse(h["publication_enabled"])
            self.assertEqual(json.loads((root / "state/content-control-health.json").read_text())["status"], "GREEN")

    def test_repeated_candidate_preserves_original_history_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.assertEqual(run_regression(root, receipt()).returncode, 0)
            p = root / ("qa-output/free/history/" + "a" * 64 + ".json")
            before = p.read_bytes()
            result = run_regression(root, receipt(edge=0.61))
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(p.read_bytes(), before)
            self.assertEqual(json.loads((root / "state/content-control-health.json").read_text())["metrics"]["edge_density_ratio"], 0.61)

    def test_new_candidate_retains_prior_history_after_actual_cleanup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.assertEqual(run_regression(root, receipt()).returncode, 0)
            old = root / ("qa-output/free/history/" + "a" * 64 + ".json")
            before = old.read_bytes()
            self.assertEqual(cleanup(root).returncode, 0)
            result = run_regression(root, receipt("b" * 64))
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue(old.is_file(), "New candidate deleted prior history")
            self.assertEqual(old.read_bytes(), before)
            paths = sorted((root / "qa-output/free/history").glob("*.json"))
            self.assertEqual(len(paths), 2)
            for p in paths:
                self.assertEqual(p.stem, json.loads(p.read_text())["candidate_sha256"])

    def test_mismatched_history_fails_without_overwriting_it_or_health(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            old = write_json(root, "qa-output/free/history/" + "a" * 64 + ".json",
                             {"schema_version": 1, "candidate_sha256": "b" * 64, "accepted": True, "publication_enabled": False, "credit_cost": 0})
            health = write_json(root, "state/content-control-health.json", {"status": "BEFORE"})
            before = (old.read_bytes(), health.read_bytes())
            result = run_regression(root, receipt())
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual((old.read_bytes(), health.read_bytes()), before)

    def test_malformed_history_fails_without_overwriting_it_or_health(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            old = write_json(root, "qa-output/free/history/" + "a" * 64 + ".json", ["invalid"])
            health = write_json(root, "state/content-control-health.json", {"status": "BEFORE"})
            before = (old.read_bytes(), health.read_bytes())
            result = run_regression(root, receipt())
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual((old.read_bytes(), health.read_bytes()), before)

    def test_unaccepted_history_is_not_silently_rewritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            old = write_json(root, "qa-output/free/history/" + "a" * 64 + ".json",
                             {"schema_version": 1, "candidate_sha256": "a" * 64, "accepted": False, "publication_enabled": False, "credit_cost": 0})
            before = old.read_bytes()
            result = run_regression(root, receipt())
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(old.read_bytes(), before)
            self.assertFalse((root / "state/content-control-health.json").exists())

    def test_failed_current_qa_cannot_reuse_old_acceptance(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.assertEqual(run_regression(root, receipt()).returncode, 0)
            old = root / ("qa-output/free/history/" + "a" * 64 + ".json")
            health = root / "state/content-control-health.json"
            before = (old.read_bytes(), health.read_bytes())
            invalid = receipt()
            invalid["audio"]["verdict"] = "FAIL"
            self.assertNotEqual(run_regression(root, invalid).returncode, 0)
            self.assertEqual((old.read_bytes(), health.read_bytes()), before)

def health_fixture(root):
    def raw(name, data):
        p = root / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        return hashlib.sha256(data).hexdigest()
    def digest(name):
        return hashlib.sha256((root / name).read_bytes()).hexdigest()
    candidate = raw("public-review/episode1-v10-free.mp4", b"x" * 1_000_001)
    narration = None
    for name in ["episode1-narration", "episode1-music", "episode1-sfx-1", "episode1-sfx-2"]:
        value = raw("public/audio/" + name + ".mp3", b"a" * 1001)
        if name == "episode1-narration":
            narration = value
    caption = raw("public-review/episode1-v10-free.vtt", b"WEBVTT\n")
    raw("remotion/Episode1V10FinalProof.jsx", b"staticFile(")
    for i in range(10):
        raw("reference/frames/ref-" + str(i) + ".jpg", b"x")
    for name in ["package-lock.json", "requirements-free-qa.lock.txt"]:
        raw(name, b"fixture")
    h = {"status": "GREEN", "candidate_sha256": candidate, "credit_cost": 0, "paid_vision_dependency": False, "publication_enabled": False}
    write_json(root, "state/content-control-health.json", h)
    r = receipt(candidate)
    r["deterministic"]["verdict"] = "PASS"
    r["semantic"]["verdict"] = "PASS"
    r["mobile"] = {"status": "PASS", "checks": {"fixture": True}}
    write_json(root, "qa-output/free/final-receipt.json", r)
    for name in ["publication-owner-gate", "publication-separation"]:
        write_json(root, "control/" + name + ".json", {"publication_enabled": False})
    write_json(root, "state/runtime-integrity-manifest.json", {"critical_file_count": 0, "entries": {}})
    write_json(root, "state/runtime-security-audit.json", {"npm_counts": {"critical": 0, "high": 0, "moderate": 0, "low": 0}})
    write_json(root, "state/python-security-audit.json", {"status": "PASS", "total_vulnerabilities": 0})
    for name in ["workflow-control-health", "system-wiring-health", "factual-compliance-health", "deployment-health", "sync-retention-health", "narration-transcription-health"]:
        write_json(root, "state/" + name + ".json", {"status": "PASS", "checks": {"fixture": True}})
    write_json(root, "state/accepted-candidate-ledger.json", {"current_candidate_sha256": candidate})
    write_json(root, "state/acceptance-ledger-health.json", {"status": "PASS", "current_candidate_sha256": candidate, "checks": {"fixture": True}})
    write_json(root, "state/live-deployment-health.json", {"status": "PASS", "candidate_sha256": candidate, "checks": {"fixture": True}})
    write_json(root, "state/caption-health.json", {"status": "PASS", "candidate_sha256": candidate, "caption_sha256": caption, "narration_sha256": narration, "checks": {"fixture": True}})
    smoke = {"status": "PASS", "candidate_sha256": candidate, "publication_enabled": False}
    for name in ["accepted_route_verified", "fail_closed_corruption_verified", "range_streaming_verified", "security_headers_verified", "cache_policy_verified", "captions_verified"]:
        smoke[name] = True
    write_json(root, "state/review-server-smoke.json", smoke)
    write_json(root, "state/provenance/npm-sbom.cdx.json", {"bomFormat": "CycloneDX", "components": ["fixture"]})
    write_json(root, "state/provenance/runtime-provenance.json", {
        "candidate_sha256": candidate, "review_server_smoke_candidate_sha256": candidate,
        "zero_credit_runtime": True, "publication_enabled": False,
        "locks": {"package_lock_sha256": digest("package-lock.json"), "python_lock_sha256": digest("requirements-free-qa.lock.txt")},
        "critical_integrity_manifest_sha256": digest("state/runtime-integrity-manifest.json"),
        "qa_receipt_sha256": digest("qa-output/free/final-receipt.json"),
        "review_server_smoke_sha256": digest("state/review-server-smoke.json"),
        "caption_file_sha256": caption, "caption_candidate_sha256": candidate, "narration_sha256": narration,
    })
    write_json(root, "qa-output/free/history/" + candidate + ".json", {"candidate_sha256": candidate})

class SecurityGatingTests(unittest.TestCase):
    def run_health(self, root):
        return subprocess.run([sys.executable, "-B", str(HEALTH)], cwd=root, text=True, capture_output=True)

    def test_clean_fixture_passes_component_checks_but_not_production(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            health_fixture(root)
            result = self.run_health(root)
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads(result.stdout)
            self.assertEqual(report["watchdog"]["failed_checks"], [])
            self.assertFalse(report["completion"]["production_ready"])
            self.assertFalse(report["completion"]["publication_enabled"])

    def test_python_security_failure_stays_red_and_nonzero(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            health_fixture(root)
            write_json(root, "state/python-security-audit.json", {"status": "FAIL", "total_vulnerabilities": 1})
            result = self.run_health(root)
            self.assertEqual(result.returncode, 2, result.stderr)
            report = json.loads(result.stdout)
            self.assertEqual(report["watchdog"]["failed_checks"], ["python_dependency_security_clean"])
            self.assertEqual(report["watchdog"]["status"], "REPAIR_REQUIRED")
            self.assertFalse(report["completion"]["production_ready"])
            self.assertFalse(report["completion"]["publication_enabled"])

    def test_npm_security_failure_stays_red_and_nonzero(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            health_fixture(root)
            write_json(root, "state/runtime-security-audit.json", {"npm_counts": {"critical": 0, "high": 1, "moderate": 0, "low": 0}})
            result = self.run_health(root)
            self.assertEqual(result.returncode, 2, result.stderr)
            report = json.loads(result.stdout)
            self.assertEqual(report["watchdog"]["failed_checks"], ["dependency_security_clean"])
            self.assertFalse(report["completion"]["production_ready"])
            self.assertFalse(report["completion"]["publication_enabled"])

if __name__ == "__main__":
    unittest.main()
