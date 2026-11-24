import importlib.util
import math
import shutil
import struct
import tempfile
import unittest
import wave
from pathlib import Path
from scripts.free_transcription_qa import decode_source_mp3, decode_transcription_audio

SOURCE_NARRATION = Path(__file__).resolve().parents[1] / 'public/audio/episode1-narration.mp3'

@unittest.skipUnless(shutil.which('ffmpeg'), 'FFmpeg required')
class TranscriptionDecodeTests(unittest.TestCase):
    def test_real_stereo_wav_becomes_full_duration_mono_float32(self):
        import numpy as np
        with tempfile.TemporaryDirectory() as td:
            source=Path(td)/'voice.wav'
            frames=[round(8000*math.sin(2*math.pi*440*i/44100)) for i in range(44100)]
            with wave.open(str(source),'wb') as stream:
                stream.setparams((2,2,44100,0,'NONE','not compressed'))
                stream.writeframes(b''.join(struct.pack('<hh',sample,sample) for sample in frames))
            audio,duration=decode_transcription_audio(source)
            self.assertIsInstance(audio,np.ndarray)
            self.assertEqual(audio.dtype,np.float32)
            self.assertEqual(audio.shape,(16000,))
            self.assertAlmostEqual(duration,1.0,places=4)
            self.assertGreater(float(np.max(np.abs(audio))),0.1)

    def test_corrupt_audio_fails_instead_of_using_transcript_duration(self):
        with tempfile.TemporaryDirectory() as td:
            source=Path(td)/'bad.wav';source.write_bytes(b'not audio')
            with self.assertRaisesRegex(ValueError,'Audio decode failed'):
                decode_transcription_audio(source)

    def test_missing_audio_cannot_pass(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(FileNotFoundError):
                decode_transcription_audio(Path(td)/'missing.wav')

@unittest.skipUnless(importlib.util.find_spec('av'), 'PyAV required')
class SourceMp3DecodeTests(unittest.TestCase):
    def test_actual_narration_decodes_to_finite_float_mono(self):
        import numpy as np
        audio, duration = decode_source_mp3(SOURCE_NARRATION)
        self.assertEqual(audio.dtype, np.float32)
        self.assertEqual(audio.ndim, 1)
        self.assertEqual(duration, audio.size / 16000)
        self.assertGreater(duration, 0)
        self.assertTrue(np.isfinite(audio).all())
        self.assertGreater(float(np.max(np.abs(audio))), 0.01)

    def test_missing_or_corrupt_source_is_rejected(self):
        import av
        with tempfile.TemporaryDirectory() as td:
            source = Path(td) / 'bad.mp3'
            with self.assertRaises(FileNotFoundError):
                decode_source_mp3(source)
            source.write_bytes(b'not an MP3')
            with self.assertRaises((ValueError, av.FFmpegError)):
                decode_source_mp3(source)

if __name__=='__main__':unittest.main()
