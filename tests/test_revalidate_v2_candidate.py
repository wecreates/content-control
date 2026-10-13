import json
import tempfile
import unittest
from pathlib import Path
from scripts.revalidate_v2_candidate import validate_inputs, digest
from scripts.v2_build_status import RECEIPTS


class RevalidationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.artifact=self.root/'artifact'
        self.write('public-review/v2-draft.mp4',b'exact fixture video')
        self.write('artifact/render/v2-boss-fight.mp4',b'exact fixture video')
        self.hash=digest(self.root/'public-review/v2-draft.mp4')
        checks={}
        for name,path in RECEIPTS.items():
            payload={'status':'PASS','candidate_sha256':self.hash,'publication_enabled':False,'checks':{'complete_video_decode':True}}
            self.write('artifact/'+path,payload)
            checks[name]={'receipt_sha256':digest(self.artifact/path)}
        self.run={'id':123,'head_sha':'a'*40,'path':'.github/workflows/content-control-v2.yml','head_branch':'main','status':'completed'}
        base={'run_id':123,'source_commit':'a'*40,'candidate_sha256':self.hash,'publication_enabled':False,'production_approved':False}
        self.write('state/v2-draft.json',dict(base,status='DRAFT'))
        self.write('state/v2-production-status.json',dict(base,checks=checks))
    def tearDown(self):self.temp.cleanup()
    def write(self,path,value):
        p=self.root/path;p.parent.mkdir(parents=True,exist_ok=True)
        p.write_bytes(value if isinstance(value,bytes) else json.dumps(value).encode())
    def test_exact_original_evidence_is_accepted_for_revalidation_only(self):
        self.assertEqual(validate_inputs(self.root,self.artifact,self.run)[0],self.hash)
        self.assertFalse(json.loads((self.root/'state/v2-draft.json').read_text())['production_approved'])
    def test_changed_or_missing_receipt_fails_closed(self):
        p=self.artifact/'receipts/render.json';p.write_text('{}')
        with self.assertRaises(ValueError):validate_inputs(self.root,self.artifact,self.run)
        p.unlink()
        with self.assertRaises(OSError):validate_inputs(self.root,self.artifact,self.run)
    def test_other_run_or_artifact_cannot_reuse_review(self):
        with self.assertRaises(ValueError):validate_inputs(self.root,self.artifact,dict(self.run,id=124))
        with self.assertRaises(ValueError):validate_inputs(self.root,self.artifact,dict(self.run,head_sha='b'*40))
        self.write('artifact/render/v2-boss-fight.mp4',b'other')
        with self.assertRaises(ValueError):validate_inputs(self.root,self.artifact,self.run)
    def test_publication_or_unmatched_report_rejected(self):
        p=self.root/'state/v2-production-status.json';r=json.loads(p.read_text());r['publication_enabled']=True;self.write(str(p.relative_to(self.root)),r)
        with self.assertRaises(ValueError):validate_inputs(self.root,self.artifact,self.run)


if __name__=='__main__':unittest.main()
