"""Offline orchestration fixtures, not decoded-frame or artistic validation."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from scripts import run_visual_analysis as runner


class VisualAnalysisLaneTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.out = self.root / 'output'
        self.calls = []
        for lane, (video, review) in runner.LANES.items():
            path = self.root / video
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(('synthetic, not a video: ' + lane).encode())
        self.health = self.root / runner.HEALTH
        self.health.parent.mkdir(parents=True)
        self.save_health()

    def digest(self, lane='canonical-v10'):
        return hashlib.sha256((self.root / runner.LANES[lane][0]).read_bytes()).hexdigest()

    def save_health(self, **overrides):
        data = {'candidate_sha256': self.digest(), 'publication_enabled': False}
        data.update(overrides)
        runner.write_json(self.health, data)

    def save_review(self, lane, value):
        path = self.root / runner.LANES[lane][1]
        path.parent.mkdir(parents=True, exist_ok=True)
        runner.write_json(path, value)

    def fake_execute(self, command, cwd, check):
        self.assertEqual(cwd, self.root)
        self.assertTrue(check)
        self.calls.append(command)
        video_flag = '--candidate-video' if '--candidate-video' in command else '--video'
        video = cwd / command[command.index(video_flag) + 1]
        report = {'candidate_sha256': hashlib.sha256(video.read_bytes()).hexdigest(),
                  'analysis_status': 'COMPLETE', 'publication_enabled': False,
                  'production_approved': False, 'decoded_frames': 0}
        if '--visual-review' in command:
            review_path = cwd / command[command.index('--visual-review') + 1]
            report.update(visual_review_sha256=hashlib.sha256(review_path.read_bytes()).hexdigest(),
                          visual_review={'status': 'BLOCKED', 'blocker': 'INVALID_VISUAL_REVIEW'})
        runner.write_json(Path(command[command.index('--out') + 1]), report)

    def run_lane(self, lane='canonical-v10', execute=None):
        return runner.run(self.root, lane, self.out, 123, 'a' * 40, execute or self.fake_execute)

    def assert_no_receipt(self):
        self.assertFalse((self.out / 'run.json').exists())

    def test_v10_health_bound_analysis_never_approves(self):
        result = self.run_lane()
        self.assertEqual(result['candidate_sha256'], self.digest())
        self.assertEqual(result['health_sha256'], hashlib.sha256(self.health.read_bytes()).hexdigest())
        self.assertEqual(result['review']['blocker'], 'MISSING_VISUAL_REVIEW')
        self.assertFalse(result['production_approved'])
        self.assertFalse(result['publication_enabled'])
        self.assertIn('--analysis-only', self.calls[0])
        self.assertIn(runner.LANES['canonical-v10'][0], self.calls[0])
        self.assertNotIn('--visual-review', self.calls[0])

    def test_v2_remains_independent_of_canonical_health(self):
        self.health.unlink()
        result = self.run_lane('v2')
        self.assertEqual(result['candidate_path'], 'public-review/v2-draft.mp4')
        self.assertNotIn('health_sha256', result)

    def test_invalid_lane_fails_before_analysis(self):
        with self.assertRaisesRegex(ValueError, 'Unknown candidate lane'):
            self.run_lane('v11')
        self.assertFalse(self.calls)

    def test_missing_candidate_fails_before_analysis(self):
        (self.root / runner.LANES['canonical-v10'][0]).unlink()
        with self.assertRaises(OSError):
            self.run_lane()
        self.assertFalse(self.calls)
        self.assert_no_receipt()

    def test_empty_candidate_fails_before_analysis(self):
        (self.root / runner.LANES['canonical-v10'][0]).write_bytes(b'')
        with self.assertRaises(ValueError):
            self.run_lane()
        self.assertFalse(self.calls)

    def test_missing_health_fails_before_analysis(self):
        self.health.unlink()
        with self.assertRaises(OSError):
            self.run_lane()
        self.assertFalse(self.calls)

    def test_health_hash_mismatch_fails_before_analysis(self):
        self.save_health(candidate_sha256='b' * 64)
        with self.assertRaisesRegex(ValueError, 'does not match'):
            self.run_lane()
        self.assertFalse(self.calls)

    def test_invalid_health_and_publication_fail_closed(self):
        for data in ([], {'candidate_sha256': 'bad'},
                     {'candidate_sha256': self.digest(), 'publication_enabled': True}):
            with self.subTest(data=data):
                runner.write_json(self.health, data)
                with self.assertRaises(ValueError):
                    self.run_lane()
                self.assertFalse(self.calls)

    def test_health_change_during_analysis_cannot_seal(self):
        def execute(*args, **kwargs):
            self.fake_execute(*args, **kwargs)
            self.save_health(revision='changed despite same media')
        with self.assertRaisesRegex(ValueError, 'changed during analysis'):
            self.run_lane(execute=execute)
        self.assert_no_receipt()

    def test_media_change_during_analysis_cannot_seal(self):
        def execute(*args, **kwargs):
            self.fake_execute(*args, **kwargs)
            (self.root / runner.LANES['canonical-v10'][0]).write_bytes(b'changed')
        with self.assertRaises(ValueError):
            self.run_lane(execute=execute)
        self.assert_no_receipt()

    def test_old_v2_review_is_never_used_for_v10(self):
        self.save_review('v2', {'candidate': {'sha256': self.digest()}})
        self.assertEqual(self.run_lane()['review']['blocker'], 'MISSING_VISUAL_REVIEW')
        self.assertNotIn('--visual-review', self.calls[0])

    def test_outdated_review_is_distinct_and_not_rebound(self):
        review = {'candidate': {'sha256': 'b' * 64}}
        self.save_review('canonical-v10', review)
        result = self.run_lane()
        self.assertEqual(result['review']['blocker'], 'OUTDATED_VISUAL_REVIEW')
        self.assertNotIn('--visual-review', self.calls[0])
        self.assertEqual(json.loads((self.root / runner.LANES['canonical-v10'][1]).read_text()), review)

    def test_malformed_review_is_distinct(self):
        self.save_review('canonical-v10', {'candidate': None})
        self.assertEqual(self.run_lane()['review']['blocker'], 'INVALID_VISUAL_REVIEW')

    def test_identity_match_still_requires_existing_review_evaluator(self):
        self.save_review('canonical-v10', {'candidate': {'sha256': self.digest()}})
        result = self.run_lane()
        self.assertIn('--visual-review', self.calls[0])
        self.assertEqual(result['review']['blocker'], 'INVALID_VISUAL_REVIEW')
        self.assertFalse(result['production_approved'])

    def test_review_change_during_analysis_cannot_seal(self):
        def execute(*args, **kwargs):
            self.fake_execute(*args, **kwargs)
            self.save_review('canonical-v10', {'candidate': {'sha256': self.digest()}})
        with self.assertRaisesRegex(ValueError, 'review changed'):
            self.run_lane(execute=execute)
        self.assert_no_receipt()

    def test_failed_analysis_cannot_seal(self):
        def execute(*args, **kwargs):
            raise subprocess.CalledProcessError(2, args[0])
        with self.assertRaises(subprocess.CalledProcessError):
            self.run_lane(execute=execute)
        self.assert_no_receipt()

    def test_mismatched_incomplete_or_approval_reports_cannot_seal(self):
        for update in ({'candidate_sha256': 'b' * 64}, {'analysis_status': 'FAILED'},
                       {'publication_enabled': True}, {'production_approved': True}):
            with self.subTest(update=update):
                self.out = self.root / ('case-' + next(iter(update)))
                def execute(command, **kwargs):
                    self.fake_execute(command, **kwargs)
                    path = Path(command[command.index('--out') + 1])
                    data = json.loads(path.read_text())
                    data.update(update)
                    runner.write_json(path, data)
                with self.assertRaises(ValueError):
                    self.run_lane(execute=execute)
                self.assert_no_receipt()

    def test_preexisting_receipt_is_not_overwritten(self):
        self.out.mkdir()
        receipt = self.out / 'run.json'
        receipt.write_text('old')
        with self.assertRaisesRegex(ValueError, 'must be empty'):
            self.run_lane()
        self.assertEqual(receipt.read_text(), 'old')
        self.assertFalse(self.calls)

    def test_last_health_check_runs_before_seal(self):
        original = runner.bind_candidate
        count = 0
        def changing(root, lane):
            nonlocal count
            count += 1
            if count == 3:
                self.save_health(revision='changed before sealing')
            return original(root, lane)
        with patch.object(runner, 'bind_candidate', side_effect=changing):
            with self.assertRaisesRegex(ValueError, 'before receipt'):
                self.run_lane()
        self.assert_no_receipt()

    def test_late_review_change_cannot_seal(self):
        self.save_review('canonical-v10', {'candidate': {'sha256': self.digest()}})
        original = runner.bind_candidate
        count = 0
        def changing(root, lane):
            nonlocal count
            count += 1
            if count == 3:
                self.save_review('canonical-v10', {'candidate': {'sha256': self.digest()},
                                                   'late_edit': True})
            return original(root, lane)
        with patch.object(runner, 'bind_candidate', side_effect=changing):
            with self.assertRaisesRegex(ValueError, 'Visual review changed before receipt'):
                self.run_lane()
        self.assert_no_receipt()

    def test_pull_request_workflow_runs_lane_and_decode_regressions(self):
        text = (Path(__file__).resolve().parents[1] / '.github/workflows/visual-review-tests.yml').read_text()
        self.assertIn('  pull_request:', text)
        for path in ('.github/workflows/visual-analysis.yml', 'scripts/run_visual_analysis.py',
                     'tests/test_run_visual_analysis.py'):
            self.assertIn("      - '" + path + "'", text)
        self.assertIn('python -m unittest tests.test_run_visual_analysis -v', text)
        for module in ('test_rendered_visual_parity.py', 'test_reconcile_visual_review.py',
                       'test_visual_review_reference_decode.py'):
            self.assertIn("python -m unittest discover -s tests -p '" + module + "' -v", text)
        self.assertIn('contents: read', text)
        self.assertIn('if: github.event.repository.private == false', text)
        self.assertNotIn('  schedule:', text)
        self.assertNotIn('  workflow_dispatch:', text)
        self.assertNotIn('  push:', text)

    def test_workflow_defaults_schedule_and_push_to_v2(self):
        text = (Path(__file__).resolve().parents[1] / '.github/workflows/visual-analysis.yml').read_text()
        self.assertIn('default: v2', text)
        self.assertIn("CANDIDATE_LANE: ${{ inputs.candidate_lane || 'v2' }}", text)
        self.assertIn('options: [v2, canonical-v10]', text)
        self.assertIn("- cron: '31 * * * *'", text)
        self.assertIn("- 'public-review/v2-draft.mp4'", text)
        self.assertNotIn("- 'public-review/episode1-v10-free.mp4'", text)
        self.assertIn('tests.test_run_visual_analysis', text)
        self.assertIn('contents: read', text)
        self.assertNotIn('git push', text)


if __name__ == '__main__':
    unittest.main()
