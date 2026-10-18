import contextlib
import io
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts import free_audio_qa as qa


PROBE=json.dumps({'streams':[{'codec_name':'aac','sample_rate':'44100','channels':2,'duration':30,'start_time':'0'}], 'format':{'duration':30,'start_time':'0'}})
VOLUME='[Parsed_volumedetect_0 @ 0xabc] n_samples: 2646000\n[Parsed_volumedetect_0 @ 0xabc] mean_volume: -20.0 dB\n[Parsed_volumedetect_0 @ 0xabc] max_volume: -2.0 dB\n[Parsed_astats_1 @ 0xdef] Peak level dB: -2'

def result(stdout='',stderr='',code=0):
    return subprocess.CompletedProcess([],code,stdout,stderr)

class FreeAudioFailureTests(unittest.TestCase):
    def fixture(self):
        directory=tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root=Path(directory.name)
        video,output=root/'video.mp4',root/'audio.json'
        video.write_bytes(b'original video')
        output.write_text('{"verdict":"PASS","candidate_sha256":"old"}')
        return root,video,output

    def invoke(self,video,output,responses):
        argv=['free_audio_qa.py','--video',str(video),'--output',str(output)]
        with patch.object(qa,'run',side_effect=responses),patch('sys.argv',argv),contextlib.redirect_stdout(io.StringIO()):
            qa.main()

    def assert_failed_receipt(self,output):
        report=json.loads(output.read_text())
        self.assertEqual(report['verdict'],'FAIL')
        self.assertFalse(report['checks']['analysis_complete'])
        for name in ['production_approved','publication_enabled','full_audio_review']:
            self.assertIs(report[name],False)
        self.assertNotIn('candidate_sha256',report)

    def test_probe_timeout_replaces_stale_pass(self):
        root,video,output=self.fixture()
        with self.assertRaises(subprocess.TimeoutExpired):
            self.invoke(video,output,[subprocess.TimeoutExpired('ffprobe',30)])
        self.assert_failed_receipt(output)
        self.assertEqual(video.read_bytes(),b'original video')
        self.assertFalse(list(root.glob('.audio-qa-*')))

    def test_analysis_timeouts_replaces_stale_pass(self):
        for responses in [[result(PROBE),subprocess.TimeoutExpired('ffmpeg',600)],
                          [result(PROBE),result(stderr=VOLUME),subprocess.TimeoutExpired('ffmpeg',600)]]:
            with self.subTest(step=len(responses)):
                _,video,output=self.fixture()
                with self.assertRaises(subprocess.TimeoutExpired):
                    self.invoke(video,output,responses)
                self.assert_failed_receipt(output)

    def test_probe_error_malformed_json_and_missing_audio_cannot_leave_old_pass(self):
        probes=[result(stderr='probe failed',code=1),result('not json'),result('{}'),
                result('{"streams":[]}'),result('{"streams":null}'),result('null'),
                result('{"streams":[{}],"format":{"duration":"bad"}}')]
        for probe in probes:
            with self.subTest(probe=probe):
                _,video,output=self.fixture()
                with self.assertRaises((SystemExit,ValueError,TypeError,AttributeError)):
                    self.invoke(video,output,[probe])
                self.assert_failed_receipt(output)

    def test_missing_input_replaces_stale_pass(self):
        _,video,output=self.fixture()
        video.unlink()
        with patch.object(qa,'run') as run,patch('sys.argv',['audio','--video',str(video),'--output',str(output)]):
            with self.assertRaises(SystemExit):
                qa.main()
            run.assert_not_called()
        self.assert_failed_receipt(output)

    def test_source_mutation_cannot_bind_old_measurements_to_new_video(self):
        _,video,output=self.fixture()
        results=iter([result(PROBE),result(stderr=VOLUME),result()])
        def mutate(command):
            response=next(results)
            if 'silencedetect=noise=-45dB:d=2.5' in command:
                video.write_bytes(b'replacement video')
            return response
        with self.assertRaisesRegex(ValueError,'changed during audio analysis'):
            self.invoke(video,output,mutate)
        self.assert_failed_receipt(output)

    def test_output_equality_symlink_and_hardlink_aliases_preserve_video(self):
        for kind in ['equal','symlink','parent-symlink','hardlink']:
            with self.subTest(kind=kind):
                root,video,output=self.fixture()
                if kind=='equal': output=video
                elif kind=='symlink':
                    output=root/'symlink.json';output.symlink_to(video)
                elif kind=='parent-symlink':
                    parent=root/'parent';parent.symlink_to(root,target_is_directory=True);output=parent/'video.mp4'
                else:
                    output=root/'hardlink.json';output.hardlink_to(video)
                with patch.object(qa,'run') as run,patch('sys.argv',['audio','--video',str(video),'--output',str(output)]):
                    with self.assertRaisesRegex(ValueError,'symlink|overwrite'):
                        qa.main()
                    run.assert_not_called()
                self.assertEqual(video.read_bytes(),b'original video')

    def test_positive_report_records_current_source_hash(self):
        _,video,output=self.fixture()
        self.invoke(video,output,[result(PROBE),result(stderr=VOLUME),result()])
        report=json.loads(output.read_text())
        self.assertEqual(report['verdict'],'PASS')
        self.assertEqual(report['candidate_sha256'],qa.media_hash(video))
        self.assertTrue(report['checks']['analysis_complete'])


if __name__=='__main__': unittest.main()
