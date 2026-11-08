import importlib.util
from pathlib import Path
import unittest
import tempfile
import json
import os
import io
from contextlib import redirect_stdout
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('preview', ROOT/'scripts/v10_candidate_preview.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)

class Guards(unittest.TestCase):
    def setUp(self):
        self.env = dict(GITHUB_ACTIONS='true', RUNNER_ENVIRONMENT='github-hosted',
            GITHUB_EVENT_NAME='pull_request', GITHUB_REPOSITORY='wecreates/content-control',
            SOURCE_REPOSITORY='wecreates/content-control', BASE_REPOSITORY='wecreates/content-control',
            BASE_REF='main', SOURCE_REF='candidate/v10-canonical-preview-20261108',
            EXPECTED_SOURCE_SHA='a'*40, GITHUB_RUN_ID='42', GITHUB_RUN_ATTEMPT='1')
    def test_valid(self):
        self.assertEqual(p.identity(self.env)['source_commit'], 'a'*40)
    def test_denials(self):
        for key,value in [('GITHUB_ACTIONS','false'),('RUNNER_ENVIRONMENT','self-hosted'),
            ('GITHUB_EVENT_NAME','pull_request_target'),('SOURCE_REPOSITORY','fork/content-control'),
            ('SOURCE_REF','main'),('SOURCE_REF','other'),('EXPECTED_SOURCE_SHA','main'),
            ('EXPECTED_SOURCE_SHA','a'*39),('BASE_REPOSITORY','other/repo'),('BASE_REF','dev')]:
            with self.subTest(key=key,value=value), self.assertRaises(ValueError):
                p.identity(dict(self.env, **{key:value}))
    def test_workflow_boundary(self):
        s=(ROOT/'.github/workflows/v10-canonical-candidate-preview.yml').read_text()
        for forbidden in ['workflow_dispatch:', 'pull_request_target:', 'schedule:', 'contents: write',
            'actions: write', 'secrets.', 'git push', 'gh workflow', 'self-hosted',
            'upload-artifact', 'actions/cache', 'cache:', 'retention-days', 'ARTIFACT_STORAGE_APPROVED']:
            self.assertNotIn(forbidden,s)
        for required in ['github.event.repository.private == false', 'pull_request:', 'persist-credentials: false',
            'ref: ${{ github.event.pull_request.head.sha }}', 'contents: read', 'Seal exact bytes and emit compact diagnostic summary']:
            self.assertIn(required,s)
    def test_no_acceptance_claims_or_persistence(self):
        s=(ROOT/'scripts/v10_candidate_preview.py').read_text()
        for forbidden in ['enforce_free_qa_regression.py','persist_caption_evidence.py','git push',
            'update_acceptance_ledger.py','state/content-control-health.json','--no-sandbox']:
            self.assertNotIn(forbidden,s)
        self.assertIn('pan=stereo|c0=c0|c1=c0,aresample=48000,apad,atrim=duration=30',s)
        self.assertIn("OUT.mkdir(exist_ok=False)",s)
        self.assertIn("creative_acceptance='UNASSESSED'",s)
        self.assertIn('canonical_verify_captions_requires_green',p.UNRUN)
    def test_source_mutation_fails(self):
        with tempfile.TemporaryDirectory() as td:
            old = os.getcwd()
            try:
                os.chdir(td)
                Path('scripts').mkdir()
                Path('input').write_text('approved')
                Path('scripts/v10_candidate_preview_inputs.json').write_text(json.dumps({'input':p.digest('input')}))
                p.sources()
                Path('input').write_text('mutated')
                with self.assertRaises(ValueError): p.sources()
            finally: os.chdir(old)
    def test_failure_manifest_never_inherits_old_pass(self):
        with tempfile.TemporaryDirectory() as td:
            old = os.getcwd()
            try:
                os.chdir(td)
                p.OUT.mkdir()
                p.save(p.OUT/'gates.json', {'fresh_asr':{'status':'FAIL'}})
                with patch.dict(os.environ,self.env,clear=True), patch.object(p,'sources',return_value={}):
                    p.manifest()
                m=json.loads((p.OUT/'manifest.json').read_text())
                self.assertIsNone(m['candidate_sha256'])
                self.assertFalse(m['media_retained'])
                self.assertFalse(m['reviewable_video_available'])
                self.assertFalse(m['production_ready'])
                self.assertFalse(m['publication_enabled'])
                self.assertEqual(m['gates']['audio']['status'],'NOT_RUN')
                self.assertEqual(m['gates']['fresh_asr']['status'],'FAIL')
                self.assertEqual(m['listening_acceptance'],'UNASSESSED')
            finally: os.chdir(old)
    def test_regeneration_diagnostic_is_bounded_allowlist(self):
        with tempfile.TemporaryDirectory() as td:
            old = os.getcwd()
            try:
                os.chdir(td)
                target=p.OUT/'regenerated-audio';target.mkdir(parents=True)
                p.save(target/'regeneration-receipt.json', {
                    'status':'BLOCKED', 'reason':'Frozen MP3 hash mismatch; PRIVATE_MEDIA_SENTINEL',
                    'expected_wav_sha256':'a'*64, 'observed_wav_sha256':'b'*64,
                    'expected_mp3_sha256':'c'*64, 'observed_mp3_sha256':'d'*64,
                    'numpy':'2.3.5', 'python':'3.12.14',
                    'ffmpeg_version':'ffmpeg version 7.1.5-0+deb13u1 Copyright (c) 2000-2025 the FFmpeg developers\nPRIVATE_MEDIA_SENTINEL',
                    'actual_transcript':'PRIVATE_MEDIA_SENTINEL','recipe':{'media':'PRIVATE_MEDIA_SENTINEL'}})
                result=p.regeneration_diagnostic()
                self.assertEqual(result['observed_mp3_sha256'],'d'*64)
                self.assertEqual(result['python'],'3.12.14')
                self.assertIn('Frozen MP3 hash mismatch',result['reason'])
                self.assertNotIn('PRIVATE_MEDIA_SENTINEL',json.dumps(result))
                self.assertNotIn('recipe',result)
                self.assertLess(len(json.dumps(result)),1200)
                p.save(target/'regeneration-receipt.json',{'status':'PRIVATE_MEDIA_SENTINEL',
                     'reason':'PRIVATE_MEDIA_SENTINEL','observed_mp3_sha256':'bad',
                     'numpy':'PRIVATE_MEDIA_SENTINEL','ffmpeg_version':'arbitrary text'})
                result=p.regeneration_diagnostic()
                self.assertEqual(result['status'],'INVALID_STATUS')
                self.assertNotIn('PRIVATE_MEDIA_SENTINEL',json.dumps(result))
                (target/'regeneration-receipt.json').write_text('x'*32769)
                self.assertEqual(p.regeneration_diagnostic()['status'],'INVALID_RECEIPT')
            finally: os.chdir(old)
    def test_regeneration_stages_only_verified_bytes_and_preserves_original(self):
        with tempfile.TemporaryDirectory() as td:
            old = os.getcwd()
            try:
                os.chdir(td)
                p.ORIGINAL_AUDIO.parent.mkdir(parents=True)
                p.ORIGINAL_AUDIO.write_bytes(b'original fixture')
                Path('state').mkdir()
                Path('state/episode1-factual-contract.json').write_text('{}')
                p.OUT.mkdir()
                def fake_command(args):
                    self.assertEqual(args[args.index('--source')+1],str(p.ORIGINAL_AUDIO))
                    target=Path(args[args.index('--output-dir')+1]);target.mkdir()
                    (target/'narration-currency-edit-candidate.mp3').write_bytes(b'generated fixture')
                    (target/'narration-currency-edit-candidate.wav').write_bytes(b'wav fixture')
                    p.save(target/'regeneration-receipt.json',{'status':'FROZEN_BYTES_REPRODUCED'})
                import hashlib
                with patch.object(p,'command',side_effect=fake_command), \
                     patch.object(p,'GENERATED_SHA',hashlib.sha256(b'generated fixture').hexdigest()), \
                     patch.object(p,'GENERATED_WAV_SHA',hashlib.sha256(b'wav fixture').hexdigest()):
                    p.regenerate_audio()
                    p.generated_identity()
                    self.assertEqual(p.AUDIO.read_bytes(),b'generated fixture')
                    self.assertEqual(p.ORIGINAL_AUDIO.read_bytes(),b'original fixture')
                    p.AUDIO.write_bytes(b'changed')
                    with self.assertRaises(ValueError):p.generated_identity()
            finally: os.chdir(old)
    def test_caption_builder_has_isolated_cwd_and_absolute_script(self):
        with patch.object(p,'command') as command:
            p.build_isolated_captions()
        args=command.call_args.args[0]
        self.assertEqual(Path(args[1]),Path('scripts/build_verified_captions.py').resolve())
        self.assertEqual(command.call_args.kwargs['cwd'],p.OUT.resolve())
        self.assertTrue(Path(args[2]).is_absolute())
        self.assertTrue(Path(args[3]).is_absolute())
    def test_original_and_generated_pins_are_separate(self):
        pins=json.loads((ROOT/'scripts/v10_candidate_preview_inputs.json').read_text())
        self.assertEqual(pins['public/audio/episode1-narration.mp3'],'77ae2168527509c49a02ab08d9e54f8c04fd5774309bba82e8eefa88974074fb')
        self.assertEqual(p.GENERATED_SHA,'c2b633f1c509fec43be6fd75d365b6335ca273e8beb6be6c5552bbb3cd24cd57')
        self.assertEqual(pins['scripts/regenerate_frozen_narration.py'],'8c83de19d5ac873a1d2da8fcb7db22bacc7195e4a40fd69d4627d7699151b287')
        source=(ROOT/'scripts/v10_candidate_preview.py').read_text()
        self.assertIn("'--public-dir', str((OUT / 'public').resolve())",source)
        self.assertNotIn('base64',source.split('def run():')[1].split('def manifest():')[0])
    def test_summary_is_text_only_no_media_contents(self):
        with tempfile.TemporaryDirectory() as td:
            old = os.getcwd()
            try:
                os.chdir(td)
                p.OUT.mkdir()
                p.VIDEO.write_bytes(b'PRIVATE_MEDIA_BYTES_SENTINEL')
                p.save(p.OUT/'gates.json', {})
                capture=io.StringIO()
                env=dict(self.env,GITHUB_STEP_SUMMARY=str(Path(td)/'summary.txt'))
                with patch.dict(os.environ,env,clear=True), patch.object(p,'sources',return_value={}), redirect_stdout(capture):
                    p.manifest()
                text=capture.getvalue()
                self.assertNotIn('PRIVATE_MEDIA_BYTES_SENTINEL',text)
                self.assertNotIn('PRIVATE_MEDIA_BYTES_SENTINEL',Path('summary.txt').read_text())
                result=json.loads(text)
                self.assertFalse(result['media_retained'])
                self.assertFalse(result['reviewable_video_available'])
                self.assertEqual(result['candidate_sha256'],p.digest(p.VIDEO))
                self.assertLess(len(text),12000)
            finally: os.chdir(old)
    def test_source_and_pin_mutation_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            old = os.getcwd()
            try:
                os.chdir(td)
                Path('scripts').mkdir()
                Path('input').write_text('approved')
                approved={'input':p.digest('input')}
                p.save('scripts/v10_candidate_preview_inputs.json',approved)
                p.OUT.mkdir()
                p.save(p.OUT/'inputs.json', {'source_hashes':approved,'control_hashes':{}})
                p.sources()
                Path('input').write_text('changed')
                p.save('scripts/v10_candidate_preview_inputs.json',{'input':p.digest('input')})
                with self.assertRaisesRegex(ValueError,'pins changed'): p.sources()
            finally: os.chdir(old)
    def test_automatic_config_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            old = os.getcwd()
            try:
                os.chdir(td)
                Path('remotion.config.ts').write_text('// unexpected')
                with self.assertRaisesRegex(ValueError,'Remotion config'): p.sources()
            finally: os.chdir(old)
    def test_post_gate_video_mutation_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            old = os.getcwd()
            try:
                os.chdir(td)
                p.OUT.mkdir()
                p.VIDEO.write_bytes(b'new rendered video')
                p.save(p.OUT/'gates.json', {})
                with patch.object(p,'sources',return_value={}):
                    p.gate('audio', lambda: None)
                p.VIDEO.write_bytes(b'changed after audio PASS')
                with patch.dict(os.environ,self.env,clear=True), patch.object(p,'sources',return_value={}):
                    with self.assertRaises(SystemExit): p.manifest()
                m=json.loads((p.OUT/'manifest.json').read_text())
                self.assertEqual(m['gates']['source_identity_at_sealing']['status'],'FAIL')
                self.assertIn('Evidence changed after gate audio',m['gates']['source_identity_at_sealing']['reason'])
            finally: os.chdir(old)
    def test_seal_mutation_fails_but_keeps_truthful_manifest(self):
        with tempfile.TemporaryDirectory() as td:
            old = os.getcwd()
            try:
                os.chdir(td)
                p.OUT.mkdir()
                p.save(p.OUT/'gates.json', {})
                with patch.dict(os.environ,self.env,clear=True), patch.object(p,'sources',side_effect=ValueError('changed')):
                    with self.assertRaises(SystemExit): p.manifest()
                m=json.loads((p.OUT/'manifest.json').read_text())
                self.assertEqual(m['gates']['source_identity_at_sealing']['status'],'FAIL')
            finally: os.chdir(old)
if __name__=='__main__': unittest.main()

