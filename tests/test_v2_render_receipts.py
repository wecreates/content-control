import unittest
from scripts.v2_render_receipts import verified_media_evidence


class V2RenderReceiptTests(unittest.TestCase):
    def setUp(self):
        self.hash = 'a' * 64
        self.parity = {'status': 'PASS', 'candidate_sha256': self.hash}
        self.media = {'status': 'PASS', 'candidate_sha256': self.hash, 'metrics': {'duration': 35.04}}

    def test_exact_candidate_receipts_provide_measured_duration(self):
        result = verified_media_evidence(self.hash, self.parity, self.media)
        self.assertEqual(result, {'candidate_sha256': self.hash, 'duration_seconds': 35.04, 'verified': True})

    def test_pass_from_different_video_is_rejected_for_each_receipt(self):
        for receipt in (self.parity, self.media):
            with self.subTest(receipt=receipt):
                receipt['candidate_sha256'] = 'b' * 64
                with self.assertRaises(ValueError):
                    verified_media_evidence(self.hash, self.parity, self.media)
                receipt['candidate_sha256'] = self.hash

    def test_missing_failed_or_unbound_receipt_is_rejected(self):
        for bad in (None, {}, {'status': 'PASS'}, {'status': 'FAIL', 'candidate_sha256': self.hash}):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    verified_media_evidence(self.hash, bad, self.media)
                with self.assertRaises(ValueError):
                    verified_media_evidence(self.hash, self.parity, bad)

    def test_invalid_duration_cannot_become_verified(self):
        for duration in (None, True, 0, -1, float('nan'), float('inf'), '35'):
            self.media['metrics']['duration'] = duration
            with self.subTest(duration=duration), self.assertRaises(ValueError):
                verified_media_evidence(self.hash, self.parity, self.media)

    def test_invalid_candidate_identity_rejected(self):
        for bad in ('', 'draft', None, 'a' * 63):
            with self.subTest(hash=bad), self.assertRaises(ValueError):
                verified_media_evidence(bad, self.parity, self.media)


if __name__ == '__main__':
    unittest.main()
