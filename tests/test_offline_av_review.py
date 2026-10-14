import tempfile
import subprocess
import unittest
from unittest.mock import patch
from pathlib import Path
from scripts.offline_av_review import build, sha


class OfflineReviewTests(unittest.TestCase):
    def test_probe_mutation_cannot_bind_old_metadata_to_new_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            video = root / 'source.mp4'
            video.write_bytes(b'original')
            def mutate(*args, **kwargs):
                self.assertEqual(kwargs['timeout'], 30)
                video.write_bytes(b'replaced')
                return b'{"streams":[{"codec_type":"video"},{"codec_type":"audio"}],"format":{"duration":"1"}}'
            with patch('scripts.offline_av_review.subprocess.check_output', side_effect=mutate):
                with self.assertRaisesRegex(ValueError, 'mutated during media probe'):
                    build(video, root / 'review')
            self.assertFalse((root / 'review').exists())

    def test_probe_timeout_does_not_create_partial_review(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            video = root / 'source.mp4'
            video.write_bytes(b'original')
            with patch('scripts.offline_av_review.subprocess.check_output', side_effect=subprocess.TimeoutExpired('ffprobe', 30)):
                with self.assertRaises(subprocess.TimeoutExpired):
                    build(video, root / 'review')
            self.assertFalse((root / 'review').exists())

    def test_actual_media_copy_decode_and_no_approval(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            video = root / 'source.mp4'
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i',
                'testsrc2=size=160x90:rate=24:duration=1', '-f', 'lavfi', '-i',
                'sine=frequency=440:duration=1', '-c:v', 'libx264', '-c:a', 'aac', str(video)], check=True)
            before = sha(video)
            result = build(video, root / 'review')
            self.assertEqual(result['candidate_sha256'], before)
            self.assertEqual(sha(root / 'review/candidate.mp4'), before)
            self.assertEqual(result['technical_decode'], 'PASS')
            self.assertEqual(result['status'], 'REVIEW_PENDING')
            self.assertFalse(result['full_audio_review'])
            self.assertFalse(result['production_approved'])
            self.assertFalse(result['publication_enabled'])
            with self.assertRaises(ValueError):
                build(video, root / 'review')
            self.assertEqual(sha(video), before)

