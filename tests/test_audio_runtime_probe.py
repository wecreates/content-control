import shutil
import subprocess
import unittest
from unittest.mock import patch
from scripts.probe_audio_runtime import probe


class RuntimeProbeTests(unittest.TestCase):
    def test_missing_tool_fails_before_execution(self):
        with patch('scripts.probe_audio_runtime.shutil.which', return_value=None), patch('scripts.probe_audio_runtime.subprocess.run') as run:
            with self.assertRaisesRegex(RuntimeError, 'Missing audio'):
                probe()
            run.assert_not_called()

    def test_broken_tool_fails_closed(self):
        with patch('scripts.probe_audio_runtime.shutil.which', return_value='/fake'), patch('scripts.probe_audio_runtime.subprocess.run', side_effect=subprocess.CalledProcessError(1, 'ffmpeg')):
            with self.assertRaises(subprocess.CalledProcessError):
                probe()

    def test_incompatible_float32_codec_fails_closed(self):
        version = subprocess.CompletedProcess([], 0, stdout=b'version\n')
        with patch('scripts.probe_audio_runtime.shutil.which', return_value='/fake'), patch('scripts.probe_audio_runtime.subprocess.run', side_effect=[version, version, subprocess.CalledProcessError(1, 'pcm_f32le')]):
            with self.assertRaises(subprocess.CalledProcessError):
                probe(require_espeak=False)

    def test_incorrect_float32_samples_fail_closed(self):
        version = subprocess.CompletedProcess([], 0, stdout=b'version\n')
        decoded = subprocess.CompletedProcess([], 0, stdout=b'\0'*6400)
        with patch('scripts.probe_audio_runtime.shutil.which', return_value='/fake'), patch('scripts.probe_audio_runtime.subprocess.run', side_effect=[version, version, decoded]):
            with self.assertRaisesRegex(RuntimeError, 'Float32'):
                probe(require_espeak=False)

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'Requires actual media tools')
    def test_real_float32_decode_and_pcm_normalization(self):
        self.assertEqual(probe(require_espeak=False)['status'], 'PASS')
