import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts import creative_preview_artifact as preview


class CreativePreviewTests(unittest.TestCase):
    branch = 'codex/v2-grounded-staging-20261121'
    commit = 'a' * 40

    def fixture(self, root):
        captions = {'status': 'PASS', 'publication_enabled': False, 'cues': []}
        ccsd = {'publication_enabled': False, 'caption_track': captions, 'scenes': [{'end': 1}]}
        for name, value in [('ccsd.json', ccsd), ('captions.json', captions)]:
            (root / name).write_text(json.dumps(value))
        (root / 'mix').mkdir()
        (root / 'mix/mix.wav').write_bytes(b'original approved mix')
        (root / 'render').mkdir()
        (root / 'render/v2-boss-fight.mp4').write_bytes(b'original approved encoded video')
        return {name: preview.sha(root / name) for name in preview.INPUT_HASHES}

    def test_arbitrary_branch_shell_text_and_non_exact_sha_rejected(self):
        preview.validate_source(self.branch, self.commit)
        for branch, commit in [('main', self.commit), ('fork/evil', self.commit),
                               (self.branch, 'main'), (self.branch, 'a'*39),
                               (self.branch, '$(curl example.invalid)')]:
            with self.subTest(branch=branch, commit=commit), self.assertRaises(ValueError):
                preview.validate_source(branch, commit)

    def test_exact_original_props_preserved_with_explicit_preview_flags(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(preview, 'INPUT_HASHES', self.fixture(root)):
                preview.prepare(root, root/'output', self.branch, self.commit, True, False)
                props = json.loads((root/'output/props.json').read_text())
                self.assertEqual(props['ccsd'], json.loads((root/'ccsd.json').read_text()))
                self.assertIs(props['groundedPreview'], True)
                self.assertIs(props['stylePreview'], False)

    def test_each_changed_audio_caption_scene_or_video_input_fails(self):
        for name in preview.INPUT_HASHES:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                with patch.object(preview, 'INPUT_HASHES', self.fixture(root)):
                    (root/name).write_bytes(b'replaced')
                    with self.assertRaisesRegex(ValueError, 'identity mismatch'):
                        preview.verify_inputs(root)

    def test_matching_file_hashes_do_not_override_publication_or_caption_guards(self):
        for change in ('publication', 'caption'):
            with self.subTest(change=change), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                hashes = self.fixture(root)
                ccsd = json.loads((root/'ccsd.json').read_text())
                if change == 'publication':
                    ccsd['publication_enabled'] = True
                else:
                    ccsd['caption_track']['cues'] = [{'text': 'invented'}]
                (root/'ccsd.json').write_text(json.dumps(ccsd))
                hashes['ccsd.json'] = preview.sha(root/'ccsd.json')
                with patch.object(preview, 'INPUT_HASHES', hashes), self.assertRaises(ValueError):
                    preview.verify_inputs(root)

    def test_output_receipt_rejects_changed_audio(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(preview, 'INPUT_HASHES', self.fixture(root)):
                preview.prepare(root, root/'output', self.branch, self.commit)
                probe = {'streams': [
                    {'codec_type': 'video', 'width':720, 'height':1280, 'r_frame_rate':'24/1', 'nb_frames':'24'},
                    {'codec_type': 'audio'}]}
                with patch.object(preview.subprocess, 'check_output', return_value=json.dumps(probe)), patch.object(preview, 'audio_hash', side_effect=['original', 'changed']):
                    with self.assertRaisesRegex(ValueError, 'audio changed'):
                        preview.receipt(root, root/'output', self.branch, self.commit, 'b'*40)
                self.assertFalse((root/'output/receipt.json').exists())

    def test_decoder_failure_never_issues_success_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(preview, 'INPUT_HASHES', self.fixture(root)):
                preview.prepare(root, root/'output', self.branch, self.commit)
                (root/'output/creative-preview.mp4').write_bytes(b'corrupt media')
                probe = {'streams': [
                    {'codec_type': 'video', 'width':720, 'height':1280, 'r_frame_rate':'24/1', 'nb_frames':'24'},
                    {'codec_type': 'audio'}]}
                with patch.object(preview.subprocess, 'check_output', return_value=json.dumps(probe)), patch.object(preview, 'audio_hash', return_value='same-audio'), patch.object(preview.subprocess, 'run', side_effect=preview.subprocess.CalledProcessError(1, 'ffmpeg')) as decoder:
                    with self.assertRaises(preview.subprocess.CalledProcessError):
                        preview.receipt(root, root/'output', self.branch, self.commit, 'b'*40)
                    command = decoder.call_args.args[0]
                    self.assertIn('-xerror', command)
                    self.assertEqual(command[-3:], ['-f', 'null', '-'])
                    self.assertTrue(decoder.call_args.kwargs['check'])
                self.assertFalse((root/'output/receipt.json').exists())

    def test_workflow_has_no_production_mutation_or_provider_secrets(self):
        workflow = Path('.github/workflows/creative-branch-preview.yml').read_text()
        for forbidden in ('contents: write', 'actions: write', 'secrets.', 'git push', 'gh workflow', 'workflow_run:', '\n  push:', '\n  schedule:', 'persist_v2_artifacts', 'deploy'):
            self.assertNotIn(forbidden, workflow)
        self.assertEqual(workflow.count('persist-credentials: false'), 3)
        self.assertIn('actions: read', workflow)
        self.assertIn('timeout-minutes: 20', workflow)
        self.assertIn('run-id: 44821511267', workflow)
        self.assertIn('github.ref == \'refs/heads/main\'', workflow)
        self.assertIn('--concurrency=2', workflow)


if __name__ == '__main__':
    unittest.main()
