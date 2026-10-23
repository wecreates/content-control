"""Synthetic contract tests only; these fixtures are never creative evidence."""
import json
import tempfile
import unittest
from pathlib import Path
import cv2
import numpy as np
from scripts.rendered_visual_parity import evaluate_visual_review, REVIEW_DIMENSIONS, sha256
from scripts.reconcile_visual_review import reconcile
from scripts.v2_build_status import RECEIPTS


class ReferenceDecodeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.video = self.root / 'candidate.avi'
        image = np.full((80, 80, 3), 255, np.uint8)
        cv2.line(image, (10, 10), (65, 65), (0, 0, 0), 4)
        writer = cv2.VideoWriter(str(self.video), cv2.VideoWriter_fourcc(*'MJPG'), 8, (80, 80))
        self.assertTrue(writer.isOpened())
        try:
            for _ in range(8): writer.write(image)
        finally:
            writer.release()
        for i in range(4):
            self.assertTrue(cv2.imwrite(str(self.root / f'ref-{i}.jpg'), image))

    def review(self):
        return {
            'review_type': 'independent_sampled_frame_visual_analysis',
            'candidate': {'sha256': sha256(self.video)},
            'reviewer': {'id': 'fixture-only', 'method': 'Synthetic test; not real inspection'},
            'reviewed_at': '2026-10-23T00:00:00Z',
            'coverage': {'sample_count': 8, 'sampled_frame_indices': list(range(8))},
            'reference_frames': [{'path': p.name, 'sha256': sha256(p)} for p in sorted(self.root.glob('ref-*.jpg'))],
            'decision': 'PASS', 'unresolved_issues': [],
            'findings': [{'dimension': d, 'status': 'PASS', 'candidate_frames': [0, 7],
                          'observation': 'Synthetic test contract only.'} for d in REVIEW_DIMENSIONS],
        }

    def reconcile_review(self):
        def save(name, value):
            p = self.root / name
            p.write_text(json.dumps(value))
            return p
        h = sha256(self.video)
        technical = save('technical.json', {'candidate_sha256': h, 'status': 'PASS',
                         'checks': {'decodes': True}, 'publication_enabled': False})
        checks = {key: {'status': 'PASS'} for key in RECEIPTS}
        checks['style_parity'] = {'status': 'BLOCKED'}
        checks['technical_video']['receipt_sha256'] = sha256(technical)
        report = save('report.json', {'run_id': 123, 'source_commit': 'a'*40, 'candidate_sha256': h,
                      'checks': checks, 'publication_enabled': False, 'production_approved': False})
        draft = save('draft.json', {'run_id': 123, 'candidate_sha256': h,
                     'publication_enabled': False, 'production_approved': False})
        return reconcile(self.video, self.root, save('review.json', self.review()),
                         report, draft, technical, 456, 'b'*40)

    def test_decodable_hash_bound_reference_review_remains_valid(self):
        result = evaluate_visual_review(self.root, self.video, self.review())
        self.assertEqual(result['status'], 'PASS')
        self.assertFalse(result['production_approved'])
        self.assertFalse(result['publication_enabled'])

    def test_corrupt_reference_with_matching_hash_is_blocked(self):
        for invalid in (b'', b'not an image', b'\xff\xd8\xff\xe0truncated'):
            with self.subTest(invalid=invalid):
                (self.root / 'ref-0.jpg').write_bytes(invalid)
                result = evaluate_visual_review(self.root, self.video, self.review())
                self.assertEqual(result['status'], 'BLOCKED')
                self.assertEqual(result['blocker'], 'INVALID_VISUAL_REVIEW')
                self.assertIn('cannot be decoded', result['reason'])
                self.assertFalse(result['framewise_style_parity'])

    def test_reconciliation_cannot_upgrade_corrupt_hash_bound_references(self):
        (self.root / 'ref-0.jpg').write_bytes(b'not an image')
        updated, payload = self.reconcile_review()
        evidence = json.loads(payload)
        self.assertEqual(updated['checks']['style_parity']['status'], 'BLOCKED')
        self.assertEqual(evidence['status'], 'BLOCKED')
        self.assertFalse(evidence['visual_review']['framewise_style_parity'])
        self.assertEqual(updated['remaining_review']['full_audiovisual'], 'NOT_APPROVED')
        self.assertFalse(updated['production_approved'])
        self.assertFalse(updated['publication_enabled'])

    def test_valid_reconciliation_still_requires_full_audiovisual_review(self):
        updated, payload = self.reconcile_review()
        self.assertEqual(updated['checks']['style_parity']['status'], 'PASS')
        self.assertEqual(updated['status'], 'REVIEW_REQUIRED')
        self.assertEqual(updated['remaining_review']['full_audiovisual'], 'NOT_APPROVED')
        self.assertFalse(updated['production_approved'])
        self.assertFalse(updated['publication_enabled'])


if __name__ == '__main__': unittest.main()
