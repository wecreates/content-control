"""Frozen-byte reconstruction and fail-closed recipe tests; no network/models."""
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest import mock
from scripts import regenerate_frozen_narration as helper

ORIGINAL=Path(__file__).resolve().parents[2]/'content-control-security/public/audio/episode1-narration.mp3'
HAS_ORIGINAL=ORIGINAL.is_file() and hashlib.sha256(ORIGINAL.read_bytes()).hexdigest()==helper.SOURCE_SHA256


class FrozenRegenerationTests(unittest.TestCase):
    def test_wrong_source_rejected_before_tools_or_output_creation(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);source=root/'wrong';source.write_bytes(b'wrong source');out=root/'out'
            with mock.patch.object(helper,'ffmpeg') as ffmpeg:
                with self.assertRaisesRegex(ValueError,'SHA-256'):helper.regenerate(source,out)
                ffmpeg.assert_not_called()
            self.assertFalse(out.exists())

    @unittest.skipUnless(HAS_ORIGINAL and shutil.which('ffmpeg'),'Exact original audio and FFmpeg required')
    def test_fresh_reconstruction_matches_both_frozen_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            out=Path(temporary)/'out';before=ORIGINAL.read_bytes()
            result=helper.regenerate(ORIGINAL,out)
            self.assertEqual(result['status'],'FROZEN_BYTES_REPRODUCED',result.get('reason'))
            self.assertEqual(helper.sha((out/'narration-currency-edit-candidate.wav').read_bytes()),helper.WAV_SHA256)
            self.assertEqual(helper.sha((out/'narration-currency-edit-candidate.mp3').read_bytes()),helper.MP3_SHA256)
            self.assertEqual(ORIGINAL.read_bytes(),before)
            self.assertFalse(result['publication_enabled'])
            self.assertFalse(result['acceptance_evidence'])

    @unittest.skipUnless(HAS_ORIGINAL,'Exact original audio required')
    def test_existing_directory_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as temporary:
            out=Path(temporary)/'out';out.mkdir();marker=out/'keep';marker.write_text('existing work')
            with mock.patch.object(helper,'ffmpeg') as ffmpeg:
                with self.assertRaises(FileExistsError):helper.regenerate(ORIGINAL,out)
                ffmpeg.assert_not_called()
            self.assertEqual(marker.read_text(),'existing work')

    @unittest.skipUnless(HAS_ORIGINAL,'Exact original audio required')
    def test_decoder_difference_blocks_without_installing_candidate_files(self):
        import numpy as np
        with tempfile.TemporaryDirectory() as temporary:
            out=Path(temporary)/'out'
            def ffmpeg(*args):
                return b'synthetic test version' if args==('-version',) else np.zeros(44100*26,dtype='<f4').tobytes()
            with mock.patch.object(helper,'ffmpeg',side_effect=ffmpeg):result=helper.regenerate(ORIGINAL,out)
            self.assertEqual(result['status'],'BLOCKED')
            self.assertIn('Frozen WAV hash mismatch',result['reason'])
            self.assertNotEqual(result['observed_wav_sha256'],helper.WAV_SHA256)
            self.assertFalse(list(out.glob('*.wav')))
            self.assertFalse(list(out.glob('*.mp3')))

    @unittest.skipUnless(HAS_ORIGINAL and shutil.which('ffmpeg'),'Exact original audio and FFmpeg required')
    def test_encoder_difference_blocks_and_preserves_observed_hash(self):
        with tempfile.TemporaryDirectory() as temporary:
            out=Path(temporary)/'out';real=helper.ffmpeg
            def ffmpeg(*args):
                if '-c:a' in args:
                    Path(args[-1]).write_bytes(b'different encoder result');return b''
                return real(*args)
            with mock.patch.object(helper,'ffmpeg',side_effect=ffmpeg):result=helper.regenerate(ORIGINAL,out)
            self.assertEqual(result['status'],'BLOCKED')
            self.assertIn('Frozen MP3 hash mismatch',result['reason'])
            self.assertEqual(result['observed_mp3_sha256'],helper.sha(b'different encoder result'))
            self.assertFalse(list(out.glob('*.wav')))
            self.assertFalse(list(out.glob('*.mp3')))
            saved=json.loads((out/'regeneration-receipt.json').read_text())
            self.assertEqual(saved,result)
