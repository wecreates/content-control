import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts import v2_runtime_tick as runtime


class V2RuntimeTickTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.video = self.root / 'candidate.mp4'
        self.video.write_bytes(b'existing accepted artifact')
        self.health = self.root / 'health.json'
        self.record = dict(status='READY', publication_enabled=False,
                           technical_qa=True, creative_qa=True, visual_parity_qa=True,
                           candidate_sha256=hashlib.sha256(self.video.read_bytes()).hexdigest())
        self.save()

    def save(self):
        self.health.write_text(json.dumps(self.record))

    def validate(self, **kwargs):
        return runtime.validate_candidate(self.health, self.video, **kwargs)

    def test_hash_bound_accepted_record_validates_without_fresh_review_claim(self):
        result = self.validate()
        self.assertEqual(result['status'], 'READY')
        self.assertFalse(result['fresh_creative_review'])
        self.assertFalse(result['render_attempted'])

    def test_each_gate_requires_exact_boolean_true(self):
        for gate in ('technical_qa', 'creative_qa', 'visual_parity_qa'):
            for value in (None, False, 'true', 1):
                with self.subTest(gate=gate, value=value):
                    original = self.record[gate]
                    self.record[gate] = value
                    self.save()
                    self.assertIn(gate + '_not_verified', self.validate()['reasons'])
                    self.record[gate] = original

    def test_tampered_artifact_is_blocked(self):
        self.video.write_bytes(b'changed artifact')
        self.assertIn('candidate_sha256_mismatch', self.validate()['reasons'])

    def test_missing_and_empty_artifacts_blocked(self):
        self.video.unlink()
        self.assertIn('candidate_missing_or_unreadable', self.validate()['reasons'])
        self.video.write_bytes(b'')
        self.assertIn('candidate_empty', self.validate()['reasons'])

    def test_missing_or_malformed_health_blocked(self):
        for data in ('{', '[]'):
            self.health.write_text(data)
            self.assertIn('health_missing_or_invalid', self.validate()['reasons'])
        self.health.unlink()
        self.assertIn('health_missing_or_invalid', self.validate()['reasons'])

    def test_publication_must_be_explicitly_disabled(self):
        self.assertIn('publication_enabled_environment', self.validate(publication_enabled=True)['reasons'])
        for value in (True, None, 0):
            self.record['publication_enabled'] = value
            self.save()
            self.assertIn('publication_not_explicitly_disabled', self.validate()['reasons'])

    def test_metadata_heuristic_is_not_creative_review(self):
        self.record['metrics'] = {'scene_count': 24, 'has_conflict': True}
        self.save()
        self.assertIn('creative_evidence_is_metadata_only', self.validate()['reasons'])
        self.record['creative_review'] = dict(status='PASS', method='rendered_review', candidate_sha256=self.record['candidate_sha256'])
        self.save()
        self.assertEqual(self.validate()['status'], 'READY')
        self.record['creative_review']['candidate_sha256'] = '0' * 64
        self.save()
        self.assertIn('creative_review_not_hash_bound', self.validate()['reasons'])

    def test_tick_never_renders_or_overwrites_acceptance_evidence_even_on_failure(self):
        originals = (self.health.read_bytes(), self.video.read_bytes())
        status = self.root / 'runtime.json'
        with patch.object(runtime, 'HEALTH', self.health), patch.object(runtime, 'OUT', self.video), patch.object(runtime, 'RUNTIME_STATUS', status), patch.dict('os.environ', {'PUBLICATION_ENABLED': 'false'}), patch('subprocess.run', side_effect=AssertionError('must not run')):
            self.assertEqual(runtime.tick()['status'], 'READY')
            with patch.dict('os.environ', {'PUBLICATION_ENABLED': 'true'}):
                self.assertEqual(runtime.tick()['status'], 'BLOCKED')
        self.assertEqual((self.health.read_bytes(), self.video.read_bytes()), originals)
        self.assertEqual(json.loads(status.read_text())['status'], 'BLOCKED')


if __name__ == '__main__':
    unittest.main()
