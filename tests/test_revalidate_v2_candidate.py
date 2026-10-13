import json
import tempfile
import unittest
import types
from unittest.mock import patch
from pathlib import Path
from scripts.revalidate_v2_candidate import validate_inputs, digest, revalidate
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
    def test_visual_outcome_never_grants_production_or_full_av_approval(self):
        self.write('state/visual-analysis/frame-review.json',{'candidate':{'sha256':self.hash}})
        for visual_status,expected in [('PASS','VISUAL_REVALIDATED'),('FAIL','BLOCKED'),('BLOCKED','BLOCKED')]:
            module=types.ModuleType('scripts.rendered_visual_parity')
            module.evaluate_visual_review=lambda *args, status=visual_status: {'status':status}
            with patch.dict('sys.modules',{'scripts.rendered_visual_parity':module}):
                result=revalidate(self.root,self.artifact,self.run)
            self.assertEqual(result['status'],expected)
            for flag in ('production_approved','publication_enabled','full_av_review','render_attempted'):
                self.assertIs(result[flag],False)

    def test_reconciled_review_preserves_original_receipts_and_binds_current_review(self):
        path=self.root/'state/v2-production-status.json';report=json.loads(path.read_text())
        self.write('state/visual-analysis/frame-review.json',{'candidate':{'sha256':self.hash},'decision':'FAIL'})
        review_hash=digest(self.root/'state/visual-analysis/frame-review.json')
        evidence={'candidate_sha256':self.hash,'status':'FAIL','visual_review_sha256':review_hash,'publication_enabled':False,'production_approved':False}
        self.write('state/visual-analysis/reconciled-review.json',evidence)
        report['original_build_checks']={'style_parity':dict(report['checks']['style_parity'])}
        report['checks']['style_parity']={'status':'FAIL','receipt_sha256':digest(self.root/'state/visual-analysis/reconciled-review.json')}
        report['review_reconciliation']={'candidate_sha256':self.hash,'review_sha256':review_hash}
        self.write('state/v2-production-status.json',report)
        self.assertEqual(validate_inputs(self.root,self.artifact,self.run)[0],self.hash)
        report['original_build_checks']['style_parity']['receipt_sha256']='0'*64
        self.write('state/v2-production-status.json',report)
        with self.assertRaisesRegex(ValueError,'Original style_parity receipt hash mismatch'):validate_inputs(self.root,self.artifact,self.run)
        report['original_build_checks']['style_parity']['receipt_sha256']=digest(self.artifact/'receipts/visual-parity.json')
        self.write('state/v2-production-status.json',report)
        self.write('state/visual-analysis/frame-review.json',{'decision':'PASS'})
        with self.assertRaisesRegex(ValueError,'Reconciled current review evidence mismatch'):validate_inputs(self.root,self.artifact,self.run)

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
