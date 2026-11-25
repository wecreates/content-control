import tempfile
import json
import struct
import subprocess
import unittest
import wave
from unittest.mock import patch
from pathlib import Path
from scripts.offline_av_review import build, playback_audio, sha


class OfflineReviewTests(unittest.TestCase):
    def test_clock_clips_priming_overlap_and_padding_and_fills_gaps(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw, playback = root / 'raw.wav', root / 'playback.wav'
            with wave.open(str(raw), 'wb') as wav:
                wav.setparams((1, 2, 10, 0, 'NONE', 'not compressed'))
                wav.writeframes(struct.pack('<12h', *range(1, 13)))
            media = {'start_time': '2.0', 'duration': '1.5'}
            stream = {'time_base': '1/10', 'start_pts': 19, 'duration_ts': 13}
            # First frame begins before origin, overlaps the next one and uses the old probe key.
            frames = [
                {'pts': 19, 'nb_samples': 4, 'pkt_duration': 4},
                {'pts': 22, 'nb_samples': 4, 'duration': 2},
                {'pts': 29, 'nb_samples': 4, 'duration': 4},
            ]
            stats = playback_audio(raw, playback, stream, media, frames)
            with wave.open(str(playback), 'rb') as wav:
                self.assertEqual(wav.getnframes(), 15)
                self.assertEqual(struct.unpack('<15h', wav.readframes(15)),
                                 (2, 3, 5, 6, 0, 0, 0, 0, 0, 9, 10, 11, 0, 0, 0))
            self.assertEqual(stats['trimmed_source_samples'], 5)
            self.assertEqual(stats['silence_fill_samples'], 8)
            with self.assertRaisesRegex(ValueError, 'sample count differs'):
                playback_audio(raw, playback, stream, media, frames[1:])
            frames[1]['pts'] = frames[0]['pts']
            with self.assertRaisesRegex(ValueError, 'frame metadata'):
                playback_audio(raw, playback, stream, media, frames)

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

    def test_wrong_or_malformed_pins_leave_no_review_and_do_not_probe(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            video, captions = root / 'source.mp4', root / 'source.vtt'
            video.write_bytes(b'owned source')
            captions.write_bytes(b'WEBVTT\n\n')
            for kwargs, message in (
                    ({'expected_sha256': '0' * 64}, 'Candidate does not match'),
                    ({'expected_sha256': 'bad'}, 'Expected candidate SHA-256'),
                    ({'captions': captions, 'expected_caption_sha256': '0' * 64}, 'Caption does not match'),
                    ({'expected_caption_sha256': sha(captions)}, 'requires a caption file')):
                with self.subTest(kwargs=kwargs), patch('scripts.offline_av_review.subprocess.check_output') as probe:
                    with self.assertRaisesRegex(ValueError, message):
                        build(video, root / 'review', **kwargs)
                    probe.assert_not_called()
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
            with wave.open(str(root / 'review/final-mix.wav'), 'rb') as wav:
                rate, decoded_samples = wav.getframerate(), wav.getnframes()
            self.assertGreaterEqual(decoded_samples, rate)
            with wave.open(str(root / 'review/playback-mix.wav'), 'rb') as wav:
                self.assertEqual(wav.getnframes(), rate)
            packets = json.loads((root / 'review/review-packets.json').read_text())
            self.assertEqual(packets['audio_source'], 'playback-mix.wav')
            self.assertEqual(packets['audio_clock'], result['audio_clock'])
            self.assertEqual(packets['packets'][-1]['end_sec'], 1)
            self.assertNotIn('caption_sha256', result)
            self.assertNotIn('<track ', (root / 'review/index.html').read_text())
            with self.assertRaises(ValueError):
                build(video, root / 'review')
            self.assertEqual(sha(video), before)

            captions = root / 'source.vtt'
            caption_bytes = b'WEBVTT\r\n\r\n1\r\n00:00:00.000 --> 00:00:00.800\r\nHello\r\n'
            captions.write_bytes(caption_bytes)
            caption_hash = sha(captions)
            with_captions = root / 'caption-review'
            caption_result = build(video, with_captions, captions=captions, expected_sha256=before,
                                   expected_caption_sha256=caption_hash)
            self.assertEqual(caption_result['candidate_sha256'], before)
            self.assertEqual(caption_result['caption_sha256'], caption_hash)
            self.assertEqual(caption_result['files']['captions.vtt'], caption_hash)
            self.assertEqual((with_captions / 'captions.vtt').read_bytes(), caption_bytes)
            self.assertEqual(json.loads((with_captions / 'evidence.json').read_text()), caption_result)
            self.assertIn('<track kind="captions" src="captions.vtt"', (with_captions / 'index.html').read_text())
            self.assertEqual(caption_result['files']['index.html'], sha(with_captions / 'index.html'))
            self.assertFalse(caption_result['full_video_review'])
            self.assertFalse(caption_result['full_audio_review'])
            self.assertFalse(caption_result['publication_enabled'])
            self.assertEqual(sha(captions), caption_hash)
            self.assertEqual(sha(video), before)

