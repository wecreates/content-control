import json
import tempfile
import unittest
import wave
from pathlib import Path
from scripts.offline_av_review import review_packets


class PacketTests(unittest.TestCase):
    def test_exact_pcm_partition_and_no_review_claim(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'frames').mkdir()
            for i in range(3):
                (root / 'frames' / f'{i+1:06d}.jpg').write_bytes(b'fixture')
            # Stereo, non-whole-second tail: no lost/duplicated sample frames.
            pcm = bytes(range(256)) * 125 + b'\0\1\2\3' * 31
            with wave.open(str(root / 'final-mix.wav'), 'wb') as w:
                w.setparams((2, 2, 4000, 0, 'NONE', 'not compressed'))
                w.writeframes(pcm)
            result = review_packets(root, 'a' * 64, 1)
            rebuilt = b''
            end = 0
            for packet in result['packets']:
                self.assertEqual(packet['start_sample'], end)
                end = packet['end_sample_exclusive']
                with wave.open(str(root / packet['audio']), 'rb') as w:
                    rebuilt += w.readframes(w.getnframes())
                self.assertEqual(packet['status'], 'NOT_REVIEWED')
            self.assertEqual(rebuilt, pcm)
            self.assertEqual(end, len(pcm) // 4)
            self.assertFalse(result['full_video_review'])
            self.assertFalse(result['full_audio_review'])
            self.assertFalse(result['production_approved'])
            self.assertFalse(result['publication_enabled'])
            self.assertEqual(json.loads((root/'review-packets.json').read_text()), result)
            with self.assertRaises(FileExistsError):
                review_packets(root, 'a' * 64, 1)

    def test_invalid_packet_size_rejected_before_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            for value in [0, -1, 61, 1.5]:
                with self.assertRaises(ValueError):
                    review_packets(Path(tmp), 'a' * 64, value)
            self.assertFalse((Path(tmp) / 'packets').exists())
