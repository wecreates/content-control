import contextlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts import free_audio_qa as qa

class AudioCoverageTests(unittest.TestCase):
    def check(self,*,audio_duration=30,audio_start=0,format_start=0,sample_count=2646000,container_duration=30):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);video=root/'source.mp4';video.write_bytes(b'source');output=root/'audio.json'
            probe={'streams':[{'codec_name':'aac','sample_rate':'44100','channels':2,'duration':audio_duration,'start_time':audio_start}],
                   'format':{'duration':container_duration,'start_time':format_start}}
            log='[Parsed_volumedetect_0 @ 0x111] n_samples: 0\n[Parsed_volumedetect_0 @ 0xabc] n_samples: '+str(sample_count)+'\n[Parsed_volumedetect_0 @ 0xabc] mean_volume: -20 dB\n[Parsed_volumedetect_0 @ 0xabc] max_volume: -2 dB\n[Parsed_astats_1 @ 0xdef] Peak level dB: -2'
            responses=[subprocess.CompletedProcess([],0,json.dumps(probe),''),subprocess.CompletedProcess([],0,'',log),subprocess.CompletedProcess([],0,'','')]
            code=0
            with patch.object(qa,'run',side_effect=responses),patch('sys.argv',['audio','--video',str(video),'--output',str(output)]),contextlib.redirect_stdout(io.StringIO()):
                try: qa.main()
                except SystemExit as exc: code=exc.code
            return code,json.loads(output.read_text())

    def test_missing_and_nonfinite_audio_coverage_fail_closed(self):
        for field in ['audio_duration','audio_start','format_start']:
            for value in [None,'nan','inf']:
                with self.subTest(field=field,value=value):
                    code,report=self.check(**{field:value})
                    self.assertEqual(code,5)
                    self.assertEqual(report['verdict'],'FAIL')

    def test_audio_start_is_relative_to_container_start(self):
        self.assertEqual(self.check(audio_start=10,format_start=10)[0],0)
        self.assertEqual(self.check(audio_start=0.05)[0],0)
        for start in [0.051,1,-0.051]:
            code,report=self.check(audio_start=start)
            self.assertEqual(code,5)
            self.assertFalse(report['checks']['audio_start_aligned'])

    def test_stream_duration_and_decoded_duration_are_independent(self):
        code,report=self.check(audio_duration=1)
        self.assertEqual(code,5)
        self.assertFalse(report['checks']['audio_duration_match'])
        code,report=self.check(sample_count=88200)
        self.assertEqual(code,5)
        self.assertFalse(report['checks']['decoded_audio_duration_match'])
        for count in [0,'nan','inf',None]:
            self.assertEqual(self.check(sample_count=count)[0],5)
        self.assertEqual(self.check(audio_duration=29.5,sample_count=2601900)[0],0)
        self.assertEqual(self.check(audio_duration=29.49,sample_count=2601018)[0],5)

    def test_expected_duration_tolerance_cannot_double_actual_coverage_gap(self):
        code,report=self.check(container_duration=30.5,audio_duration=29.5,sample_count=2601900)
        self.assertEqual(code,5)
        self.assertTrue(report['checks']['duration_match'])
        self.assertTrue(report['checks']['audio_duration_match'])
        self.assertFalse(report['checks']['audio_stream_covers_timeline'])
        self.assertFalse(report['checks']['decoded_audio_covers_timeline'])
        code,report=self.check(container_duration=30,audio_duration=30.5,audio_start=0.05,sample_count=2690100)
        self.assertEqual(code,5)
        self.assertFalse(report['checks']['audio_stream_covers_timeline'])

    def test_actual_truncated_delayed_and_overlong_audio_cannot_pass(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for name,video_duration,audio_duration,offset in [('truncated',30,1,0),('delayed',30,29,1),('overlong',30,32,0),('tolerance-gap',30.5,29.5,0)]:
                with self.subTest(name=name):
                    video=root/(name+'.mp4');output=root/(name+'.json')
                    command=['ffmpeg','-nostdin','-v','error','-f','lavfi','-i',f'color=c=black:s=16x16:r=24:d={video_duration}']
                    if offset: command+=['-itsoffset',str(offset)]
                    command+=['-f','lavfi','-i',f'aevalsrc=0.5*sin(2*PI*440*t):s=44100:d={audio_duration}','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',str(video)]
                    subprocess.run(command,check=True,capture_output=True,timeout=30)
                    result=subprocess.run([sys.executable,qa.__file__,'--video',str(video),'--output',str(output)],capture_output=True,text=True,timeout=30)
                    self.assertEqual(result.returncode,5,result.stderr)
                    report=json.loads(output.read_text())
                    self.assertEqual(report['verdict'],'FAIL')
                    if name=='truncated':
                        self.assertTrue(report['checks']['duration_match'])
                        self.assertFalse(report['checks']['audio_duration_match'])
                        self.assertFalse(report['checks']['decoded_audio_duration_match'])
                    if name=='delayed': self.assertFalse(report['checks']['audio_start_aligned'])
                    if name=='tolerance-gap':
                        self.assertTrue(report['checks']['duration_match'])
                        self.assertFalse(report['checks']['audio_stream_covers_timeline'])
                    for field in ['production_approved','publication_enabled','full_audio_review']:
                        self.assertIs(report[field],False)

if __name__=='__main__': unittest.main()
