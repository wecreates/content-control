import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest

from scripts.verify_preview_delivery_acceptance import evaluate


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/verify_preview_delivery_acceptance.py"
SOURCE = "a" * 40
CANDIDATE = "b" * 64
CAPTIONS = "c" * 64
PACKAGE = "e" * 64
ARCHIVE = "f" * 64
ENTRYPOINT = "1" * 64
CAPTURED_AT = 1_800_000_000_000
VERIFIED_AT = CAPTURED_AT + 1_000
EVIDENCE = b"retained physical-phone screen recording fixture"
EVIDENCE_SHA = hashlib.sha256(EVIDENCE).hexdigest()
FALSE_GATES = {
    "publication_enabled": False,
    "paid_generation_enabled": False,
    "production_ready": False,
    "production_approved": False,
    "full_av_review": False,
}
PROVENANCE = {
    "job_id": "PRIVATE_JOB_ID",
    "job_digest": "2" * 64,
    "attempt": 1,
    "completed_at_unix": 1_800_000_000.5,
    "candidate_sha256": CANDIDATE,
    "pipeline_receipt_sha256": "3" * 64,
    "adapter_receipt_sha256": "4" * 64,
    **FALSE_GATES,
    "scope": "Verified durable queue completion; delivery is not creative or publishing approval",
    "adapter": "content-control-cycle",
    "brief_sha256": "5" * 64,
    "production_brief_sha256": "6" * 64,
    "package_sha256": PACKAGE,
    "review_archive_sha256": ARCHIVE,
}
FILES = {
    "review/video.mp4": CANDIDATE,
    "review/captions.vtt": CAPTIONS,
    "review/index.html": ENTRYPOINT,
    "review/package.json": PACKAGE,
}
# Computed with the Money Factory export identity fields and canonical serializer.
DELIVERY_ID = "bd9b40bf5ec62a645dcba4d2ada3ed78e033fdd4f4ad389c728b168ba721d9b9"


def valid_inputs():
    readiness = {
        "ok": True,
        "deployed_source_commit": SOURCE,
        "observed_at": CAPTURED_AT,
        "production_approved": False,
        "id": "episode1-v10-free",
        "engine": "remotion-v10-free",
        "publication": False,
        "qaStatus": "GREEN",
        "expectedSha256": CANDIDATE,
        "actualSha256": CANDIDATE,
        "hashBound": True,
        "captionReady": True,
        "captionSha256": CAPTIONS,
        "captionCandidateSha256": CANDIDATE,
        "identityConsistent": True,
        "identityFailedChecks": [],
        "watchUrl": f"/watch?sha256={CANDIDATE}&caption_sha256={CAPTIONS}",
        "mediaUrl": f"/media?sha256={CANDIDATE}",
        "captionsUrl": f"/captions?sha256={CAPTIONS}",
        "renderStatus": "idle",
    }
    delivery = {
        "schema_version": 1,
        "status": "AWAITING_REVIEW",
        **FALSE_GATES,
        "candidate_sha256": CANDIDATE,
        "archive": "review-package.zip",
        "archive_sha256": ARCHIVE,
        "entrypoint": "review/index.html",
        "entrypoint_sha256": ENTRYPOINT,
        "package_sha256": PACKAGE,
        "files_sha256": dict(FILES),
        "delivery_identity_sha256": DELIVERY_ID,
        "provenance": dict(PROVENANCE),
        "scope": "Exact unpublished private preview delivery; playback and creative acceptance remain unverified",
    }
    verified = {
        "schema_version": 1,
        "status": "PASS",
        **FALSE_GATES,
        "candidate_sha256": CANDIDATE,
        "package_sha256": PACKAGE,
        "archive_sha256": ARCHIVE,
        "entrypoint": "review/index.html",
        "entrypoint_sha256": ENTRYPOINT,
        "delivery_identity_sha256": DELIVERY_ID,
        "scope": "Caller-supplied delivery identity matched durable private bytes; playback and creative acceptance remain unverified",
    }
    phone = {
        "schema_version": 1,
        "status": "PASS",
        "evidence_type": "PHYSICAL_PHONE_SCREEN_RECORDING",
        "evidence_sha256": EVIDENCE_SHA,
        "observed_at": CAPTURED_AT + 100,
        "deployed_source_commit": SOURCE,
        "candidate_sha256": CANDIDATE,
        "caption_sha256": CAPTIONS,
        "delivery_identity_sha256": DELIVERY_ID,
        "media_duration_seconds": 60.0,
        "played_duration_seconds": 60.1,
        "playback_started": True,
        "playback_completed": True,
        "audio_heard": True,
        "captions_visible": True,
        "inline_playback": True,
        "observer_attestation": "HUMAN_OBSERVED_COMPLETE_PLAYBACK",
        "publication_enabled": False,
        "external_writes_enabled": False,
    }
    return readiness, delivery, verified, phone


