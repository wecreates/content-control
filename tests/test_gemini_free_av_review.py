import base64
import copy
import datetime as dt
import importlib.util
import http.client
import io
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest
import urllib.error
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("free_av", ROOT / "scripts/gemini_free_av_review.py")
av = importlib.util.module_from_spec(spec)
spec.loader.exec_module(av)
NOW = dt.datetime(2026, 10, 17, 17, tzinfo=dt.timezone.utc)
POLICY = json.loads((ROOT / "control/gemini-free-av-policy.json").read_text())
DATA = b"test video bytes"
MEDIA = {"candidate_sha256": av.digest(DATA), "duration_seconds": 35.041667,
         "byte_length": len(DATA), "verified": True, "mime_type": "video/mp4"}


def report():
    return {"status": "DIAGNOSTIC", "access": {"video": "observed", "audio": "observed"},
            "summary": "A model-observed diagnostic summary, not release approval.",
            "observations": [{"modality": "video", "start_sec": 0.0, "end_sec": 2.0,
                              "evidence": "A title moves across the sampled image."},
                             {"modality": "audio", "start_sec": None, "end_sec": None,
                              "evidence": "Narration can be heard over music."}],
            "findings": [], "limitations": ["Sampled video can miss rapid defects."]}


class FakeHTTP:
    def __init__(self):
        self.calls = []
        self.lookup = {"parent": "projects/123456/locations/global", "name": "projects/123456/locations/global/keys/test-id"}
        self.project = {"projectId": av.PROJECT, "projectNumber": "123456", "lifecycleState": "ACTIVE"}
        self.billing = {"projectId": av.PROJECT, "name": f"projects/{av.PROJECT}/billingInfo",
                        "billingEnabled": False, "billingAccountName": ""}
        self.model = {"name": "models/" + av.MODEL}
        self.file = {"name": "files/test-file", "uri": av.API + "/v1beta/files/test-file",
                     "state": "ACTIVE", "mimeType": "video/mp4", "sizeBytes": str(len(DATA)),
                     "sha256Hash": base64.b64encode(bytes.fromhex(MEDIA["candidate_sha256"])).decode()}
        self.upload_url = av.API + "/upload/v1beta/files?upload_id=test"
        self.response = {"id": "interaction-123", "status": "completed", "model": av.MODEL,
                         "service_tier": "standard", "steps": [{"type": "model_output", "content": [
                             {"type": "text", "text": json.dumps(report())}]}]}
        self.failure = None
        self.billing_checks = 0
        self.billing_change_at = None

    def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        if self.failure and self.failure[0] in url:
            raise av.Blocked(self.failure[1])
        if "keys:lookupKey" in url:
            return copy.deepcopy(self.lookup), {}
        if "cloudresourcemanager" in url:
            return copy.deepcopy(self.project), {}
        if "cloudbilling" in url:
            self.billing_checks += 1
            value = copy.deepcopy(self.billing)
            if self.billing_change_at and self.billing_checks >= self.billing_change_at:
                value["billingEnabled"] = True
            return value, {}
        if "/models/" in url:
            return copy.deepcopy(self.model), {}
        if method == "DELETE":
            return {}, {}
        if url == av.API + "/upload/v1beta/files":
            return {}, {"X-Goog-Upload-URL": self.upload_url}
        if url == self.upload_url:
            return {"file": copy.deepcopy(self.file)}, {}
        if "/v1beta/files/" in url:
            return copy.deepcopy(self.file), {}
        if url.endswith("/interactions"):
            return copy.deepcopy(self.response), {}
        raise AssertionError("Unexpected endpoint")

    def inference_calls(self):
        return [x for x in self.calls if x[1].endswith("/interactions")]

    def upload_calls(self):
        return [x for x in self.calls if "/upload/" in x[1]]


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.clock = patch.object(av, "utcnow", return_value=NOW)
        self.clock.start()
        self.addCleanup(self.clock.stop)
        self.http = FakeHTTP()

    def run_review(self, **kwargs):
        reviewer = av.Reviewer(copy.deepcopy(POLICY), "test-key-not-real", "test-token-not-real", http=self.http, **kwargs)
        return reviewer.run(DATA, MEDIA)

    def test_happy_path_is_always_non_approving_and_hash_bound(self):
        result = self.run_review()
        self.assertEqual(result["status"], "DIAGNOSTIC_ONLY")
        self.assertEqual(result["candidate_sha256"], av.digest(DATA))
        for flag in ("publication_enabled", "production_approved", "full_video_review", "full_audio_review", "ready"):
            self.assertIs(result[flag], False)
        self.assertEqual(result["reviewed_intervals"], [])
        self.assertEqual(result["comparisons"], [])
        self.assertEqual(len(result["entitlement_checks"]), 4)
        self.assertEqual(result["uploaded_file_cleanup"], "deleted")
        self.assertEqual(len(self.http.inference_calls()), 1)
        body = json.loads(self.http.inference_calls()[0][2]["body"])
        self.assertEqual(body["input"][0]["processing"], {"type": "static", "fps": 1})
        self.assertFalse(body["store"])
        self.assertFalse(body["background"])
        self.assertNotIn("tools", body)
        self.assertEqual(body["service_tier"], "standard")
        self.assertIn("35.041667", body["input"][1]["text"])
        self.assertNotIn("520.066667", body["input"][1]["text"])

    def test_missing_credentials_make_no_network_calls(self):
        for key, token, reason in ((None, "token", "missing_existing_gemini_secret"),
                                   ("key", None, "missing_existing_project_read_identity")):
            with self.subTest(reason=reason), self.assertRaisesRegex(av.Blocked, reason):
                av.Reviewer(POLICY, key, token, http=self.http)
        self.assertEqual(self.http.calls, [])

    def test_policy_cannot_enable_paid_routes_or_switch_models(self):
        for field, value in (("paid_fallback", True), ("free_input", False), ("free_output", False),
                             ("publication_enabled", True), ("model", "gemini-4-argon"),
                             ("project_id", "unverified"), ("service_tier", "priority"),
                             ("max_media_bytes", 300000000), ("max_duration_seconds", float("nan")),
                             ("processing_timeout_seconds", 301)):
            with self.subTest(field=field), self.assertRaises(av.Blocked):
                av.validate_policy(POLICY | {field: value})

    def test_expired_future_or_unbounded_pricing_attestation_rejected(self):
        for patch_value in ({"pricing_expires_at": "2026-10-17T16:00:00Z"},
                            {"pricing_checked_at": "2026-10-18T00:00:00Z"},
                            {"pricing_expires_at": "2027-10-17T00:00:00Z"},
                            {"pricing_expires_at": "invalid"}):
            with self.subTest(patch_value=patch_value), self.assertRaises(av.Blocked):
                av.validate_policy(POLICY | patch_value)

    def test_wrong_key_project_purged_key_and_missing_project_fail_before_upload(self):
        for mutation in ({"parent": "projects/555/locations/global"}, {"name": ""},
                         {"name": "projects/555/locations/global/keys/key"}, {"parent": "project-name"}):
            self.http = FakeHTTP()
            self.http.lookup.update(mutation)
            result = self.run_review()
            self.assertEqual(result["status"], "BLOCKED")
            self.assertEqual(self.http.upload_calls(), [])

    def test_project_identity_and_lifecycle_are_bound(self):
        for field, value in (("projectId", "different-project"), ("projectNumber", "555"),
                             ("lifecycleState", "DELETE_REQUESTED")):
            self.http = FakeHTTP()
            self.http.project[field] = value
            self.assertEqual(self.run_review()["reason"], "runtime_secret_project_mismatch")
            self.assertEqual(self.http.upload_calls(), [])

    def test_billing_must_be_explicit_false_and_unlinked(self):
        for update in ({"billingEnabled": True}, {"billingEnabled": "false"}, {"billingEnabled": 0},
                       {"billingEnabled": None}, {"billingAccountName": "billingAccounts/closed"},
                       {"projectId": "other"}, {"name": "wrong"}):
            self.http = FakeHTTP()
            self.http.billing.update(update)
            self.assertEqual(self.run_review()["reason"], "project_billing_not_verified_free")
            self.assertEqual(self.http.upload_calls(), [])
        del self.http.billing["billingEnabled"]
        self.assertEqual(self.run_review()["status"], "BLOCKED")

    def test_scope_denial_is_blocked_without_secret_output(self):
        self.http.failure = ("cloudbilling", "provider_http_403")
        result = self.run_review()
        self.assertEqual(result["reason"], "provider_http_403")
        self.assertEqual(self.http.upload_calls(), [])
        self.assertNotIn("test-key", json.dumps(result))
        self.assertNotIn("test-token", json.dumps(result))

    def test_model_unavailable_blocks_before_upload(self):
        self.http.model["name"] = "models/other"
        self.assertEqual(self.run_review()["reason"], "verified_model_unavailable")
        self.assertEqual(self.http.upload_calls(), [])

    def test_billing_change_before_inference_blocks(self):
        self.http.billing_change_at = 3
        result = self.run_review()
        self.assertEqual(result["reason"], "project_billing_not_verified_free")
        self.assertEqual(self.http.inference_calls(), [])
        self.assertEqual(result["uploaded_file_cleanup"], "deleted")

    def test_billing_change_after_inference_invalidates_result(self):
        self.http.billing_change_at = 4
        result = self.run_review()
        self.assertEqual(result["status"], "BLOCKED")
        self.assertNotIn("model_report", result)
        self.assertEqual(len(self.http.inference_calls()), 1)

    def test_upload_redirect_or_foreign_endpoint_never_receives_media(self):
        for url in ("http://generativelanguage.googleapis.com/upload/v1beta/files",
                    "https://evil.example/upload/v1beta/files", "https://generativelanguage.googleapis.com.evil/upload/v1beta/files",
                    "https://user@generativelanguage.googleapis.com/upload/v1beta/files", "https://generativelanguage.googleapis.com:443/upload/v1beta/files",
                    av.API + "/other", av.API + "/upload/v1beta/files#fragment"):
            self.http = FakeHTTP()
            self.http.upload_url = url
            self.assertEqual(self.run_review()["reason"], "untrusted_provider_url")
            self.assertEqual(len(self.http.upload_calls()), 1)

    def test_specific_file_polling_and_timeout_are_bounded(self):
        self.http.file["state"] = "PROCESSING"
        elapsed = [0]
        def sleep(value):
            elapsed[0] += value
        result = self.run_review(sleep=sleep, monotonic=lambda: elapsed[0])
        self.assertEqual(result["reason"], "provider_file_processing_timeout")
        self.assertEqual(elapsed[0], 300)
        self.assertEqual(self.http.inference_calls(), [])
        polls = [url for method, url, _ in self.http.calls if method == "GET" and "/files/" in url]
        self.assertTrue(polls)
        self.assertTrue(all(url.endswith("/files/test-file") for url in polls))
        self.assertFalse(any("pageSize" in url for _, url, _ in self.http.calls))

    def test_file_failure_unknown_state_and_wrong_identity_block(self):
        for mutation in ({"state": "FAILED"}, {"state": "UNKNOWN"}, {"uri": "https://evil.example/file"},
                         {"name": "files/../../other"}, {"mimeType": "text/plain"}):
            self.http = FakeHTTP()
            self.http.file.update(mutation)
            self.assertEqual(self.run_review()["status"], "BLOCKED")
            self.assertEqual(self.http.inference_calls(), [])

    def test_server_byte_hash_and_size_must_match(self):
        for mutation in ({"sha256Hash": "bad"}, {"sha256Hash": None}, {"sizeBytes": "999"}):
            self.http = FakeHTTP()
            self.http.file.update(mutation)
            result = self.run_review()
            self.assertEqual(result["reason"], "provider_file_bytes_mismatch")
            self.assertEqual(self.http.inference_calls(), [])
            self.assertEqual(result["uploaded_file_cleanup"], "deleted")

    def test_inference_errors_do_not_retry_or_fallback(self):
        for reason in ("provider_http_429", "provider_http_500", "provider_transport_error"):
            self.http = FakeHTTP()
            self.http.failure = ("/interactions", reason)
            result = self.run_review()
            self.assertEqual(result["reason"], reason)
            self.assertEqual(len(self.http.inference_calls()), 1)
            self.assertEqual(result["uploaded_file_cleanup"], "deleted")

    def test_provider_incomplete_model_mismatch_and_refusal_block(self):
        for mutation in ({"status": "incomplete"}, {"status": "failed"}, {"status": "requires_action"},
                         {"model": "different"}, {"id": ""}, {"service_tier": "priority"},
                         {"steps": []}, {"steps": [{"type": "model_output", "content": [{"type": "refusal"}]}]}):
            self.http = FakeHTTP()
            self.http.response.update(mutation)
            self.assertEqual(self.run_review()["status"], "BLOCKED")

    def test_provider_errors_and_unexpected_tool_steps_block(self):
        for errors in ([{"code": "media_failed"}], None, "error", {}):
            self.http = FakeHTTP()
            self.http.response["errors"] = errors
            self.assertEqual(self.run_review()["reason"], "provider_interaction_errors")
        for kind in ("processing_call", "processing_result", "function_call", "url_context_call", "refusal", "error"):
            self.http = FakeHTTP()
            self.http.response["steps"].insert(0, {"type": kind})
            self.assertEqual(self.run_review()["reason"], "unexpected_interaction_step")

    def test_malformed_provider_field_types_fail_closed(self):
        for field in ("parent", "name"):
            self.http = FakeHTTP()
            self.http.lookup[field] = []
            self.assertEqual(self.run_review()["status"], "BLOCKED")
        for field in ("name", "uri", "state"):
            self.http = FakeHTTP()
            self.http.file[field] = []
            self.assertEqual(self.run_review()["status"], "BLOCKED")

    def test_inaccessible_and_refused_model_reports_are_never_success(self):
        for status in ("INACCESSIBLE", "REFUSED"):
            self.http = FakeHTTP()
            value = report()
            value["status"] = status
            value["access"]["audio"] = "inaccessible"
            self.http.response["steps"][0]["content"][0]["text"] = json.dumps(value)
            result = self.run_review()
            self.assertEqual(result["status"], "BLOCKED")
            self.assertEqual(result["reason"], "provider_" + status.lower())

    def test_diagnostic_cannot_conflict_with_access_or_missing_modality_evidence(self):
        value = report()
        value["access"]["audio"] = "uncertain"
        with self.assertRaisesRegex(av.Blocked, "media_inaccessible"):
            av.validate_report(value, 35)
        value = report()
        value["observations"] = value["observations"][:1]
        with self.assertRaisesRegex(av.Blocked, "modality_specific"):
            av.validate_report(value, 35)

    def test_model_cannot_inject_pass_flags_or_competitor_claims(self):
        for field in ("full_video_review", "full_audio_review", "publication_enabled", "comparisons"):
            value = report() | {field: True}
            with self.assertRaisesRegex(av.Blocked, "invalid_diagnostic_schema"):
                av.validate_report(value, 35)
        value = report() | {"status": "PASS"}
        with self.assertRaises(av.Blocked):
            av.validate_report(value, 35)

    def test_timestamps_are_nullable_bounded_finite_and_not_boolean(self):
        for start, end in ((float("nan"), 1), (0, float("inf")), (0, 10**500), (True, 2), (-1, 2),
                           (0, 36), (2, 1), (0, None), ("0", "1")):
            value = report()
            value["observations"][0].update(start_sec=start, end_sec=end)
            with self.subTest(start=start, end=end), self.assertRaises(av.Blocked):
                av.validate_report(value, 35)
        value = report()
        value["observations"][0].update(start_sec=None, end_sec=None)
        self.assertEqual(av.validate_report(value, 35), value)

    def test_json_duplicate_fields_nonfinite_and_prose_rejected(self):
        for value in ('{"x":1,"x":2}', '{"x":NaN}', '{"x":Infinity}', '```json\n{}\n```', 'INACCESSIBLE'):
            with self.assertRaisesRegex(av.Blocked, "invalid_json"):
                av.strict_json(value)

    def test_cleanup_failure_preserves_warning_without_second_inference(self):
        class DeleteFails(FakeHTTP):
            def request(self, method, url, **kwargs):
                if method == "DELETE":
                    raise av.Blocked("provider_http_500")
                return super().request(method, url, **kwargs)
        self.http = DeleteFails()
        result = self.run_review()
        self.assertEqual(result["uploaded_file_cleanup"], "failed_provider_retention_applies")
        self.assertEqual(len(self.http.inference_calls()), 1)

    def test_raw_http_errors_are_sanitized(self):
        http = av.HTTP()
        error = urllib.error.HTTPError("https://apikeys.googleapis.com/v2/keys:lookupKey?keyString=SECRET", 403, "SECRET", {}, io.BytesIO(b"SECRET"))
        with patch.object(http.opener, "open", side_effect=error), self.assertRaisesRegex(av.Blocked, "^provider_http_403$"):
            http.request("GET", "https://apikeys.googleapis.com/v2/keys:lookupKey?keyString=SECRET")

    def test_redirect_handler_does_not_follow(self):
        self.assertIsNone(av.NoRedirect().redirect_request(None, None, 302, "", {}, "https://evil.example"))

    def test_malformed_or_truncated_http_is_blocked(self):
        for error in (http.client.BadStatusLine("SECRET"), http.client.IncompleteRead(b"SECRET", 100)):
            client = av.HTTP()
            with patch.object(client.opener, "open", side_effect=error), self.assertRaisesRegex(av.Blocked, "^provider_transport_error$"):
                client.request("GET", av.API + "/v1beta/models/" + av.MODEL)

    def test_diagnostic_is_rejected_by_existing_creative_gate(self):
        if not shutil.which("node"):
            self.skipTest("node unavailable")
        result = self.run_review()
        proc = subprocess.run(["node", "--input-type=module", "-e",
            "import {creativeHandoff} from './creative-handoff.js'; let s=''; for await(const c of process.stdin)s+=c; const r=JSON.parse(s); console.log(JSON.stringify(creativeHandoff(r,r.candidate_sha256,r)));"],
            input=json.dumps(result), text=True, capture_output=True, cwd=ROOT, check=True)
        gate = json.loads(proc.stdout)
        self.assertFalse(gate["ready"])
        self.assertIn("complete_audiovisual_review_pending", gate["reasons"])


class MediaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.media = self.root / "input.mp4"
        self.media.write_bytes(DATA)
        self.work = self.root / "work"
        self.work.mkdir()

    def probe(self, *args, **kwargs):
        return subprocess.CompletedProcess(args[0], 0, json.dumps({"format": {"duration": "35.041667", "format_name": "mov,mp4,m4a,3gp,3g2,mj2"},
            "streams": [{"codec_type": "video"}, {"codec_type": "audio"}]}))

    def snapshot(self, probe=None, expected=None):
        return av.snapshot_media(self.media, expected or av.digest(DATA), self.work, POLICY, probe=probe or self.probe)

    def test_hash_and_probe_bind_actual_snapshot_bytes(self):
        data, media = self.snapshot()
        self.assertEqual(data, DATA)
        self.assertEqual(media["duration_seconds"], 35.041667)
        self.assertEqual(media["candidate_sha256"], av.digest(DATA))
        self.media.write_bytes(b"source changed after snapshot")
        self.assertEqual(data, DATA)

    def test_probe_disables_nested_network_protocols_and_does_not_inherit_credentials(self):
        def inspect(*args, **kwargs):
            command = args[0]
            self.assertEqual(command[command.index("-protocol_whitelist") + 1], "file")
            self.assertEqual(command[command.index("-f") + 1], "mov")
            self.assertNotIn("GEMINI_API_KEY", kwargs["env"])
            self.assertNotIn("GEMINI_PROJECT_READ_TOKEN", kwargs["env"])
            return self.probe(*args, **kwargs)
        self.snapshot(probe=inspect)

    def test_stale_hash_and_probe_mutation_fail(self):
        with self.assertRaisesRegex(av.Blocked, "sha256_mismatch"):
            self.snapshot(expected="a" * 64)
        def mutate(*args, **kwargs):
            (self.work / "exact-media.mp4").write_bytes(b"changed")
            return self.probe(*args, **kwargs)
        with self.assertRaisesRegex(av.Blocked, "media_changed_during_probe"):
            self.snapshot(probe=mutate)

    def test_invalid_duration_streams_and_format_reject(self):
        for duration, streams, fmt in (("nan", ["video", "audio"], "mp4"),
                                       ("601", ["video", "audio"], "mp4"),
                                       ("35", ["video"], "mp4"), ("35", ["audio"], "mp4"),
                                       ("35", ["video", "audio"], "matroska")):
            def probe(*args, **kwargs):
                return subprocess.CompletedProcess(args[0], 0, json.dumps({"format": {"duration": duration, "format_name": fmt},
                    "streams": [{"codec_type": s} for s in streams]}))
            with self.subTest(duration=duration, streams=streams, fmt=fmt), self.assertRaises(av.Blocked):
                self.snapshot(probe=probe)

    def test_output_cannot_overwrite_input_symlink_or_hardlink(self):
        for alias in (self.media, self.root / "hardlink.json", self.root / "symlink.json"):
            if alias.name == "hardlink.json":
                os.link(self.media, alias)
            if alias.name == "symlink.json":
                alias.symlink_to(self.media)
            with self.assertRaises(av.Blocked):
                av.write_receipt(alias, {"status": "BLOCKED"}, [self.media])
        self.assertEqual(self.media.read_bytes(), DATA)

    def test_stale_receipt_replaced_by_blocker_on_missing_configuration(self):
        output = self.root / "receipt.json"
        output.write_text('{"status":"PASS"}')
        with patch.object(av, "utcnow", return_value=NOW), patch.dict(os.environ, {}, clear=True), patch.object(av.HTTP, "request", side_effect=AssertionError("network prohibited")):
            result = av.main(["--video", str(self.media), "--expected-sha256", av.digest(DATA), "--output", str(output)])
        self.assertEqual(result, 2)
        receipt = json.loads(output.read_text())
        self.assertEqual(receipt["status"], "BLOCKED")
        self.assertEqual(receipt["reason"], "missing_existing_gemini_secret")

    def test_real_local_media_duration_is_dynamic(self):
        if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
            self.skipTest("ffmpeg and ffprobe required")
        fixture = self.root / "fixture.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=64x64:r=10", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=8000", "-t", "1.3", "-c:v", "mpeg4", "-c:a", "aac", str(fixture)], check=True, capture_output=True)
        data, media = av.snapshot_media(fixture, av.digest(fixture.read_bytes()), self.work, POLICY)
        self.assertAlmostEqual(media["duration_seconds"], 1.3, delta=.15)
        self.assertEqual(av.digest(data), media["candidate_sha256"])


