import contextlib
import io
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import free_audio_qa as qa


class FreeAudioQaTests(unittest.TestCase):
    def check(self, *, duration=30, expected=None, volume_code=0, silence_code=0,
              volume_text='mean_volume: -20.0 dB\nmax_volume: -2.0 dB', silence_text='', module=qa):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            video, output = root/'video.mp4', root/'audio.json'
            video.write_bytes(b'test input')
            probe = {'streams': [{'codec_name': 'aac', 'sample_rate': '44100', 'channels': 2}],
                     'format': {'duration': duration}}
            volume_text='\n'.join('[Parsed_volumedetect_0 @ 0xabc] '+line for line in volume_text.split('\n'))
            if silence_text:
                silence_text='[silencedetect @ 0xdef] silence_start: 0\n[silencedetect @ 0xdef] silence_end: 10 | '+silence_text
            responses = [subprocess.CompletedProcess([], 0, json.dumps(probe), ''),
                         subprocess.CompletedProcess([], volume_code, '', volume_text),
                         subprocess.CompletedProcess([], silence_code, '', silence_text)]
            argv = ['free_audio_qa.py', '--video', str(video), '--output', str(output)]
            if expected is not None:
                argv += ['--expected-duration-seconds', str(expected)]
            code = 0
            with patch.object(module, 'run', side_effect=responses) as run, patch('sys.argv', argv), contextlib.redirect_stdout(io.StringIO()):
                try:
                    module.main()
                except SystemExit as exc:
                    code = exc.code
            return code, json.loads(output.read_text()), run.call_args_list

    def test_default_preserves_thirty_second_contract(self):
        code, result, _ = self.check()
        self.assertEqual(code, 0)
        self.assertEqual(result['verdict'], 'PASS')
        self.assertEqual(result['expected_duration_seconds'], 30)
        for duration in [29.49, 30.51, 35.041667, 519.333333]:
            with self.subTest(duration=duration):
                code, result, _ = self.check(duration=duration)
                self.assertEqual(code, 5)
                self.assertFalse(result['checks']['duration_match'])

    def test_explicit_duration_supports_short_and_long_without_weakening_tolerance(self):
        for duration in [35.041667, 519.333333]:
            with self.subTest(duration=duration):
                code, result, _ = self.check(duration=duration, expected=duration)
                self.assertEqual(code, 0)
                self.assertTrue(result['checks']['duration_match'])
                code, result, _ = self.check(duration=duration-1, expected=duration)
                self.assertEqual(code, 5)
                self.assertFalse(result['checks']['duration_match'])

    def test_failed_volume_analysis_cannot_pass_using_partial_metrics(self):
        code, result, _ = self.check(volume_code=1)
        self.assertEqual(code, 5)
        self.assertEqual(result['verdict'], 'FAIL')
        self.assertFalse(result['checks']['volume_analysis_succeeded'])

    def test_failed_silence_analysis_cannot_masquerade_as_no_silence(self):
        code, result, _ = self.check(silence_code=1)
        self.assertEqual(code, 5)
        self.assertEqual(result['verdict'], 'FAIL')
        self.assertFalse(result['checks']['silence_analysis_succeeded'])

    def test_missing_or_nonfinite_volume_metrics_fail(self):
        for text in ['', 'mean_volume: nan dB\nmax_volume: -2 dB',
                     'mean_volume: inf dB\nmax_volume: -2 dB',
                     'mean_volume: '+'9'*400+' dB\nmax_volume: -2 dB',
                     'mean_volume: -20 dB\nmax_volume: inf dB']:
            with self.subTest(text=text[:70]):
                code, result, _ = self.check(volume_text=text)
                self.assertEqual(code, 5)
                self.assertFalse(result['checks']['volume_metrics_present'])

    def test_invalid_observed_duration_fails_closed(self):
        for duration in ['nan', 'inf', '-inf', 0, -1, None]:
            with self.subTest(duration=duration):
                code, result, _ = self.check(duration=duration)
                self.assertEqual(code, 5)
                self.assertFalse(result['checks']['duration_match'])
                self.assertIsNone(result['duration_seconds'])

    def test_invalid_expected_duration_is_rejected_before_tools(self):
        for value in ['nan', 'inf', '-inf', '0', '-1']:
            with self.subTest(value=value), patch.object(qa, 'run') as run, patch('sys.argv',
                 ['free_audio_qa.py', '--video', 'not-needed', '--output', 'not-needed',
                  '--expected-duration-seconds='+value]), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as raised:
                    qa.main()
                self.assertEqual(raised.exception.code, 2)
                run.assert_not_called()

    def test_long_silence_still_fails(self):
        code, result, _ = self.check(silence_text='silence_duration: 6.25')
        self.assertEqual(code, 5)
        self.assertFalse(result['checks']['no_excessive_long_silence'])

    def test_invalid_silence_metrics_cannot_masquerade_as_no_silence(self):
        for value in ['nan', 'inf', '-inf', 'unknown', '-1', '9'*400]:
            with self.subTest(value=value[:70]):
                code, result, _ = self.check(silence_text='silence_duration: '+value)
                self.assertEqual(code, 5)
                self.assertFalse(result['checks']['silence_metrics_valid'])
                json.dumps(result, allow_nan=False)

    def test_technical_pass_never_asserts_creative_approval(self):
        code, result, _ = self.check()
        self.assertEqual(code, 0)
        for field in ['publication_enabled', 'production_approved', 'full_audio_review']:
            self.assertIs(result[field], False)
        self.assertIn('Technical', result['scope'])

    def test_ffmpeg_is_strict_and_noninteractive(self):
        _, _, calls = self.check()
        for call in calls:
            command=call.args[0]
            self.assertEqual(command[command.index('-protocol_whitelist')+1],'file')
        for call in calls[1:]:
            command = call.args[0]
            for flag in ['-nostdin', '-xerror', '-err_detect', 'explode']:
                self.assertIn(flag, command)

    def test_process_timeouts_are_bounded_and_fail_closed(self):
        with patch.object(qa.subprocess, 'run', side_effect=subprocess.TimeoutExpired('ffprobe', 30)) as run:
            with self.assertRaises(subprocess.TimeoutExpired):
                qa.run(['ffprobe', '-v', 'error'])
            self.assertEqual(run.call_args.kwargs['timeout'], 30)
        with patch.object(qa.subprocess, 'run') as run:
            qa.run(['ffmpeg', '-i', 'video.mp4'])
            self.assertEqual(run.call_args.kwargs['timeout'], 600)

    def test_media_subprocesses_do_not_inherit_credentials_or_ffreport(self):
        with patch.dict(qa.os.environ,{'TEST_SECRET':'do-not-forward','FFREPORT':'file=/tmp/report.log'}),patch.object(qa.subprocess,'run') as run:
            qa.run(['ffprobe','-v','error'])
            environment=run.call_args.kwargs['env']
            self.assertNotIn('TEST_SECRET',environment)
            self.assertNotIn('FFREPORT',environment)
            self.assertEqual(environment['LC_ALL'],'C')


if __name__ == '__main__':
    unittest.main()
