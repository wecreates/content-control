import json
import os
from pathlib import Path
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

from scripts import produce_episode1_review as pipeline


class ReviewProductionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.audio = b'synthetic narration'
        audio_sha = pipeline.sha(self.audio)
        cues = [{'start': 0, 'end': 2, 'text': 'Synthetic test narration.'}]
        self.contract = {'publication_enabled': False, 'narration_sha256': audio_sha,
                         'narration_text': cues[0]['text'], 'caption_cues': cues}
        self.before = {'state/episode1-factual-contract.json': pipeline.sha(json.dumps(self.contract).encode())}
        self.write('video.mp4', b'synthetic video bytes')
        self.write('captions.vtt', pipeline.render_vtt(cues).encode())
        self.write('narration-transcription.json', {
            'status': 'PASS', 'publication_enabled': False, 'audio_sha256': audio_sha,
            'expected_text': cues[0]['text'], 'actual_transcript': cues[0]['text'],
            'media_duration_seconds': 2, 'transcribed_duration_seconds': 2, 'segments': cues})
        self.write('encoded-transcription.json', {'fixture': 'synthetic only'})
        self.write('video.mp4.json', {'video_sha256': pipeline.digest(self.root / 'video.mp4'),
            'narration_sha256': audio_sha, 'caption_sha256': pipeline.digest(self.root / 'captions.vtt'),
            'publication_enabled': False, 'production_approved': False})
        self.write('encoded-verification.json', {'status': 'PASS',
            'candidate_sha256': pipeline.digest(self.root / 'video.mp4'),
            'contract_sha256': self.before['state/episode1-factual-contract.json'],
            'transcription_receipt_sha256': pipeline.digest(self.root / 'encoded-transcription.json'),
            'publication_enabled': False, 'production_approved': False})
        self.write('mobile-verification.json', {'status': 'PASS', 'publication_enabled': False})
        self.write('audio-verification.json', {'verdict': 'PASS',
            'candidate_sha256': pipeline.digest(self.root / 'video.mp4'),
            'publication_enabled': False, 'production_approved': False})

    def write(self, name, value):
        (self.root / name).write_bytes(value if isinstance(value, bytes) else json.dumps(value).encode())

    def bind(self, after=None):
        return pipeline.validate_bindings(self.root, self.contract, self.audio, self.before,
                                          self.before if after is None else after)

    def test_receipts_require_same_candidate_captions_transcript_and_source(self):
        self.assertEqual(self.bind(), pipeline.digest(self.root / 'video.mp4'))
        for filename in ('video.mp4', 'captions.vtt', 'encoded-transcription.json'):
            with self.subTest(filename=filename):
                original = (self.root / filename).read_bytes()
                self.write(filename, original + b'changed')
                with self.assertRaises(ValueError): self.bind()
                self.write(filename, original)
        with self.assertRaisesRegex(ValueError, 'Source inputs changed'):
            self.bind({'state/episode1-factual-contract.json': '0' * 64})

    def test_failed_or_unbound_audio_does_not_become_review_ready(self):
        original = json.loads((self.root / 'audio-verification.json').read_text())
        for patch in ({'verdict': 'FAIL'}, {'candidate_sha256': '0' * 64}, {'publication_enabled': True}):
            with self.subTest(patch=patch):
                self.write('audio-verification.json', dict(original, **patch))
                with self.assertRaisesRegex(ValueError, 'Technical audio verification'): self.bind()

    def test_output_collision_does_not_overwrite_existing_receipt(self):
        self.write('run.json', {'status': 'historical record'})
        with self.assertRaises(FileExistsError): pipeline.produce(self.root)
        self.assertEqual(json.loads((self.root / 'run.json').read_text())['status'], 'historical record')

    def test_enabled_publishing_blocks_before_any_command(self):
        output = self.root / 'blocked'
        with patch.dict(os.environ, {'PUBLICATION_ENABLED': 'true'}), patch.object(pipeline, 'run_command') as command:
            result = pipeline.produce(output)
        command.assert_not_called()
        self.assertEqual(result['status'], 'BLOCKED')
        self.assertFalse(result['production_approved'])

    def test_command_failure_records_stage_and_cleans_owned_scratch(self):
        output = self.root / 'failed'
        def failed(*args, **kwargs):
            scratch = output / '.render-work'
            scratch.mkdir(); (scratch / 'partial').write_text('temporary')
            raise RuntimeError('synthetic stage failure')
        with patch.object(pipeline, 'run_command', side_effect=failed):
            result = pipeline.produce(output)
        self.assertEqual(result['status'], 'BLOCKED')
        self.assertEqual(result['failed_step'], 'runtime')
        self.assertEqual(result['steps'][0]['status'], 'FAIL')
        self.assertFalse((output / '.render-work').exists())
        self.assertFalse(result['full_av_review'])

    def test_deadline_kills_child_process_group_before_child_writes(self):
        marker = self.root / 'escaped-child'
        child = 'import time,pathlib;time.sleep(.5);pathlib.Path(' + repr(str(marker)) + ').write_text("escaped")'
        parent = 'import subprocess,sys,time;subprocess.Popen([sys.executable,"-c",' + repr(child) + ']);time.sleep(30)'
        with self.assertRaises(TimeoutError):
            pipeline.run_command([sys.executable, '-c', parent], cwd=self.root,
                                 log=self.root / 'timeout.log', deadline=time.monotonic() + .15,
                                 env=os.environ.copy())
        time.sleep(.6)
        self.assertFalse(marker.exists())

    def test_embedding_guardian_owns_source_sync_as_well_as_media_commands(self):
        commands = []
        def runner(command, **options):
            commands.append((command, options))
            if 'scripts.verify_episode1_sync import verify' in ' '.join(command):
                raise RuntimeError('Synthetic source-sync stop')
        with patch.object(pipeline, 'run_command', side_effect=AssertionError('unguarded command')):
            result = pipeline.produce(self.root / 'embedded', command_runner=runner)
        self.assertEqual(result['failed_step'], 'source-sync')
        self.assertEqual(len(commands), 4)
        self.assertTrue(all(options['deadline'] == commands[0][1]['deadline'] for _, options in commands))
        self.assertEqual(result['status'], 'BLOCKED')


if __name__ == '__main__':
    unittest.main()
