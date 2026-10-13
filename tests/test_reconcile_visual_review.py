import copy,hashlib,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from scripts.reconcile_visual_review import reconcile
class ReconcileTests(unittest.TestCase):
 def test_bound_failure_updates_only_visual_check_and_preserves_build(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);v=root/'video';v.write_bytes(b'actual fixture bytes');h=hashlib.sha256(v.read_bytes()).hexdigest()
   def save(n,x):p=root/n;p.write_text(json.dumps(x));return p
   tech=save('technical',{'candidate_sha256':h,'status':'PASS','checks':{'decodes':True},'publication_enabled':False})
   checks={'technical_video':{'status':'PASS','receipt_sha256':hashlib.sha256(tech.read_bytes()).hexdigest()},'voices':{'status':'PASS'},'style_parity':{'status':'BLOCKED'}}
   original={'run_id':123,'source_commit':'a'*40,'workflow_outcome':'failure','candidate_sha256':h,'checks':checks,'production_approved':False,'publication_enabled':False}
   report=save('report',original);draft=save('draft',{'run_id':123,'candidate_sha256':h,'production_approved':False,'publication_enabled':False});review=save('review',{})
   args=(v,root,review,report,draft,tech,456,'b'*40)
   with patch('scripts.reconcile_visual_review.evaluate_visual_review',return_value={'status':'FAIL','reason':'Observed typography mismatch'}):
    out,payload=reconcile(*args)
   self.assertEqual(out['checks']['style_parity']['status'],'FAIL');self.assertEqual(out['run_id'],123)
   self.assertEqual(out['original_build_checks']['style_parity'],checks['style_parity'])
   self.assertEqual(out['checks']['technical_video'],checks['technical_video']);self.assertEqual(out['checks']['voices'],checks['voices'])
   self.assertFalse(out['production_approved']);self.assertEqual(out['status'],'BLOCKED');self.assertEqual(out['remaining_review']['full_audiovisual'],'NOT_APPROVED')
   self.assertEqual(out['checks']['style_parity']['receipt_sha256'],hashlib.sha256(payload).hexdigest())
   for change in ('candidate','receipt','run'):
    changed=copy.deepcopy(original)
    if change=='candidate':changed['candidate_sha256']='0'*64
    if change=='receipt':changed['checks']['technical_video']['receipt_sha256']='0'*64
    if change=='run':changed['run_id']=124
    report.write_text(json.dumps(changed))
    with self.subTest(change=change),self.assertRaises(ValueError):reconcile(*args)