class PreviewDeliveryAcceptanceTests(unittest.TestCase):
    def evaluate(self, values=None, **kwargs):
        readiness, delivery, verified, phone = values or valid_inputs()
        return evaluate(
            readiness, delivery, verified, phone,
            kwargs.get("source", SOURCE), kwargs.get("delivery_id", DELIVERY_ID),
            kwargs.get("evidence_sha", EVIDENCE_SHA), kwargs.get("verified_at", VERIFIED_AT),
        )

    def test_exact_receipts_and_evidence_file_identity_pass_coherence_gate(self):
        report = self.evaluate()
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(report["failed_checks"], [])
        self.assertTrue(report["phone_playback_receipt_bound"])
        self.assertTrue(report["durable_delivery_receipt_bound"])
        self.assertFalse(report["phone_playback_verified"])
        self.assertFalse(report["full_av_verified"])
        self.assertTrue(report["independent_evidence_review_required"])
        self.assertNotIn("PRIVATE_JOB_ID", json.dumps(report))

    @unittest.skipUnless(shutil.which("node"), "Node is required to run the readiness producer")
    def test_canonical_readiness_producer_feeds_the_delivery_verifier(self):
        producer = """
            import fs from "node:fs";
            import vm from "node:vm";
            import {buildPreviewIdentity} from "./preview-identity.js";
            const [candidate, captions, commit, observedAt] = process.argv.slice(1);
            const source = fs.readFileSync("server-lowmem.js", "utf8");
            const start = source.indexOf('app.get("/readyz"');
            const end = source.indexOf('app.get("/status"', start);
            const identity = buildPreviewIdentity({
              id: "episode1-v10-free", engine: "remotion-v10-free",
              watchPath: "/watch", mediaPath: "/media", captionsPath: "/captions",
            }, {
              expected: candidate, actual: candidate, captionHash: captions,
              captionCandidateSha256: candidate, ready: true, qaStatus: "GREEN",
              videoReady: true, captionReady: true, publicationLocked: true,
            });
            let status, captured;
            const response = {
              setHeader() {}, status(code) { status = code; return this; },
              json(value) { captured = value; },
            };
            vm.runInNewContext(source.slice(start, end), {
              app: {get(_path, handler) { handler({}, response); }},
              canonicalPreviewIdentity: () => identity,
              deployedSourceCommit: commit, Date: {now: () => Number(observedAt)},
              renderState: {status: "idle"},
            });
            if (status !== 200) throw Error("Canonical readiness must be green in the fixture");
            process.stdout.write(JSON.stringify(captured));
        """
        result = subprocess.run(
            ["node", "--input-type=module", "--eval", producer, "--",
             CANDIDATE, CAPTIONS, SOURCE, str(CAPTURED_AT)],
            cwd=ROOT, capture_output=True, text=True, check=True,
        )
        _, delivery, verified, phone = valid_inputs()
        report = self.evaluate((json.loads(result.stdout), delivery, verified, phone))
        self.assertEqual(report["status"], "PASS", report["failed_checks"])
        self.assertFalse(report["phone_playback_verified"])
        self.assertFalse(report["full_av_verified"])

    def test_source_candidate_caption_and_delivery_mismatches_fail(self):
        mutations = (
            ("readiness source", lambda r, d, v, p: r.update(deployed_source_commit="9" * 40),
             "readiness_exact_source"),
            ("phone source", lambda r, d, v, p: p.update(deployed_source_commit="9" * 40),
             "phone_exact_source"),
            ("candidate", lambda r, d, v, p: d.update(candidate_sha256="9" * 64),
             "delivery_candidate_exact"),
            ("captions", lambda r, d, v, p: d["files_sha256"].update({"review/captions.vtt": "9" * 64}),
             "delivery_caption_exact"),
            ("delivery identity", lambda r, d, v, p: v.update(delivery_identity_sha256="9" * 64),
             "delivery_identity_exact"),
            ("phone evidence", lambda r, d, v, p: p.update(evidence_sha256="9" * 64),
             "phone_evidence_file_exact"),
        )
        for name, mutate, failed in mutations:
            with self.subTest(name=name):
                values = valid_inputs()
                mutate(*values)
                report = self.evaluate(values)
                self.assertEqual(report["status"], "FAIL")
                self.assertIn(failed, report["failed_checks"])

    def test_caption_map_cannot_keep_the_old_identity_when_all_other_captions_are_rebound(self):
        values = valid_inputs()
        readiness, delivery, _, phone = values
        rebound_caption = "9" * 64
        readiness["captionSha256"] = phone["caption_sha256"] = rebound_caption
        readiness["watchUrl"] = f"/watch?sha256={CANDIDATE}&caption_sha256={rebound_caption}"
        readiness["captionsUrl"] = f"/captions?sha256={rebound_caption}"
        delivery["files_sha256"]["review/captions.vtt"] = rebound_caption
        report = self.evaluate(values)
        self.assertEqual(report["status"], "FAIL")
        self.assertEqual(report["failed_checks"], ["delivery_identity_recomputed"])

    def test_exact_readiness_rejects_stale_cross_episode_and_unbound_preview_routes(self):
        route_mutations = {
            "id": "episode3-cashback-casino",
            "engine": "different-engine",
            "watchUrl": f"/watch?sha256={CANDIDATE}&caption_sha256={'z' * 64}",
            "mediaUrl": f"/episode3/media?sha256={CANDIDATE}",
            "captionsUrl": f"https://example.invalid/captions?sha256={CAPTIONS}",
        }
        for field, value in route_mutations.items():
            with self.subTest(field=field):
                values = valid_inputs()
                values[0][field] = value
                report = self.evaluate(values)
                self.assertEqual(report["status"], "FAIL")
                self.assertIn("readiness_canonical_route_bound", report["failed_checks"])

        for changes in ({"identityConsistent": False},
                        {"identityFailedChecks": ["caption_candidate_exact"]}):
            with self.subTest(changes=changes):
                values = valid_inputs()
                values[0].update(changes)
                report = self.evaluate(values)
                self.assertEqual(report["status"], "FAIL")
                self.assertIn("readiness_identity_consistent", report["failed_checks"])

        values = valid_inputs()
        del values[0]["watchUrl"]
        self.assertIn("readiness_shape_exact", self.evaluate(values)["failed_checks"])

    def test_http_green_or_synthetic_attestation_cannot_replace_phone_evidence(self):
        values = valid_inputs()
        values[3]["evidence_type"] = "BROWSER_AUTOMATION"
        values[3]["observer_attestation"] = "SYNTHETIC_PASS"
        values[3]["playback_completed"] = False
        report = self.evaluate(values)
        self.assertEqual(report["status"], "FAIL")
        self.assertIn("phone_receipt_passed", report["failed_checks"])
        self.assertIn("phone_complete_playback_attested", report["failed_checks"])

    def test_matching_but_invalid_primary_delivery_hashes_cannot_pass(self):
        values = valid_inputs()
        for key in ("package_sha256", "archive_sha256", "entrypoint_sha256"):
            values[1][key] = None
            values[2][key] = None
        report = self.evaluate(values)
        self.assertEqual(report["status"], "FAIL")
        self.assertIn("delivery_primary_identities_exact", report["failed_checks"])

    def test_short_stale_future_or_cross_window_observations_fail(self):
        values = valid_inputs()
        values[3]["played_duration_seconds"] = 59.4
        report = self.evaluate(values)
        self.assertIn("phone_complete_playback_attested", report["failed_checks"])

        values = valid_inputs()
        report = self.evaluate(values, verified_at=CAPTURED_AT + 30 * 60 * 1000 + 1)
        self.assertIn("readiness_fresh", report["failed_checks"])

        values = valid_inputs()
        values[3]["observed_at"] = VERIFIED_AT + 1
        report = self.evaluate(values)
        self.assertIn("readiness_fresh", report["failed_checks"])

        values = valid_inputs()
        values[3]["observed_at"] = CAPTURED_AT + 5 * 60 * 1000 + 1
        report = self.evaluate(values, verified_at=values[3]["observed_at"])
        self.assertIn("readiness_phone_same_window", report["failed_checks"])

    def test_unexpected_fields_and_enabled_gates_fail_closed(self):
        values = valid_inputs()
        values[0]["secret"] = "DO_NOT_ECHO"
        values[1]["production_ready"] = True
        values[3]["publication_enabled"] = True
        report = self.evaluate(values)
        encoded = json.dumps(report)
        self.assertEqual(report["status"], "FAIL")
        self.assertIn("readiness_shape_exact", report["failed_checks"])
        self.assertIn("delivery_receipt_unpublished", report["failed_checks"])
        self.assertIn("phone_writes_disabled", report["failed_checks"])
        self.assertNotIn("DO_NOT_ECHO", encoded)

    def test_cli_hashes_retained_evidence_and_never_changes_inputs(self):
        values = valid_inputs()
        now = int(time.time() * 1000)
        values[0]["observed_at"] = now
        values[3]["observed_at"] = now
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            names = ("readiness.json", "delivery.json", "verified.json", "phone.json")
            paths = []
            for name, value in zip(names, values):
                path = root / name
                path.write_text(json.dumps(value))
                paths.append(path)
            evidence = root / "phone-recording.mp4"
            evidence.write_bytes(EVIDENCE)
            before = [path.read_bytes() for path in (*paths, evidence)]
            result = subprocess.run([
                sys.executable, str(SCRIPT), *(str(path) for path in paths),
                str(evidence), SOURCE, DELIVERY_ID,
            ], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            report = json.loads(result.stdout)
            self.assertEqual(report["phone_evidence_sha256"], EVIDENCE_SHA)
            self.assertEqual([path.read_bytes() for path in (*paths, evidence)], before)

            evidence.write_bytes(EVIDENCE + b"changed")
            result = subprocess.run([
                sys.executable, str(SCRIPT), *(str(path) for path in paths),
                str(evidence), SOURCE, DELIVERY_ID,
            ], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2, result.stderr)
            self.assertIn("phone_evidence_file_exact", json.loads(result.stdout)["failed_checks"])

            evidence.write_bytes(EVIDENCE)
            linked = root / "linked-recording.mp4"
            linked.symlink_to(evidence)
            result = subprocess.run([
                sys.executable, str(SCRIPT), *(str(path) for path in paths),
                str(linked), SOURCE, DELIVERY_ID,
            ], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
            self.assertIn("symlinks are not permitted", result.stderr)


if __name__ == "__main__":
    unittest.main()
