import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from scripts.offline_av_review import prepare


class OfflineReviewTests(unittest.TestCase):
    def test_actual_media_pack_preserves_hash_and_cannot_approve(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            video = root / 'source.mp4'
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=24:duration=1.5', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.5', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', str(video)], check=True)
            digest = hashlib.sha256(video.read_bytes()).hexdigest()
            with self.assertRaises(ValueError):
                prepare(video, root / 'bad', '0' * 64)
            self.assertFalse((root / 'bad').exists())
            result = prepare(video, root / 'pack', digest, .5)
            self.assertEqual(result['technical_decode'], 'PASS')
            self.assertEqual(result['status'], 'REVIEW_REQUIRED')
            for key in ['full_video_review', 'full_audio_review', 'publication_enabled', 'production_approved']:
                self.assertIs(result[key], False)
            self.assertEqual([s['frame_index'] for s in result['samples']], [0, 12, 24])
            self.assertEqual([s['time_seconds'] for s in result['samples']], [0, .5, 1])
            self.assertEqual(hashlib.sha256((root / 'pack/candidate.mp4').read_bytes()).hexdigest(), digest)
            with self.assertRaises(FileExistsError):
                prepare(video, root / 'pack', digest)
            self.assertEqual(hashlib.sha256(video.read_bytes()).hexdigest(), digest)


if __name__ == '__main__':
    unittest.main()
