import math
import shutil
import struct
import tempfile
import unittest
import wave
from pathlib import Path
from scripts.free_transcription_qa import decode_transcription_audio

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

if __name__=='__main__':unittest.main()
