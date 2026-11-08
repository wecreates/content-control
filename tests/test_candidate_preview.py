import importlib.util
from pathlib import Path
import unittest
import tempfile
import json
import os
import io
from contextlib import redirect_stdout
from unittest.mock import patch
from types import SimpleNamespace
from contextlib import ExitStack

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
    def test_runtime_wrapper_identity_checks_and_child_exit(self):
        runtime_spec=importlib.util.spec_from_file_location('runtime',ROOT/'scripts/frozen_narration_runtime.py')
        runtime=importlib.util.module_from_spec(runtime_spec)
        runtime_spec.loader.exec_module(runtime)
        for case in ['success','package','binary','python','numpy','child_exit']:
            with self.subTest(case=case), ExitStack() as stack:
                def package_version(args, **kwargs):
                    if case=='package' and args[-1]=='ffmpeg':return 'wrong-version'
                    return '3.100-6+b3' if args[-1]=='libmp3lame0' else '7:7.1.5-0+deb13u1'
                stack.enter_context(patch.object(runtime.subprocess,'check_output',side_effect=package_version))
                stack.enter_context(patch.object(runtime.platform,'python_version',return_value='0.0.0' if case=='python' else '3.12.14'))
                stack.enter_context(patch.dict('sys.modules',{'numpy':SimpleNamespace(__version__='0.0.0' if case=='numpy' else '2.3.5')}))
                stack.enter_context(patch.object(runtime.Path,'read_bytes',return_value=b'explicitly synthetic binary fixture'))
                expected=[value[1] for value in runtime.BINARIES.values()]
                if case=='binary':expected[0]='0'*64
                stack.enter_context(patch.object(runtime.hashlib,'sha256',side_effect=[SimpleNamespace(hexdigest=lambda h=h:h) for h in expected]))
                write=stack.enter_context(patch.object(runtime.Path,'write_text'))
                child=stack.enter_context(patch.object(runtime.subprocess,'run',return_value=SimpleNamespace(returncode=7 if case=='child_exit' else 0)))
                code=runtime.main()
                report=json.loads(write.call_args.args[0])
                if case in {'success','child_exit'}:
                    self.assertEqual(code,7 if case=='child_exit' else 0)
                    self.assertEqual(report['status'],'RUNTIME_IDENTITIES_VERIFIED')
                    child.assert_called_once_with([runtime.sys.executable,'/input/regenerate.py',
                        '--source','/input/original.mp3','--output-dir','/output/result'],check=False)
                else:
                    self.assertEqual(code,2)
                    self.assertEqual(report['status'],'BLOCKED')
                    child.assert_not_called()
    def test_container_is_reconstruction_only_and_isolated(self):
        args=p.reconstruction_container_args(p.OUT/'regeneration-work')
        self.assertEqual(args[:3],['docker','run','--rm'])
        for key,value in [('--network','none'),('--platform','linux/amd64'),('--cap-drop','ALL'),('--security-opt','no-new-privileges')]:
            self.assertEqual(args[args.index(key)+1],value)
        self.assertIn('--read-only',args)
        self.assertNotIn('--privileged',args)
        self.assertNotIn('docker.sock',' '.join(args))
        mounts=[args[i+1] for i,v in enumerate(args) if v=='--mount']
        self.assertEqual(len(mounts),4)
        self.assertEqual(sum(x.endswith(',readonly') for x in mounts),3)
        self.assertTrue(next(x for x in mounts if not x.endswith(',readonly')).endswith(',target=/output'))
        dockerfile=(ROOT/'scripts/frozen_narration.Dockerfile').read_text()
        self.assertIn('FROM python@sha256:6dc02694c53fde08b0e39de9273a708d2f2a612f77dc173a64835c3f7a40ee35',dockerfile)
        self.assertIn('ffmpeg=7:7.1.5-0+deb13u1',dockerfile)
        self.assertIn('libmp3lame0=3.100-6+b3',dockerfile)
        for forbidden in ['--allow-unauthenticated','trusted=yes','COPY','ADD','--privileged']:
            self.assertNotIn(forbidden,dockerfile)
    def test_runtime_diagnostic_omits_unknown_fields(self):
        with tempfile.TemporaryDirectory() as td:
            old=os.getcwd()
            try:
                os.chdir(td);p.OUT.mkdir()
                p.save(p.OUT/'encoder-runtime.json',{'status':'RUNTIME_IDENTITIES_VERIFIED',
                    'base_image_reference':'python@sha256:'+'a'*64,
                    'packages':{'ffmpeg':'7:7.1.5-0+deb13u1','private':'MEDIA_SENTINEL'},
                    'binaries_sha256':{'ffmpeg':'b'*64},'media':'MEDIA_SENTINEL'})
                result=p.encoder_runtime_diagnostic()
                self.assertEqual(result['packages'],{'ffmpeg':'7:7.1.5-0+deb13u1'})
                self.assertNotIn('MEDIA_SENTINEL',json.dumps(result))
            finally:os.chdir(old)
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
                Path('state/episode1-factual-contract.json').write_text('canonical original contract')
                p.DRAFT_CONTRACT.parent.mkdir(parents=True)
                p.DRAFT_CONTRACT.write_text('{}')
                p.OUT.mkdir()
                def fake_command(args):
                    self.assertIn('target=/input/original.mp3,readonly',' '.join(args))
                    target=p.OUT/'regeneration-work/result';target.mkdir()
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
                    self.assertEqual(Path('state/episode1-factual-contract.json').read_text(),'canonical original contract')
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
    def test_diagnostic_uses_only_explicit_preview_sources(self):
        source=(ROOT/'scripts/v10_candidate_preview.py').read_text()
        self.assertIn("'render', 'preview/v10-narration-candidate/index.jsx'",source)
        self.assertIn("'Episode1V10NarrationCandidate'",source)
        self.assertNotIn("'render', 'remotion/v10-index.jsx'",source)
        self.assertEqual(str(p.DRAFT_CONTRACT),'preview/v10-narration-candidate/episode1-factual-contract.draft.json')
        self.assertIn('shutil.copyfile(DRAFT_CONTRACT, contract)',source)
        pins=json.loads((ROOT/'scripts/v10_candidate_preview_inputs.json').read_text())
        self.assertNotIn('remotion/NarrationFrameMap.mjs',pins)
        self.assertIn('preview/v10-narration-candidate/NarrationFrameMap.mjs',pins)
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