class WorkflowIsolationTests(unittest.TestCase):
    def test_oidc_and_secret_are_confined_to_explicit_manual_main_job(self):
        workflow = (ROOT / ".github/workflows/exact-av-review.yml").read_text()
        prefix, job = workflow.split("  free-api-diagnostic:\n", 1)
        self.assertNotIn("id-token: write", prefix)
        self.assertNotIn("secrets.GEMINI_API_KEY", prefix)
        self.assertEqual(job.count("id-token: write"), 1)
        guard = job.split("\n", 1)[0]
        for expression in ("github.event_name == 'workflow_dispatch'", "github.ref == 'refs/heads/main'",
                           "inputs.run_free_api_diagnostic", "vars.GEMINI_AV_IDENTITY_ENABLED == 'true'",
                           "vars.GEMINI_AV_WIF_PROVIDER != ''", "vars.GEMINI_AV_READ_SERVICE_ACCOUNT != ''"):
            self.assertIn(expression, guard)
        self.assertIn("google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093", job)
        self.assertIn("create_credentials_file: false", job)
        self.assertIn("export_environment_variables: false", job)
        self.assertIn("GEMINI_PROJECT_READ_TOKEN: ${{ steps.google_read_auth.outputs.access_token }}", job)
        self.assertNotIn("secrets.GEMINI_PROJECT_READ_TOKEN", workflow)
        self.assertIn("candidate_sha256: ${{ steps.prepare.outputs.candidate_sha256 }}", prefix)
        self.assertIn("--expected-sha256 \"$EXPECTED_SHA256\"", job)


if __name__ == "__main__":
    unittest.main()
