"""SYNTHETIC offline API evidence, real disposable Git; no hosted scan claim."""
import copy
import io
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile
sys.dont_write_bytecode = True
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import load_live_npm_security_evidence as live
from test_npm_security_audit import fixture, audit


class LiveEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        for name in ('package.json','package-lock.json'):(self.root/name).write_text('{}')
        (self.root/'state').mkdir(); (self.root/'state/runtime-security-audit.json').write_text('{}')
        self.git('init','--quiet');self.git('config','user.name','Synthetic Fixture');self.git('config','user.email','fixture@example.invalid')
        self.git('add','.');self.git('commit','--quiet','-m','Synthetic baseline')
        self.source=self.git('rev-parse','HEAD');self.repo='fixture/repository'
        self.report=audit.normalize(fixture(),0)
        self.receipt=dict(receipt_schema_version=1,origin='github_actions',SOURCE_SHA=self.source,RUN_ID='123',RUN_ATTEMPT='1',REPOSITORY=self.repo,WORKFLOW_PATH=live.WORKFLOW,
            package_sha256=live.sha(b'{}'),package_lock_sha256=live.sha(b'{}'),report_sha256=live.sha(live.encode(self.report)))
        self.files={'npm-audit.json':live.encode(fixture()),'npm-audit-exit':b'0','runtime-security-audit.json':live.encode(self.report),'provenance.json':live.encode(self.receipt)}
        self.run=dict(id=123,run_number=123,status='completed',conclusion='success',head_sha=self.source,path=live.WORKFLOW,repository={'full_name':self.repo},head_repository={'full_name':self.repo},event='push',head_branch='main',run_attempt=1)
        self.listing=[self.run];self.calls=[];self.artifact_changes={};self.raw_archive=None;self.race=None
        self.missing=False;self.malformed=False

    def git(self,*args):return subprocess.check_output(['git',*args],cwd=self.root,text=True).strip()
    def archive(self):
        if self.raw_archive is not None:return self.raw_archive
        stream=io.BytesIO()
        with zipfile.ZipFile(stream,'w') as z:
            for name,data in self.files.items():z.writestr(name,data)
        return stream.getvalue()
    def get(self,route,binary=False):
        self.calls.append(route)
        if '/workflows/' in route:return {'workflow_runs':copy.deepcopy(self.listing)}
        if '/artifacts?' in route:
            if self.malformed:return {'artifacts':[None]}
            data=self.archive()
            artifact=dict(id=456,size_in_bytes=len(data),name=f'runtime-security-audit-{self.source}-123-1',expired=False,workflow_run={'id':123,'head_sha':self.source},digest='sha256:'+live.sha(data))
            artifact.update(self.artifact_changes)
            return {'artifacts':[] if self.missing else [artifact]}
        if route.endswith('/zip'):
            if self.race:self.race()
            return self.archive()
        self.assertTrue(route.endswith('/runs/123'),route)
        return copy.deepcopy(self.run)
    def load(self):return live.load_live_npm_report(self.root,self.repo,self)
    def test_synthetic_success_no_canonical_writes(self):
        self.assertEqual(self.load(),self.report)
        self.assertEqual(self.git('status','--porcelain'),'')
        self.assertEqual((self.root/'state/runtime-security-audit.json').read_text(),'{}')
    def test_bounded_listing_no_evidence_is_error(self):
        for listing in ([],[self.run]*11,[None]):
            self.listing=listing;self.assertEqual(self.load()['status'],'ERROR')
    def test_skip_non_equivalent_source_then_authenticate_match(self):
        self.listing=[dict(self.run,id=999,run_number=124,head_sha='f'*40),self.run]
        self.assertEqual(self.load()['status'],'PASS')
        self.assertFalse(any(x.endswith('/runs/999') for x in self.calls))
    def test_protected_source_change_fails(self):
        (self.root/'package.json').write_text('{"changed":true}')
        self.assertEqual(self.load()['status'],'ERROR')
        self.git('add','.');self.git('commit','--quiet','-m','Synthetic source change')
        self.assertEqual(self.load()['status'],'ERROR')
    def test_allowed_evidence_descendant_passes(self):
        (self.root/'state/free-production-watchdog.json').write_text('{"synthetic":true}')
        self.git('add','.');self.git('commit','--quiet','-m','Synthetic evidence descendant')
        self.assertEqual(self.load()['status'],'PASS')
    def test_no_fallback_after_newer_failure_or_pending(self):
        for status,conclusion in [('completed','failure'),('in_progress',None),('queued',None)]:
            self.run.update(status=status,conclusion=conclusion)
            self.listing=[self.run,dict(self.run,id=122,run_number=122,status='completed',conclusion='success')]
            self.assertEqual(self.load()['status'],'ERROR')
            self.assertFalse(any(x.endswith('/runs/122') for x in self.calls))
    def test_no_fallback_missing_artifact(self):
        self.missing=True;self.listing=[self.run,dict(self.run,id=122,run_number=122)]
        self.assertEqual(self.load()['status'],'ERROR')
        self.assertFalse(any(x.endswith('/runs/122') for x in self.calls))
    def test_wrong_expired_oversize_artifacts(self):
        for changes in ({'expired':True},{'digest':'sha256:'+'0'*64},{'workflow_run':{'id':999,'head_sha':self.source}},{'size_in_bytes':live.LIMIT+1}):
            self.artifact_changes=changes;self.assertEqual(self.load()['status'],'ERROR')
    def test_malformed_artifact_listing_is_error(self):
        self.malformed=True;self.assertEqual(self.load()['status'],'ERROR')
    def test_malformed_zip_is_error_not_exception(self):
        self.raw_archive=b'not a zip';self.assertEqual(self.load()['status'],'ERROR')
    def test_wrong_raw_evidence_never_accepts_normalized_pass(self):
        self.files['npm-audit.json']=b'{}'
        self.assertEqual(self.load()['status'],'ERROR')
    def test_source_race_even_allowed_output_rejected(self):
        self.race=lambda:(self.root/'state/free-production-watchdog.json').write_text('synthetic race')
        self.assertEqual(self.load()['status'],'ERROR')
    def test_forged_local_pass_is_not_fallback(self):
        (self.root/'state/runtime-security-audit.json').write_bytes(live.encode(self.report))
        self.listing=[];self.assertEqual(self.load()['status'],'ERROR')
    def test_out_of_order_listing_cannot_mask_latest_failure(self):
        self.run.update(conclusion='failure')
        self.listing=[dict(self.run,id=122,run_number=122,conclusion='success'),self.run]
        self.assertEqual(self.load()['status'],'ERROR')
        self.assertFalse(any(x.endswith('/runs/122') for x in self.calls))
    def test_run_api_identity_revalidated(self):
        self.listing=copy.deepcopy(self.listing);self.run['head_branch']='feature'
        self.assertEqual(self.load()['status'],'ERROR')

if __name__=='__main__':unittest.main()
