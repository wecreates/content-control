import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from scripts.record_production_execution import summarize, REQUIRED, PROBE_REQUIRED


class ExecutionSummaryTests(unittest.TestCase):
    def test_missing_candidate_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = summarize(tmp, 'long', 12, 1, 'b' * 40, 'success')
            self.assertEqual(result['technical_status'], 'BLOCKED')
            self.assertIsNone(result['candidate_sha256'])
            self.assertFalse(result['production_approved'])

    def test_hash_bound_receipts_never_grant_review_or_playback(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root / 'candidate.mp4').write_bytes(b'fixture candidate')
            digest = hashlib.sha256(b'fixture candidate').hexdigest()
            receipt = dict(status='PASS', candidate_sha256=digest, checks={key: True for key in REQUIRED | PROBE_REQUIRED}, publication_enabled=False)
            for name in ['media-qa.json', 'openmontage-probe.json']:
                (root / name).write_text(json.dumps(receipt))
            (root / 'execution.json').write_text(json.dumps(dict(status='REVIEW_CANDIDATE', candidate_sha256=digest, publication_enabled=False, production_approved=False)))
            result = summarize(root, 'short', 12, 1, 'b' * 40, 'success')
            self.assertEqual(result['technical_status'], 'PASS')
            self.assertEqual(result['creative_review'], 'PENDING')
            self.assertEqual(result['audio_listening_review'], 'PENDING')
            self.assertFalse(result['publication_enabled'])
            self.assertNotIn('watch_url', result)
            self.assertEqual(summarize(root, 'short', 12, 1, 'b' * 40, 'failure')['technical_status'], 'BLOCKED')
            (root / 'media-qa.json').write_text(json.dumps({**receipt, 'checks': {'decodes': True}}))
            self.assertEqual(summarize(root, 'short', 12, 1, 'b' * 40, 'success')['technical_status'], 'BLOCKED')
            (root / 'candidate.mp4').write_bytes(b'changed')
            self.assertEqual(summarize(root, 'short', 12, 1, 'b' * 40, 'success')['technical_status'], 'BLOCKED')

    def test_malformed_receipts_do_not_abort_recording_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root / 'candidate.mp4').write_bytes(b'x')
            (root / 'execution.json').write_text('{')
            (root / 'media-qa.json').write_text('[]')
            self.assertEqual(summarize(root, 'long', 12, 1, 'b' * 40, 'failure')['status'], 'BLOCKED')
