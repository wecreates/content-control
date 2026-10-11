import unittest
import numpy as np
from scripts.production_reality_media_qa import duplicate_run_stats,validate_decode,decode_all_streams
from unittest.mock import patch
import subprocess

class DuplicateRunStatsTests(unittest.TestCase):
    def test_measures_longest_continuous_duplicate_run(self):
        a=np.zeros((16,16),dtype=np.uint8)
        b=np.full((16,16),25,dtype=np.uint8)
        hashes=[a.copy(),a.copy(),a.copy(),b.copy(),a.copy(),a.copy()]
        stats=duplicate_run_stats(hashes,threshold=1.0)
        self.assertEqual(stats["duplicate_pairs"],3)
        self.assertEqual(stats["max_duplicate_run_pairs"],2)

    def test_scattered_duplicates_do_not_become_one_long_run(self):
        a=np.zeros((16,16),dtype=np.uint8)
        b=np.full((16,16),25,dtype=np.uint8)
        c=np.full((16,16),50,dtype=np.uint8)
        hashes=[a.copy(),a.copy(),b.copy(),b.copy(),c.copy(),c.copy()]
        stats=duplicate_run_stats(hashes,threshold=1.0)
        self.assertEqual(stats["duplicate_pairs"],3)
        self.assertEqual(stats["max_duplicate_run_pairs"],1)

class CompleteDecodeTests(unittest.TestCase):
    def test_rejects_truncation_despite_valid_container_metadata(self):
        self.assertFalse(validate_decode(24,840,420))
        self.assertFalse(validate_decode(24,840,0))
        self.assertTrue(validate_decode(24,840,840))

    def test_unknown_or_invalid_timing_never_uses_assumed_fps(self):
        for fps in [0,-1,float('nan'),float('inf')]:
            self.assertFalse(validate_decode(fps,840,840))
        self.assertFalse(validate_decode(24,0,0))

    @patch('scripts.production_reality_media_qa.subprocess.run')
    def test_decodes_both_streams_and_rejects_decoder_failure(self,run):
        run.return_value.returncode=1
        self.assertFalse(decode_all_streams('candidate.mp4'))
        args=run.call_args.args[0]
        self.assertIn('0:a:0',args)
        self.assertIn('0:v:0',args)
        self.assertIn('-xerror',args)
        run.return_value.returncode=0
        self.assertTrue(decode_all_streams('candidate.mp4'))

    @patch('scripts.production_reality_media_qa.subprocess.run')
    def test_timeout_or_missing_decoder_cannot_pass(self,run):
        for error in [FileNotFoundError(),subprocess.TimeoutExpired('ffmpeg',180)]:
            run.side_effect=error
            self.assertFalse(decode_all_streams('candidate.mp4'))


class EncodedAudioTests(unittest.TestCase):
    def test_real_encoded_silence_short_audio_and_complete_audio(self):
        import shutil,tempfile
        from pathlib import Path
        from scripts.production_reality_media_qa import measure_audio,audio_covers_video
        if not shutil.which('ffmpeg'):self.skipTest('ffmpeg required')
        with tempfile.TemporaryDirectory() as tmp:
            for name,source,length,expected_audible,expected_coverage in [
                ('silent','anullsrc=r=44100:cl=stereo',2,False,True),
                ('short','sine=frequency=440:sample_rate=44100',.5,True,False),
                ('complete','sine=frequency=440:sample_rate=44100',2,True,True)]:
                file=Path(tmp)/(name+'.mp4')
                subprocess.run(['ffmpeg','-v','error','-nostdin','-f','lavfi','-i','color=white:s=32x32:r=24:d=2','-f','lavfi','-t',str(length),'-i',source,'-map','0:v:0','-map','1:a:0','-c:v','libx264','-c:a','aac','-y',str(file)],check=True,capture_output=True,timeout=30)
                audio=measure_audio(file)
                self.assertEqual(audio['audio_audible'],expected_audible,name)
                self.assertEqual(audio_covers_video(audio,2),expected_coverage,name)
    def test_missing_or_delayed_audio_fails_closed(self):
        from scripts.production_reality_media_qa import measure_audio,audio_covers_video
        self.assertFalse(measure_audio('/nonexistent/video.mp4')['audio_audible'])
        self.assertFalse(audio_covers_video({'audio_start':1,'audio_duration':1},2))
        self.assertFalse(audio_covers_video({'audio_start':0,'audio_duration':float('nan')},2))

if __name__=="__main__":
    unittest.main()
