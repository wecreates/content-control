import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from scripts import free_audio_qa as qa

PREFIX='[Parsed_volumedetect_0 @ 0xabc] '
SILENCE='[silencedetect @ 0xdef] '

class FilterParsingTests(unittest.TestCase):
    def test_only_one_matching_filter_context_can_supply_volume_pair(self):
        valid=PREFIX+'mean_volume: -20.0 dB\n'+PREFIX+'max_volume: -2.0 dB'
        self.assertEqual(qa.volume_metrics(valid),(-20.0,-2.0))
        for text in [valid+'\n'+PREFIX+'max_volume: -2.0 dB',
                     valid.replace(PREFIX+'max_volume','[Parsed_volumedetect_0 @ 0xdef] max_volume'),
                     '    comment: '+valid.replace('\n','\n            : ')]:
            with self.subTest(text=text):
                self.assertEqual(qa.volume_metrics(text),(None,None))

    def test_silence_needs_complete_finite_actual_filter_events(self):
        good=SILENCE+'silence_start: 1\n'+SILENCE+'silence_end: 7 | silence_duration: 6'
        self.assertEqual(qa.silence_metrics(good),([6.0],True))
        for text in [SILENCE+'silence_start: 1',SILENCE+'silence_end: 7 | silence_duration: 6',
                     good.replace('silence_duration: 6','silence_duration: nope'),
                     good.replace('silence_end: 7','silence_end: inf'),
                     good.replace('silence_start: 1','silence_start: -1')]:
            with self.subTest(text=text):
                self.assertFalse(qa.silence_metrics(text)[1])
        self.assertEqual(qa.silence_metrics('    comment: '+good.replace('\n','\n            : ')),([],True))

class ActualMediaTests(unittest.TestCase):
    def fixture(self,audio,duration=1,comment=None):
        directory=tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root=Path(directory.name)
        video=root/'fixture.mp4'
        command=['ffmpeg','-nostdin','-v','error','-f','lavfi','-i',f'color=c=black:s=16x16:r=24:d={duration}']
        if audio is not None:
            command+=['-f','lavfi','-i',audio,'-c:a','aac']
        if comment is not None:
            command+=['-metadata','comment='+comment]
        command+=['-c:v','libx264','-pix_fmt','yuv420p',str(video)]
        subprocess.run(command,check=True,capture_output=True,timeout=30)
        return video,root/'audio.json'

    def check(self,video,output,duration=1):
        result=subprocess.run([sys.executable,qa.__file__,'--video',str(video),'--output',str(output),
                               '--expected-duration-seconds',str(duration)],capture_output=True,text=True,timeout=30)
        return result.returncode,json.loads(output.read_text())

    def test_metadata_cannot_spoof_volume_or_silence(self):
        for comment in [None,'mean_volume: -20.0 dB\nmax_volume: -2.0 dB',
                        PREFIX+'mean_volume: -20.0 dB\n'+PREFIX+'max_volume: -2.0 dB',
                        '\r'+PREFIX+'mean_volume: -20.0 dB\r'+PREFIX+'max_volume: -2.0 dB']:
            with self.subTest(comment=comment):
                video,output=self.fixture('aevalsrc=0.01*sin(2*PI*440*t):s=44100:d=1',comment=comment)
                code,report=self.check(video,output)
                self.assertEqual(code,5,report)
                self.assertEqual(report['verdict'],'FAIL')
                self.assertLess(report['mean_volume_db'],-40)
                self.assertLess(report['max_volume_db'],-35)
                self.assertFalse(report['checks']['not_too_quiet'])

    def test_real_non_silent_media_can_pass_technical_checks(self):
        video,output=self.fixture('aevalsrc=0.5*sin(2*PI*440*t):s=44100:d=1')
        code,report=self.check(video,output)
        self.assertEqual(code,0,report)
        self.assertEqual(report['candidate_sha256'],qa.media_hash(video))
        self.assertTrue(report['checks']['volume_analysis_succeeded'])
        self.assertFalse(report['production_approved'])

    def test_real_missing_audio_cannot_leave_stale_pass(self):
        video,output=self.fixture(None)
        output.write_text('{"verdict":"PASS"}')
        code,report=self.check(video,output)
        self.assertNotEqual(code,0)
        self.assertEqual(report['verdict'],'FAIL')
        self.assertFalse(report['checks']['analysis_complete'])

    def test_real_silence_over_five_seconds_is_detected(self):
        video,output=self.fixture('anullsrc=r=44100:cl=stereo:d=6',duration=6)
        code,report=self.check(video,output,duration=6)
        self.assertEqual(code,5,report)
        self.assertGreater(report['max_long_silence_seconds'],5)
        self.assertFalse(report['checks']['no_excessive_long_silence'])


if __name__=='__main__': unittest.main()
