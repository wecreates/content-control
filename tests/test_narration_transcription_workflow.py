"""Offline exact-step regressions; no ASR model, provider, or media downloads."""
import hashlib
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

from scripts import free_transcription_qa as producer

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / '.github/workflows/narration-transcription-gate.yml'


def step(name):
    block = WORKFLOW.read_text().split('      - name: ' + name + '\n', 1)[1]
    block = block.split('      - ', 1)[0]
    return '\n'.join(line[10:] for line in block.split('        run: |\n', 1)[1].splitlines()
                     if line.startswith('          '))


class NarrationWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / 'state').mkdir()
        (self.root / 'public/audio').mkdir(parents=True)
        self.audio = self.root / 'public/audio/episode1-narration.mp3'
        self.audio.write_bytes(b'Explicitly synthetic audio identity fixture')
        self.digest = hashlib.sha256(self.audio.read_bytes()).hexdigest()
        self.receipt = self.root / 'state/narration-transcription-health.json'
        self.contract = self.root / 'state/episode1-factual-contract.json'
        self.sentence = 'We pay twenty dollars today and keep the remaining sixty dollars.'
        self.contract.write_text(json.dumps({'publication_enabled': False,
            'narration_text': ' '.join([self.sentence] * 4),
            'caption_cues': [{'start': 0, 'end': 20, 'text': ' '.join([self.sentence] * 4)}]}))
        self.write_pass()

    def tearDown(self):
        self.tmp.cleanup()

    def write_pass(self, **changes):
        report = {'status': 'PASS', 'publication_enabled': False,
                  'audio_sha256': self.digest, 'actual_transcript': 'Historical PASS must not be reused'}
        report.update(changes)
        self.receipt.write_text(json.dumps(report))

    def run_step(self, name, **env):
        shell = step(name).replace("python - <<", shlex.quote(sys.executable) + " - <<")
        return subprocess.run(['/bin/bash', '-e', '-o', 'pipefail', '-c', shell], cwd=self.root,
                              env={**os.environ, **env}, capture_output=True, text=True, timeout=10)

    def prepare(self):
        result = self.run_step('Prepare fresh transcription failure receipt')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return json.loads(self.receipt.read_text())

    def enforce(self, outcome='success'):
        return self.run_step('Enforce transcription gate', TRANSCRIBE_OUTCOME=outcome)

    def assert_negative(self):
        receipt = json.loads(self.receipt.read_text())
        self.assertEqual(receipt['status'], 'FAIL')
        self.assertIs(receipt['publication_enabled'], False)
        self.assertEqual(receipt['audio_sha256'], self.digest)
        self.assertEqual(receipt['actual_transcript'], '')
        self.assertFalse(receipt['checks']['fresh_transcription_completed'])

    def test_prepare_replaces_stale_pass_before_runtime_setup(self):
        self.prepare()
        self.assert_negative()
        text = WORKFLOW.read_text()
        self.assertLess(text.index('Prepare fresh transcription failure receipt'), text.index('actions/setup-python'))
        self.assertLess(text.index('Prepare fresh transcription failure receipt'), text.index('Install pinned transcription runtime'))

    def test_prepare_creates_missing_receipt(self):
        self.receipt.unlink()
        self.prepare()
        self.assert_negative()

    def test_missing_audio_cannot_leave_stale_pass(self):
        self.audio.unlink()
        result = self.run_step('Prepare fresh transcription failure receipt')
        self.assertNotEqual(result.returncode, 0)
        receipt = json.loads(self.receipt.read_text())
        self.assertEqual(receipt['status'], 'FAIL')
        self.assertNotIn('audio_sha256', receipt)
        self.assertEqual(self.enforce('skipped').returncode, 2)

    def test_dependency_install_failure_before_transcriber_leaves_negative_receipt(self):
        self.prepare()
        bin_path = self.root / 'bin'
        bin_path.mkdir()
        sudo = bin_path / 'sudo'
        sudo.write_text('#!/bin/sh\nexit 13\n')
        sudo.chmod(0o755)
        result = self.run_step('Install pinned transcription runtime', PATH=str(bin_path))
        self.assertEqual(result.returncode, 13)
        self.assert_negative()
        self.assertEqual(self.enforce('skipped').returncode, 2)

    def test_runtime_installs_and_checks_ffmpeg_before_transcription(self):
        shell = step('Install pinned transcription runtime')
        self.assertIn('sudo apt-get install -y ffmpeg', shell)
        self.assertIn('ffmpeg -version', shell)
        self.assertLess(shell.index('ffmpeg -version'), shell.index('pip install -r'))

    def test_failed_skipped_or_cancelled_transcriber_cannot_reuse_pass(self):
        for outcome in ('failure', 'skipped', 'cancelled', ''):
            with self.subTest(outcome=outcome):
                result = self.enforce(outcome)
                self.assertEqual(result.returncode, 2)
                self.assertNotIn('Historical PASS', result.stdout)
        text = WORKFLOW.read_text()
        self.assertIn('TRANSCRIBE_OUTCOME: ${{ steps.transcribe.outcome }}', text)
        self.assertNotIn('steps.transcribe.conclusion', text)

    def test_success_requires_present_well_formed_current_source_receipt(self):
        for contents in ('null', '[]', '{}', '{broken'):
            with self.subTest(contents=contents):
                self.receipt.write_text(contents)
                self.assertEqual(self.enforce().returncode, 2)
        self.receipt.unlink()
        self.assertEqual(self.enforce().returncode, 2)

    def test_success_rejects_missing_or_wrong_hash_and_publication_enabled(self):
        for changes in ({'audio_sha256': None}, {'audio_sha256': 'b' * 64},
                        {'publication_enabled': True}, {'status': 'FAIL'}):
            with self.subTest(changes=changes):
                self.write_pass(**changes)
                self.assertEqual(self.enforce().returncode, 2)

    def test_success_accepts_current_source_publication_disabled_pass(self):
        self.assertEqual(self.enforce().returncode, 0)

    def producer_args(self):
        return ['free_transcription_qa.py', '--audio', str(self.audio), '--contract', str(self.contract),
                '--output', str(self.receipt)]

    def test_real_producer_missing_ffmpeg_cannot_leave_stale_pass(self):
        self.prepare()
        # Empty PATH makes the actual decoder subprocess encounter missing FFmpeg.
        # No model is constructed, and numpy is not used before the failing exec.
        with mock.patch.dict(sys.modules, {'faster_whisper': SimpleNamespace(WhisperModel=object),
                                           'numpy': SimpleNamespace()}), \
                mock.patch.dict(os.environ, {'PATH': str(self.root / 'no-executables')}), \
                mock.patch.object(sys, 'argv', self.producer_args()):
            with self.assertRaises(FileNotFoundError) as error:
                producer.main()
        self.assertEqual(error.exception.filename, 'ffmpeg')
        self.assert_negative()
        self.assertEqual(self.enforce('failure').returncode, 2)

    def test_real_producer_import_decoder_and_model_iteration_errors_leave_negative_receipt(self):
        def broken_segments():
            raise RuntimeError('offline model iteration failure')
            yield  # Make this a lazy iterator, like actual faster-whisper segments.
        class BrokenRecognizer:
            def __init__(self, *args, **kwargs):
                pass
            def transcribe(self, *args, **kwargs):
                return broken_segments(), SimpleNamespace(language='en')
        cases = (
            ('import', None, None, ModuleNotFoundError),
            ('decode', SimpleNamespace(WhisperModel=BrokenRecognizer), ValueError('bad decode'), ValueError),
            ('iteration', SimpleNamespace(WhisperModel=BrokenRecognizer), None, RuntimeError),
        )
        for name, runtime, decode_error, error in cases:
            with self.subTest(case=name):
                self.write_pass()
                self.prepare()
                with mock.patch.dict(sys.modules, {'faster_whisper': runtime}), \
                        mock.patch.object(producer, 'decode_transcription_audio', return_value=(object(), 20), side_effect=decode_error), \
                        mock.patch.object(sys, 'argv', self.producer_args()):
                    with self.assertRaises(error):
                        producer.main()
                self.assert_negative()
                self.assertEqual(self.enforce('failure').returncode, 2)

    def test_completed_producer_overwrites_pending_failure_and_enforces_pass(self):
        self.prepare()
        segment = SimpleNamespace(start=0, end=20, text=' '.join([self.sentence] * 4), words=[])
        class Recognizer:
            def __init__(self, *args, **kwargs):
                pass
            def transcribe(self, *args, **kwargs):
                return iter([segment]), SimpleNamespace(language='en')
        with mock.patch.dict(sys.modules, {'faster_whisper': SimpleNamespace(WhisperModel=Recognizer)}), \
                mock.patch.object(producer, 'decode_transcription_audio', return_value=(object(), 20)), \
                mock.patch('importlib.metadata.version', return_value='offline-test'), \
                mock.patch.object(sys, 'argv', self.producer_args()):
            producer.main()
        report = json.loads(self.receipt.read_text())
        self.assertEqual(report['status'], 'PASS')
        self.assertEqual(report['audio_sha256'], self.digest)
        self.assertEqual(self.enforce().returncode, 0)


if __name__ == '__main__':
    unittest.main()
