import json,tempfile,unittest
from pathlib import Path
from scripts.v2_build_status import summarize,should_replace,RECEIPTS
class BuildStatusTests(unittest.TestCase):
 def test_absent_failed_and_invalid_receipts_never_approve(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);r=summarize(root,123,'a'*40,'failure');self.assertFalse(r['candidate_generated']);self.assertEqual(r['status'],'BLOCKED');self.assertFalse(r['production_approved'])
   p=root/RECEIPTS['voices'];p.parent.mkdir(parents=True);p.write_text('[]');self.assertEqual(summarize(root,123,'a'*40,'failure')['checks']['voices']['status'],'INVALID_RECEIPT')
 def test_complete_technical_results_still_require_creative_review(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp)
   for rel in RECEIPTS.values():
    p=root/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps({'status':'PASS','publication_enabled':False}))
   (root/'render').mkdir();(root/'render/v2-boss-fight.mp4').write_bytes(b'identity fixture')
   r=summarize(root,123,'a'*40,'success');self.assertEqual(r['status'],'REVIEW_REQUIRED');self.assertFalse(r['production_approved']);self.assertFalse(r['publication_enabled'])
   p=root/RECEIPTS['voices'];p.write_text(json.dumps({'status':'PASS','publication_enabled':True}));self.assertEqual(summarize(root,123,'a'*40,'success')['checks']['voices']['status'],'BLOCKED')
 def test_optional_failed_diagnostic_is_visible_without_approving_or_overriding_checks(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);p=root/'receipts/clip-transcription.json';p.parent.mkdir()
   p.write_text(json.dumps({'status':'BLOCKED','publication_enabled':False,'reason':'Observed words differ'}))
   r=summarize(root,123,'a'*40,'failure')
   self.assertEqual(r['diagnostics']['caption_windows']['status'],'BLOCKED')
   self.assertEqual(r['diagnostics']['caption_windows']['reason'],'Observed words differ')
   self.assertNotIn('caption_windows',r['checks']);self.assertFalse(r['production_approved'])
 def test_older_build_cannot_replace_newer_report(self):
  self.assertFalse(should_replace({'run_id':201},{'run_id':200}));self.assertTrue(should_replace({'run_id':200},{'run_id':201}))
 def test_invalid_identity_rejected(self):
  with self.assertRaises(ValueError):summarize('.',True,'a'*40,'success')
  with self.assertRaises(ValueError):summarize('.',123,'main','success')
