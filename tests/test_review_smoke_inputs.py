import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest
from scripts.review_smoke_inputs import inspect

REPO = Path(__file__).resolve().parents[1]


class SmokeInputTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'state').mkdir()
        (self.root / 'public-review').mkdir()
        self.media = b'SYNTHETIC byte-binding fixture only'
        self.vtt = b'WEBVTT\n\nSYNTHETIC fixture'
        (self.root / 'public-review/episode1-v10-free.mp4').write_bytes(self.media)
        (self.root / 'public-review/episode1-v10-free.vtt').write_bytes(self.vtt)
        self.hash = hashlib.sha256(self.media).hexdigest()
        self.write('content-control-health.json', {'status': 'GREEN', 'publication_enabled': False, 'candidate_sha256': self.hash})
        self.write('caption-health.json', {'status': 'PASS', 'publication_enabled': False, 'candidate_sha256': self.hash, 'caption_sha256': hashlib.sha256(self.vtt).hexdigest()})

    def write(self, name, value):
        (self.root / 'state' / name).write_text(json.dumps(value))

    def test_bound_inputs_do_not_grant_production_approval(self):
        result = inspect(self.root)
        self.assertEqual(result['status'], 'INPUTS_BOUND')
        self.assertFalse(result['production_approved'])

    def test_failed_receipt_retains_observed_metadata_without_approval(self):
        self.write('caption-health.json', {'status': 'FAIL', 'publication_enabled': False})
        result = inspect(self.root)
        self.assertEqual(result['status'], 'BLOCKED')
        self.assertIn('caption_receipt_not_pass', result['reasons'])
        self.assertEqual(result['observed']['caption'], hashlib.sha256(self.vtt).hexdigest())
        self.assertNotIn('caption_sha256', result)

    def test_missing_caption_and_changed_candidate_block(self):
        (self.root / 'public-review/episode1-v10-free.vtt').unlink()
        (self.root / 'public-review/episode1-v10-free.mp4').write_bytes(b'SYNTHETIC changed')
        result = inspect(self.root)
        self.assertEqual(result['status'], 'BLOCKED')
        self.assertIn('candidate_binding_missing_or_mismatched', result['reasons'])
        self.assertIn('caption_bytes_missing_or_invalid', result['reasons'])

    def receipt_script(self, workflow, step):
        source = (REPO / '.github/workflows' / workflow).read_text()
        section = source.split('- name: ' + step, 1)[1]
        script = section.split("python - <<'PY'\n", 1)[1].split('\n          PY', 1)[0]
        return textwrap.dedent(script)

    def test_local_receipt_requires_successful_assertions_not_file_existence(self):
        script = self.receipt_script('review-server-smoke.yml', 'Emit smoke receipt')
        script = script.replace('${{ steps.routes.outcome }}', 'success').replace('${{ steps.corruption.outcome }}', 'failure')
        subprocess.run([sys.executable, '-c', script], cwd=self.root, check=True, capture_output=True)
        receipt = json.loads((self.root / 'state/review-server-smoke.json').read_text())
        self.assertEqual(receipt['status'], 'INCOMPLETE')
        self.assertFalse(receipt['fail_closed_corruption_verified'])

    def test_live_receipt_never_treats_two_missing_hashes_as_match(self):
        self.write('deployment-contract.json', {'public_base_url': 'https://synthetic.invalid'})
        self.write('caption-health.json', {'status': 'FAIL'})
        script = self.receipt_script('live-render-deployment-smoke.yml', 'Write live deployment receipt')
        script = script.replace('${{ steps.probe.outcome }}', 'failure').replace('/tmp/live-probe', str(self.root / 'absent').replace('\\', '/'))
        subprocess.run([sys.executable, '-c', script], cwd=self.root, check=True, capture_output=True)
        receipt = json.loads((self.root / 'state/live-deployment-health.json').read_text())
        self.assertEqual(receipt['status'], 'FAIL')
        self.assertFalse(receipt['checks']['caption_hash_matches'])
        self.assertFalse(receipt['checks']['probe_completed'])

    def test_live_surface_uses_exact_caption_url_and_stale_guard(self):
        source = (REPO / '.github/workflows/live-render-deployment-smoke.yml').read_text()
        self.assertIn('/captions?sha256=$EXPECTED_CAPTION', source)
        self.assertIn("if: always() && steps.source_guard.outcome == 'success'", source)


if __name__ == '__main__':
    unittest.main()
