"""Synthetic GitHub fixtures only. No API access or hosted authenticity claim."""
import copy
import io
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zipfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import import_hosted_npm_security_evidence as hosted
from test_npm_security_audit import fixture, audit

class HostedTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        for name in ('package.json','package-lock.json'):(self.root/name).write_text('{}')
        self.source='a'*40;self.repo='example/repo';self.run_id=123
        self.identity={'source_sha':self.source,'manifest_sha256':{n:hosted.sha(b'{}') for n in ('package.json','package-lock.json')}}
        self.report=audit.normalize(fixture(),0)
        self.receipt={'receipt_schema_version':1,'origin':'github_actions','SOURCE_SHA':self.source,'RUN_ID':'123','RUN_ATTEMPT':'1','REPOSITORY':self.repo,'WORKFLOW_PATH':hosted.WORKFLOW,'package_sha256':hosted.sha(b'{}'),'package_lock_sha256':hosted.sha(b'{}'),'report_sha256':hosted.sha(hosted.encode(self.report))}
        self.files={'npm-audit.json':hosted.encode(fixture()),'npm-audit-exit':b'0\n','runtime-security-audit.json':hosted.encode(self.report),'provenance.json':hosted.encode(self.receipt)}
        self.run={'id':123,'status':'completed','conclusion':'success','head_sha':self.source,'path':hosted.WORKFLOW,'repository':{'full_name':self.repo},'head_repository':{'full_name':self.repo},'event':'push','head_branch':'main','run_attempt':1}
        self.archive=self.zip(self.files)
        self.artifact={'id':456,'size_in_bytes':len(self.archive),'name':f'runtime-security-audit-{self.source}-123-1','expired':False,'workflow_run':{'id':123,'head_sha':self.source},'digest':'sha256:'+hosted.sha(self.archive)}
        self.calls=[]
    def zip(self,files):
        stream=io.BytesIO()
        with zipfile.ZipFile(stream,'w') as archive:
            for name,data in files.items():archive.writestr(name,data)
        return stream.getvalue()
    def get(self,route,binary=False):
        self.calls.append(route)
        if route.endswith('/zip'):return self.archive
        if '/artifacts?' in route:return {'artifacts':[self.artifact]}
        return self.run
    def retrieve(self):
        with patch.object(hosted,'identity',return_value=self.identity):
            return hosted.retrieve_verified(self.root,self.source,self.repo,self.run_id,self)
    def git(self,command,**kwargs):
        return SimpleNamespace(returncode=0,stdout=str(self.root) if '--show-toplevel' in command else '')
    def promote(self,bundle):
        with patch.object(hosted,'identity',return_value=self.identity):
            hosted.promote(self.root,bundle)
    def test_verified_retrieval_and_promotion(self):
        bundle=self.retrieve();self.promote(bundle)
        self.assertEqual(hosted.load_hosted_report(self.root,self.repo,self.git),self.report)
        self.assertEqual(len(self.calls),3)
        self.assertNotEqual(bundle['origin'],'local_scan')
    def test_wrong_run_identity_rejected(self):
        for key,value in [('conclusion','failure'),('head_sha','b'*40),('path','evil.yml'),('head_branch','other'),('event','pull_request'),('repository',{'full_name':'other/repo'}),('head_repository',{'full_name':'other/repo'}),('run_attempt',2)]:
            with self.subTest(key=key):
                original=self.run;self.run=copy.deepcopy(original);self.run[key]=value
                with self.assertRaises(ValueError):self.retrieve()
                self.run=original
    def test_digest_expiration_and_artifact_binding(self):
        for key,value in [('digest','sha256:'+'0'*64),('expired',True),('workflow_run',{'id':999,'head_sha':self.source})]:
            original=self.artifact;self.artifact=copy.deepcopy(original);self.artifact[key]=value
            with self.assertRaises(ValueError):self.retrieve()
            self.artifact=original
    def test_checkout_changed_during_import_rejected(self):
        changed=copy.deepcopy(self.identity);changed['source_sha']='b'*40
        with patch.object(hosted,'identity',side_effect=[self.identity,changed]):
            with self.assertRaises(ValueError):hosted.retrieve_verified(self.root,self.source,self.repo,123,self)
    def test_manifest_and_run_receipt_tampering(self):
        for key in ('package_sha256','package_lock_sha256','RUN_ID','RUN_ATTEMPT','SOURCE_SHA','REPOSITORY','WORKFLOW_PATH'):
            files=copy.deepcopy(self.files);receipt=copy.deepcopy(self.receipt);receipt[key]='wrong';files['provenance.json']=hosted.encode(receipt)
            expected={k:self.receipt[k] for k in ('SOURCE_SHA','RUN_ID','RUN_ATTEMPT','REPOSITORY','WORKFLOW_PATH','package_sha256','package_lock_sha256')}
            with self.assertRaises(ValueError):hosted.verify_payload(files,expected)
    def test_zip_unexpected_and_duplicate_paths(self):
        for files in [{**self.files,'../escape':b'x'},{k:v for k,v in self.files.items() if k!='npm-audit-exit'}]:
            with self.assertRaises(ValueError):hosted.unpack(self.zip(files))
        stream=io.BytesIO()
        with zipfile.ZipFile(stream,'w') as archive:
            for name,data in self.files.items():archive.writestr(name,data)
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter('ignore');archive.writestr('npm-audit-exit',b'0')
        with self.assertRaises(ValueError):hosted.unpack(stream.getvalue())
    def test_local_or_missing_canonical_rejected(self):
        self.assertEqual(hosted.load_hosted_report(self.root,self.repo,self.git)['status'],'ERROR')
        bundle=self.retrieve();self.promote(bundle);bundle['origin']='local_scan';(self.root/hosted.CANONICAL[1]).write_bytes(hosted.encode(bundle))
        self.assertEqual(hosted.load_hosted_report(self.root,self.repo,self.git)['status'],'ERROR')
    def test_source_changes_rejected_but_evidence_changes_allowed(self):
        self.promote(self.retrieve())
        def changes(command,**kwargs):
            return SimpleNamespace(returncode=0,stdout='scripts/change.py\n' if 'diff' in command else str(self.root) if '--show-toplevel' in command else '')
        self.assertEqual(hosted.load_hosted_report(self.root,self.repo,changes)['status'],'ERROR')
        def evidence_only(command,**kwargs):
            return SimpleNamespace(returncode=0,stdout=hosted.CANONICAL[0]+'\n' if 'diff' in command else str(self.root) if '--show-toplevel' in command else '')
        self.assertEqual(hosted.load_hosted_report(self.root,self.repo,evidence_only)['status'],'PASS')
    def test_changed_manifest_and_mismatched_report_pair_rejected(self):
        self.promote(self.retrieve());(self.root/'package.json').write_text('{"changed":true}')
        self.assertEqual(hosted.load_hosted_report(self.root,self.repo,self.git)['status'],'ERROR')
        (self.root/'package.json').write_text('{}');(self.root/hosted.CANONICAL[0]).write_text('{}')
        self.assertEqual(hosted.load_hosted_report(self.root,self.repo,self.git)['status'],'ERROR')
    def test_api_cli_uses_official_host_only(self):
        result=SimpleNamespace(returncode=0,stdout=b'{}')
        with patch.object(hosted.subprocess,'run',return_value=result) as run:
            hosted.GitHubAPI().get('repos/example/repo/actions/runs/123')
        self.assertEqual(run.call_args.args[0],['gh','api','--hostname','github.com','repos/example/repo/actions/runs/123'])
    def test_only_verified_generated_outputs_may_be_dirty_not_committed(self):
        self.promote(self.retrieve())
        def dirty(command,**kwargs):
            if command==['git','diff','--name-only','HEAD','--']:
                return SimpleNamespace(returncode=0,stdout='\n'.join(hosted.GENERATED_WATCHDOG))
            return self.git(command,**kwargs)
        self.assertEqual(hosted.load_hosted_report(self.root,self.repo,dirty)['status'],'PASS')
        def committed(command,**kwargs):
            if command==['git','diff','--name-only',self.source,'HEAD','--']:
                return SimpleNamespace(returncode=0,stdout=hosted.GENERATED_WATCHDOG[0])
            return self.git(command,**kwargs)
        self.assertEqual(hosted.load_hosted_report(self.root,self.repo,committed)['status'],'ERROR')
    def test_symlink_paths_and_prewrite_source_race_rejected(self):
        bundle=self.retrieve()
        changed=copy.deepcopy(self.identity);changed['source_sha']='b'*40
        with patch.object(hosted,'identity',return_value=changed):
            with self.assertRaises(ValueError):hosted.promote(self.root,bundle)
        target=self.root/'elsewhere';target.mkdir();(self.root/'state').symlink_to(target)
        with self.assertRaises(ValueError):self.promote(bundle)
        self.assertEqual(hosted.load_hosted_report(self.root,self.repo,self.git)['status'],'ERROR')
    def test_unknown_dirty_state_and_untracked_source_rejected(self):
        self.promote(self.retrieve())
        for mode in ('dirty','untracked'):
            def changed(command,**kwargs):
                if mode=='dirty' and command==['git','diff','--name-only','HEAD','--']:
                    return SimpleNamespace(returncode=0,stdout='state/unreviewed-output.json\n')
                if mode=='untracked' and 'ls-files' in command:
                    return SimpleNamespace(returncode=0,stdout='scripts/unreviewed.py\n')
                return self.git(command,**kwargs)
            with self.subTest(mode=mode):
                self.assertEqual(hosted.load_hosted_report(self.root,self.repo,changed)['status'],'ERROR')
    def test_real_git_canonical_descendant_and_dirty_output_rules(self):
        import subprocess
        def git(*args):
            return subprocess.run(['git','-c','user.name=Synthetic Test','-c','user.email=synthetic@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null',*args],cwd=self.root,capture_output=True,text=True,check=True).stdout.strip()
        git('-c','init.templateDir=','init','-q')
        (self.root/'executable.py').write_text('original\n')
        git('add','.');git('commit','-qm','Synthetic source fixture')
        self.source=git('rev-parse','HEAD');self.identity['source_sha']=self.source
        self.receipt['SOURCE_SHA']=self.source
        self.files['provenance.json']=hosted.encode(self.receipt)
        self.archive=self.zip(self.files)
        self.run['head_sha']=self.source
        self.artifact.update(name=f'runtime-security-audit-{self.source}-123-1',digest='sha256:'+hosted.sha(self.archive),workflow_run={'id':123,'head_sha':self.source})
        # API is synthetic; actual Git inspection/promotion/consumer plumbing runs.
        bundle=hosted.retrieve_verified(self.root,self.source,self.repo,123,self)
        hosted.promote(self.root,bundle)
        self.assertEqual(hosted.load_hosted_report(self.root,self.repo)['status'],'PASS')
        git('add',*hosted.CANONICAL);git('commit','-qm','Synthetic canonical evidence only')
        self.assertEqual(hosted.load_hosted_report(self.root,self.repo)['status'],'PASS')
        generated=self.root/hosted.GENERATED_WATCHDOG[0];generated.write_text('{}')
        self.assertEqual(hosted.load_hosted_report(self.root,self.repo)['status'],'PASS')
        (self.root/'executable.py').write_text('changed\n')
        self.assertEqual(hosted.load_hosted_report(self.root,self.repo)['status'],'ERROR')
        (self.root/'executable.py').write_text('original\n')
        git('add',hosted.GENERATED_WATCHDOG[0]);git('commit','-qm','Synthetic noncanonical committed output')
        self.assertEqual(hosted.load_hosted_report(self.root,self.repo)['status'],'ERROR')
    def test_invalid_artifact_size_refused_before_download(self):
        for size in (None,True,0,-1,hosted.LIMIT+1):
            self.artifact['size_in_bytes']=size;self.calls=[]
            with self.subTest(size=size),self.assertRaises(ValueError):self.retrieve()
            self.assertFalse(any(route.endswith('/zip') for route in self.calls))
    def test_nonpositive_run_attempt_refused(self):
        for attempt in (0,-1):
            self.run['run_attempt']=attempt
            with self.assertRaises(ValueError):self.retrieve()
