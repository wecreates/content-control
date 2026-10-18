"""Canonical caption gate regressions, using only local deterministic fixtures."""
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import shlex
import shutil
import sys
import tempfile
import unittest
from unittest import mock
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]


class CaptionProvenanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / 'state').mkdir()
        (self.root / 'public/audio').mkdir(parents=True)
        self.audio = self.root / 'public/audio/episode1-narration.mp3'
        self.audio.write_bytes(b'Approved local audio identity fixture. ' * 100)
        self.digest = hashlib.sha256(self.audio.read_bytes()).hexdigest()
        self.script = 'Pay twenty dollars today. Keep the remaining sixty dollars.'
        self.cues = [{'start': 0, 'end': 1, 'text': 'Pay $20 today.'},
                     {'start': 1, 'end': 2, 'text': 'Keep the remaining $60.'}]
        self.contract = {'publication_enabled': False, 'narration_sha256': self.digest,
                         'narration_text': self.script, 'caption_cues': copy.deepcopy(self.cues)}
        self.transcription = {'status': 'PASS', 'publication_enabled': False,
                              'audio_sha256': self.digest, 'expected_text': self.script,
                              'actual_transcript': 'Pay $20 today. Keep the remaining $60.',
                              'segments': copy.deepcopy(self.cues),
                              'transcribed_duration_seconds': 2, 'media_duration_seconds': 2.02}
        self.health = {'status': 'GREEN', 'publication_enabled': False, 'candidate_sha256': 'a' * 64}
        self.contract_path = self.root / 'state/episode1-factual-contract.json'
        self.transcription_path = self.root / 'transcription.json'
        self.health_path = self.root / 'state/content-control-health.json'
        self.vtt = self.root / 'captions.vtt'
        self.output = self.root / 'report.json'
        self.save()
        self.vtt.write_text('WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.000\nPay $20 today.\n\n2\n00:00:01.000 --> 00:00:02.000\nKeep the remaining $60.\n')

    def tearDown(self):
        self.tmp.cleanup()

    def save(self):
        self.contract_path.write_text(json.dumps(self.contract))
        self.transcription_path.write_text(json.dumps(self.transcription))
        self.health_path.write_text(json.dumps(self.health))

    def run_script(self, script, args, optimized=False):
        return subprocess.run([sys.executable, *(['-O'] if optimized else []), str(ROOT / 'scripts' / script), *map(str, args)],
                              cwd=self.root, capture_output=True, text=True, timeout=3)

    def verify(self, output=None):
        return self.run_script('verify_captions.py', [self.vtt, self.transcription_path, output or self.output])

    def build(self, output=None, optimized=False):
        return self.run_script('build_verified_captions.py', [self.transcription_path, output or self.vtt], optimized)

    def test_current_source_and_equivalent_numeric_text_pass(self):
        self.assertEqual(self.build().returncode, 0)
        result = self.verify()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = json.loads(self.output.read_text())
        self.assertEqual(report['status'], 'PASS')
        self.assertEqual(report['narration_sha256'], self.digest)
        self.assertEqual(report['caption_sha256'], hashlib.sha256(self.vtt.read_bytes()).hexdigest())

    def test_actual_transcription_producer_receipt_matches_caption_contract(self):
        # Validate producer/consumer field wiring with a controlled recognizer.
        # This test does not claim to transcribe or validate actual speech.
        from scripts import free_transcription_qa as producer
        sentence = 'We pay twenty dollars today and keep the remaining sixty dollars.'
        self.script = ' '.join([sentence] * 4)
        self.contract.update(narration_text=self.script,
                             caption_cues=[{'start': i * 5, 'end': (i + 1) * 5,
                                            'text': sentence} for i in range(4)])
        self.save()
        segments = [SimpleNamespace(start=cue['start'], end=cue['end'], text=cue['text'], words=[])
                    for cue in self.contract['caption_cues']]
        class StubRecognizer:
            def __init__(self, *args, **kwargs):
                pass
            def transcribe(self, *args, **kwargs):
                return iter(segments), SimpleNamespace(language='en', language_probability=1)
        args = ['free_transcription_qa.py', '--audio', str(self.audio),
                '--contract', str(self.contract_path), '--output', str(self.transcription_path)]
        with mock.patch.dict(sys.modules, {'faster_whisper': SimpleNamespace(WhisperModel=StubRecognizer)}), \
                mock.patch.object(producer, 'decode_transcription_audio', return_value=(object(), 20.02)), \
                mock.patch('importlib.metadata.version', return_value='1.2.1'), \
                mock.patch.object(sys, 'argv', args):
            producer.main()
        emitted = json.loads(self.transcription_path.read_text())
        self.assertEqual(emitted['status'], 'PASS')
        self.assertEqual(emitted['audio_sha256'], self.digest)
        self.assertEqual(emitted['publication_enabled'], False)
        self.assertEqual(self.build().returncode, 0)
        result = self.verify()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_unrelated_caption_text_cannot_pass_with_matching_segment_count(self):
        self.vtt.write_text(self.vtt.read_text().replace('Pay $20 today.', 'Invent completely unrelated words.'))
        self.assertEqual(self.verify().returncode, 2)
        self.assertEqual(json.loads(self.output.read_text())['status'], 'FAIL')

    def test_receipt_and_contract_must_bind_current_audio(self):
        for item, key, bad in [(self.transcription, 'audio_sha256', 'b' * 64),
                               (self.transcription, 'audio_sha256', None),
                               (self.contract, 'narration_sha256', 'c' * 64)]:
            with self.subTest(key=key, bad=bad):
                old = item[key]
                item[key] = bad
                self.save()
                before = self.vtt.read_bytes()
                self.assertEqual(self.build().returncode, 2)
                self.assertEqual(self.vtt.read_bytes(), before)
                self.assertEqual(self.verify().returncode, 2)
                item[key] = old

    def test_wrong_words_values_units_sign_and_missing_coverage_fail(self):
        for text in ('Pay twenty dollars today.',
                     'Pay thirty dollars today. Keep the remaining sixty dollars.',
                     'Pay twenty percent today. Keep the remaining sixty dollars.',
                     'Pay minus twenty dollars today. Keep the remaining sixty dollars.',
                     'Keep the remaining sixty dollars. Pay twenty dollars today.'):
            with self.subTest(text=text):
                self.transcription['actual_transcript'] = text
                self.save()
                self.assertEqual(self.verify().returncode, 2)
                self.assertEqual(self.build().returncode, 2)

    def test_expected_text_and_observed_segments_are_checked(self):
        self.transcription['expected_text'] = 'Unrelated approved script.'
        self.save()
        self.assertEqual(self.verify().returncode, 2)
        self.transcription['expected_text'] = self.script
        self.transcription['segments'][0]['text'] = 'Pay $30 today.'
        self.save()
        self.assertEqual(self.verify().returncode, 2)

    def test_vtt_and_contract_timing_are_bound_to_observed_segments(self):
        self.vtt.write_text(self.vtt.read_text().replace('00:00:01.000 -->', '00:00:01.100 -->'))
        self.assertEqual(self.verify().returncode, 2)
        self.contract['caption_cues'][1]['start'] = 1.1
        self.save()
        self.assertEqual(self.build().returncode, 2)

    def test_failed_inputs_replace_stale_pass_receipt(self):
        self.output.write_text('{"status":"PASS"}')
        self.transcription_path.unlink()
        self.assertEqual(self.verify().returncode, 2)
        self.assertEqual(json.loads(self.output.read_text())['status'], 'FAIL')

    def test_deep_json_replaces_safe_stale_pass_receipt(self):
        self.transcription_path.write_text('{"nested":' + '[' * 50000 + '0' + ']' * 50000 + '}')
        self.output.write_text('{"status":"PASS"}')
        before = self.vtt.read_bytes()
        self.assertEqual(self.verify().returncode, 2)
        self.assertEqual(json.loads(self.output.read_text())['status'], 'FAIL')
        self.assertEqual(self.build().returncode, 2)
        self.assertEqual(self.vtt.read_bytes(), before)

    def test_failed_transcription_cannot_be_bypassed_with_python_optimization(self):
        self.transcription['status'] = 'FAIL'
        self.save()
        before = self.vtt.read_bytes()
        self.assertEqual(self.build(optimized=True).returncode, 2)
        self.assertEqual(self.vtt.read_bytes(), before)

    def test_special_audio_file_is_rejected_without_blocking(self):
        self.audio.unlink()
        os.mkfifo(self.audio)
        self.assertEqual(self.build().returncode, 2)
        self.assertEqual(self.verify().returncode, 2)

    def test_destination_aliases_never_overwrite_source_inputs(self):
        sources = [self.audio, self.contract_path, self.transcription_path, self.health_path, self.vtt]
        before = {path: path.read_bytes() for path in sources}
        alias = self.root / 'alias.json'
        for target in sources:
            for mode in ('same', 'symlink', 'hardlink'):
                with self.subTest(target=target.name, mode=mode):
                    if alias.exists() or alias.is_symlink():
                        alias.unlink()
                    if mode == 'symlink':
                        alias.symlink_to(target)
                    elif mode == 'hardlink':
                        os.link(target, alias)
                    self.assertEqual(self.verify(target if mode == 'same' else alias).returncode, 2)
                    for source, data in before.items():
                        self.assertEqual(source.read_bytes(), data)
        for target in (self.audio, self.contract_path, self.transcription_path, self.health_path):
            self.assertEqual(self.build(target).returncode, 2)
            self.assertEqual(target.read_bytes(), before[target])

    def workflow_caption_step(self, filename, name, transcribe='success', job='success'):
        text = (ROOT / '.github/workflows' / filename).read_text()
        step = text.split('      - name: ' + name + '\n', 1)[1].split('      - name:', 1)[0]
        self.assertIn('if: ${{ !cancelled() }}', step)
        shell = '\n'.join(line[10:] for line in step.split('        run: |\n', 1)[1].splitlines() if line.startswith('          '))
        shell = shell.replace('${{ steps.transcribe.outcome }}', transcribe).replace('${{ job.status }}', job)
        for script in ('build_verified_captions.py', 'verify_captions.py'):
            shell = shell.replace('python scripts/' + script, shlex.quote(sys.executable) + ' ' + shlex.quote(str(ROOT / 'scripts' / script)))
        self.assertNotIn('${{', shell)
        return subprocess.run(['bash', '-e', '-o', 'pipefail', '-c', shell], cwd=self.root,
                              capture_output=True, text=True, timeout=5)

    def stage_workflow_inputs(self):
        transcription = self.root / 'state/narration-transcription-health.json'
        transcription.write_bytes(self.transcription_path.read_bytes())
        target = self.root / 'public-review/episode1-v10-free.vtt'
        target.parent.mkdir(exist_ok=True)
        target.write_bytes(self.vtt.read_bytes())
        receipt = self.root / 'state/caption-health.json'
        receipt.write_text('{"status":"PASS"}')
        return transcription, receipt

    def test_exact_workflow_steps_invalidate_stale_pass_after_builder_failure(self):
        for filename, name in [('narration-transcription-gate.yml', 'Build and verify synchronized VTT captions'),
                               ('candidate-state-reconcile.yml', 'Reconcile verified captions without rerender')]:
            with self.subTest(workflow=filename):
                transcription, receipt = self.stage_workflow_inputs()
                report = json.loads(transcription.read_text()); report['audio_sha256'] = 'b' * 64
                transcription.write_text(json.dumps(report))
                result = self.workflow_caption_step(filename, name)
                self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
                self.assertEqual(json.loads(receipt.read_text())['status'], 'FAIL')

    def test_exact_workflow_steps_cannot_reuse_old_pass_after_upstream_failure(self):
        for filename, name, transcribe, job in [
                ('narration-transcription-gate.yml', 'Build and verify synchronized VTT captions', 'failure', 'success'),
                ('narration-transcription-gate.yml', 'Build and verify synchronized VTT captions', 'success', 'failure'),
                ('candidate-state-reconcile.yml', 'Reconcile verified captions without rerender', 'success', 'failure')]:
            with self.subTest(workflow=filename, transcribe=transcribe, job=job):
                _, receipt = self.stage_workflow_inputs()
                result = self.workflow_caption_step(filename, name, transcribe, job)
                self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
                self.assertEqual(json.loads(receipt.read_text())['status'], 'FAIL')

    def test_exact_workflow_steps_accept_fresh_matching_evidence(self):
        for filename, name in [('narration-transcription-gate.yml', 'Build and verify synchronized VTT captions'),
                               ('candidate-state-reconcile.yml', 'Reconcile verified captions without rerender')]:
            with self.subTest(workflow=filename):
                _, receipt = self.stage_workflow_inputs()
                result = self.workflow_caption_step(filename, name)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(json.loads(receipt.read_text())['status'], 'PASS')

    def test_invalid_types_and_unbounded_timing_fail_cleanly(self):
        for value in (True, '2', 10**400, float('nan'), float('inf')):
            self.transcription['media_duration_seconds'] = value
            self.save()
            self.assertEqual(self.verify().returncode, 2)
            self.assertEqual(json.loads(self.output.read_text())['status'], 'FAIL')

    def test_missing_candidate_identity_and_enabled_publication_fail(self):
        for changes in ({'candidate_sha256': None}, {'publication_enabled': True}, {'status': 'FAIL'}):
            saved = copy.deepcopy(self.health)
            self.health.update(changes)
            self.save()
            self.assertEqual(self.verify().returncode, 2)
            self.health = saved


if __name__ == '__main__':
    unittest.main()
