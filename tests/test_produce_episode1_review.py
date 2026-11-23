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

    def test_direct_cli_supplies_a_sibling_preparation_directory(self):
        output = self.root / 'direct'
        with patch.object(sys, 'argv', ['producer', '--output', str(output)]), \
                patch.object(pipeline, 'produce', return_value={'status': 'AWAITING_REVIEW'}) as produce, \
                patch('builtins.print'):
            self.assertEqual(pipeline.main(), 0)
        self.assertEqual(produce.call_args.kwargs['offline_review'], output.with_name('direct-offline-av'))

    def test_guarded_offline_preparation_binds_candidate_and_captions(self):
        source = self.root / 'source'
        for name, value in {
            'state/episode1-factual-contract.json': json.dumps(dict(self.contract, status='ACTIVE')).encode(),
            'public/audio/episode1-narration.mp3': self.audio,
            'scripts/offline_av_review.py': b'fixture tool',
        }.items():
            target = source / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(value)

        for valid in (True, False):
            with self.subTest(valid=valid):
                output = self.root / ('good' if valid else 'bad')
                prepared = output.with_name(output.name + '-offline-av')
                deadlines = set()

                def runner(command, *, cwd, log, deadline, env):
                    deadlines.add(deadline)
                    if log.name == 'source-sync.log':
                        (output / 'source-sync.json').write_text('{"status":"PASS"}')
                    if log.name == 'render.log':
                        for item in self.root.iterdir():
                            if item.is_file():
                                (output / item.name).write_bytes(item.read_bytes())
                    if log.name == 'offline-av-review.log':
                        self.assertEqual(command[-6:], ['--video', str(output / 'video.mp4'), '--captions',
                                                       str(output / 'captions.vtt'), '--out', str(prepared)])
                        prepared.mkdir()
                        for name, value in {'candidate.mp4': (output / 'video.mp4').read_bytes(),
                                            'captions.vtt': (output / 'captions.vtt').read_bytes(),
                                            'playback-mix.wav': b'test mixer', 'review-packets.json': b'{}'}.items():
                            (prepared / name).write_bytes(value)
                        files = {item.name: pipeline.digest(item) for item in prepared.iterdir()}
                        (prepared / 'evidence.json').write_text(json.dumps({
                            'status': 'REVIEW_PENDING', 'technical_decode': 'PASS', 'files': files,
                            'candidate_sha256': files['candidate.mp4'],
                            'caption_sha256': files['captions.vtt'] if valid else '0'*64,
                            **dict.fromkeys(('full_video_review', 'full_audio_review', 'production_approved',
                                             'publication_enabled'), False)}))

                with patch.object(pipeline, 'source_hashes', return_value=self.before):
                    result = pipeline.produce(output, root=source, command_runner=runner, offline_review=prepared)
                self.assertEqual(len(deadlines), 1)
                self.assertEqual(result['status'], 'AWAITING_REVIEW' if valid else 'BLOCKED', result)
                self.assertFalse(result['full_av_review'])
                self.assertEqual(result['review_preparation']['status'], 'REVIEW_PENDING' if valid else 'BLOCKED')
                self.assertFalse((output / 'evidence.json').exists())
                if valid:
                    self.assertEqual(result['review_preparation']['evidence_sha256'], pipeline.digest(prepared / 'evidence.json'))
                    self.assertFalse(result['review_preparation']['competitor_comparison_verified'])
                else:
                    self.assertEqual(result['failed_step'], 'offline-av-review')
                    self.assertEqual(result['steps'][-1]['status'], 'FAIL')


if __name__ == '__main__':
    unittest.main()
