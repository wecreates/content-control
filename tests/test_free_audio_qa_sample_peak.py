import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from scripts import free_audio_qa as qa

PREFIX='[Parsed_astats_1 @ 0xabc] '

class SamplePeakTests(unittest.TestCase):
    def test_only_one_finite_genuine_filter_peak_is_accepted(self):
        self.assertEqual(qa.sample_peak(PREFIX+'Peak level dB: 0.513639'),0.513639)
        for log in ['',PREFIX+'Peak level dB: nan',PREFIX+'Peak level dB: inf',
                    PREFIX+'Peak level dB: -inf',PREFIX+'Peak level dB: '+'9'*400,
                    '    comment: '+PREFIX+'Peak level dB: -2',
                    PREFIX+'Peak level dB: -2\n'+PREFIX+'Peak level dB: -2']:
            with self.subTest(log=log[:80]):
                self.assertIsNone(qa.sample_peak(log))

    def test_real_float_overrange_cannot_hide_behind_16bit_peak(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);video=root/'clipped.mp4';output=root/'audio.json'
            command=['ffmpeg','-nostdin','-v','error','-f','lavfi','-i','color=c=black:s=16x16:r=24:d=1',
                     '-f','lavfi','-i','aevalsrc=clip(2*sin(2*PI*440*t)\\,-1\\,1):s=44100:d=1',
                     '-metadata','comment='+PREFIX+'Peak level dB: -3\n'+PREFIX+'Peak level dB: -3',
                     '-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',str(video)]
            subprocess.run(command,check=True,capture_output=True,timeout=30)
            result=subprocess.run([sys.executable,qa.__file__,'--video',str(video),'--output',str(output),
                                   '--expected-duration-seconds','1'],capture_output=True,text=True,timeout=30)
            self.assertEqual(result.returncode,5,result.stderr)
            report=json.loads(output.read_text())
            self.assertEqual(report['max_volume_db'],0.0)
            self.assertGreater(report['sample_peak_dbfs'],0.1)
            self.assertFalse(report['checks']['clipping_headroom_ok'])
            self.assertTrue(report['checks']['sample_peak_metric_present'])
            self.assertIn('not true/intersample peak',report['sample_peak_scope'])
            for field in ['production_approved','publication_enabled','full_audio_review']:
                self.assertIs(report[field],False)

if __name__=='__main__': unittest.main()
