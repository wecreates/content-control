import tempfile
import subprocess
import unittest
from pathlib import Path
from scripts.offline_av_review import build, sha


class OfflineReviewTests(unittest.TestCase):
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

