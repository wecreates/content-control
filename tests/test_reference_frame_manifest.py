import json
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from scripts.reference_frame_manifest import build_manifest, canonical_source_url, sha256


class ReferenceFrameManifestTests(unittest.TestCase):
    def fixture(self, root):
        video = root / 'fixture.avi'
        writer = cv2.VideoWriter(str(video), cv2.VideoWriter_fourcc(*'MJPG'), 12, (96, 96))
        self.assertTrue(writer.isOpened())
        for index in range(12):
            frame = np.full((96, 96, 3), 255, np.uint8)
            cv2.rectangle(frame, (index * 4, 20), (index * 4 + 20, 60), (0, 0, 0), -1)
            writer.write(frame)
        writer.release()
        return video

    def test_real_video_samples_and_hashes_bound_without_claiming_url_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            video = self.fixture(root)
            out = root / 'frames'
            report = build_manifest(video, 'https://example.org/reel/test/?token=secret#fragment', out, 4)
            self.assertEqual([f['source_frame'] for f in report['frames']], [0, 4, 7, 11])
            self.assertEqual(report['decoded_frame_count'], 12)
            self.assertEqual(report['source_video_sha256'], sha256(video))
            self.assertFalse(report['source_url_attribution_verified'])
            self.assertFalse(report['production_approved'])
            self.assertEqual(report['source_url'], 'https://example.org/reel/test/')
            self.assertEqual(json.loads((out / 'reference-manifest.json').read_text()), report)
            for frame in report['frames']:
                self.assertEqual(frame['sha256'], sha256(out / frame['file']))
            self.assertEqual(len({f['sha256'] for f in report['frames']}), 4)

    def test_does_not_mix_stale_frames_or_overwrite_existing_package(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            video = self.fixture(root)
            out = root / 'frames'
            out.mkdir()
            sentinel = out / 'ref-stale.jpg'
            sentinel.write_bytes(b'preserve')
            with self.assertRaises(ValueError):
                build_manifest(video, 'https://example.org/a', out, 4)
            self.assertEqual(sentinel.read_bytes(), b'preserve')

    def test_bad_source_and_sample_count_leave_no_package(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            video = root / 'broken.mp4'
            video.write_bytes(b'not a movie')
            for count in (4, 3, True, 101):
                with self.assertRaises(ValueError):
                    build_manifest(video, 'https://example.org/a', root / 'frames', count)
                self.assertFalse((root / 'frames').exists())

    def test_youtube_video_identity_is_preserved_without_tracking(self):
        self.assertEqual(canonical_source_url('https://www.youtube.com/watch?v=qF7dkrce-mQ&token=secret'),
                         'https://www.youtube.com/watch?v=qF7dkrce-mQ')

    def test_source_locator_rejects_credentials_and_non_https(self):
        for url in ('http://example.org/a', 'https://user:secret@example.org/a', 'file:///a', 'https://example.org:8000/a'):
            with self.assertRaises(ValueError):
                canonical_source_url(url)
