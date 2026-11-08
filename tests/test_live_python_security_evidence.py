"""SYNTHETIC offline API scans with real temporary Git. No hosted proof claim."""
import copy
from pathlib import Path
import sys
import unittest
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
import load_live_python_security_evidence as live
import verify_hosted_python_security_evidence as exact
import test_hosted_python_security_evidence as fixtures


class LivePythonTests(unittest.TestCase):
    # Reuse fixture setup/helpers, not its tests, so this suite stays focused.
    setUp = fixtures.HostedPythonTests.setUp
    git = fixtures.HostedPythonTests.git
    refresh_report_receipt = fixtures.HostedPythonTests.refresh_report_receipt
    archive = fixtures.HostedPythonTests.archive

    def get(self, route, binary=False):
        self.calls.append(route)
        if '/workflows/' in route:
            return {'workflow_runs': copy.deepcopy(self.listing)}
        if self.malformed and route.endswith('/zip'):
            return b'not a zip'
        if self.missing and '/artifacts?' in route:
            return {'artifacts': []}
        return fixtures.HostedPythonTests.get(self, route, binary)

    def prepare(self):
        # State directory exists in audited source as it does in real repository.
        (self.root/'state').mkdir()
        (self.root/'state/runtime-security-audit.json').write_text('{}')
        (self.root/'audit-workflow.yml').write_text('synthetic executable input')
        self.git('add', '.');self.git('commit', '--quiet', '-m', 'Synthetic protected inputs')
        self.source,self.manifests=exact.snapshot(self.root)
        self.identity['SOURCE_SHA']=self.source;self.run['head_sha']=self.source
        self.run['run_number']=123;self.refresh_report_receipt()
        self.listing=[self.run];self.calls=[];self.missing=False;self.malformed=False

    def load(self):
        return live.load_live_python_report(self.root, 'fixture/repository', self)

    def test_exact_api_unchanged_and_equivalent_descendant(self):
        self.prepare()
        self.assertEqual(exact.retrieve_verified(self.root,self.source,'fixture/repository',123,self)['report']['status'],'PASS')
        (self.root/'state/free-production-watchdog.json').write_text('{"synthetic":true}')
        self.git('add','.');self.git('commit','--quiet','-m','Synthetic generated descendant')
        with self.assertRaises(ValueError):exact.retrieve_verified(self.root,self.source,'fixture/repository',123,self)
        self.assertEqual(self.load()['status'],'PASS')
        self.assertEqual(self.git('status','--porcelain'),'')

    def test_changed_manifest_or_workflow_rejected(self):
        self.prepare()
        for name in ('requirements-transcription.txt','audit-workflow.yml'):
            p=self.root/name;before=p.read_bytes();p.write_text('synthetic change')
            self.assertEqual(self.load()['status'],'ERROR');p.write_bytes(before)
        (self.root/'audit-workflow.yml').write_text('committed change')
        self.git('add','.');self.git('commit','--quiet','-m','Synthetic code change')
        self.assertEqual(self.load()['status'],'ERROR')

    def test_latest_failed_pending_or_missing_never_falls_back(self):
        self.prepare()
        older=dict(self.run,id=122,run_number=122)
        for status,conclusion in [('completed','failure'),('in_progress',None),('queued',None)]:
            self.run.update(status=status,conclusion=conclusion)
            self.listing=[older,self.run]
            self.assertEqual(self.load()['status'],'ERROR')
        self.run.update(status='completed',conclusion='success');self.missing=True
        self.assertEqual(self.load()['status'],'ERROR')
        self.assertFalse(any(x.endswith('/runs/122') for x in self.calls))

    def test_malformed_zip_and_expired_artifact_fail_closed(self):
        self.prepare()
        # Genuine server digest can authenticate malformed archive bytes too;
        # validation must reject ZIP structure after matching that digest.
        self.malformed=True
        self.artifact_overrides={'digest':'sha256:'+exact.sha(b'not a zip')}
        self.assertEqual(self.load()['status'],'ERROR')
        self.malformed=False;self.artifact_overrides={'expired':True}
        self.assertEqual(self.load()['status'],'ERROR')

    def test_source_race_and_forged_local_pass_rejected(self):
        self.prepare()
        self.run_mutation=lambda:(self.root/'state/free-production-watchdog.json').write_text('synthetic race')
        self.assertEqual(self.load()['status'],'ERROR')
        self.listing=[]
        (self.root/'state/python-security-audit.json').write_text('{"status":"PASS","total_vulnerabilities":0}')
        self.assertEqual(self.load()['status'],'ERROR')

    def test_skip_non_equivalent_source_but_bound_selection(self):
        self.prepare()
        self.listing=[dict(self.run,id=999,run_number=124,head_sha='f'*40),self.run]
        self.assertEqual(self.load()['status'],'PASS')
        self.assertFalse(any(x.endswith('/runs/999') for x in self.calls))
        self.listing=[self.run]*11
        self.assertEqual(self.load()['status'],'ERROR')


if __name__=='__main__':unittest.main()
