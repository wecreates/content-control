import hashlib,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from scripts.repository_v2_handoff import prepare
class HandoffTests(unittest.TestCase):
 def test_existing_build_binding_rejects_wrong_media_or_receipt(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'state').mkdir();(root/'public-review').mkdir();a=root/'artifact';(a/'render').mkdir(parents=True);(a/'receipts').mkdir()
   media=b'fixture media';digest=hashlib.sha256(media).hexdigest()
   (root/'public-review/v2-draft.mp4').write_bytes(media);(a/'render/v2-boss-fight.mp4').write_bytes(media)
   tech={'candidate_sha256':digest};(a/'receipts/render.json').write_text(json.dumps(tech));technical_hash=hashlib.sha256((a/'receipts/render.json').read_bytes()).hexdigest()
   report={'run_id':123,'source_commit':'a'*40,'candidate_sha256':digest,'publication_enabled':False,'production_approved':False,'checks':{'technical_video':{'receipt_sha256':technical_hash}}}
   for name in ('v2-production-status.json','v2-draft.json'):(root/'state'/name).write_text(json.dumps(report))
   (a/'ccsd.json').write_text(json.dumps({'project_id':'fixture','publication_enabled':False,'scenes':[{'audio':{'dialogue':[{'text':'Actual dialogue'}]}}]}))
   metadata={'title':'Fixture','description':'Public draft','tags':[],'publication_enabled':False}
   with patch('scripts.repository_v2_handoff.git',return_value=json.dumps(metadata)):
    result=prepare(root,a,root/'out');self.assertEqual(result['candidate_sha256'],digest)
    self.assertEqual(json.loads((root/'out/audit-input.json').read_text())['transcript'],'Actual dialogue');self.assertFalse(result['production_approved'])
    (a/'render/v2-boss-fight.mp4').write_bytes(b'wrong')
    with self.assertRaisesRegex(ValueError,'not current video'):prepare(root,a,root/'bad')
    (a/'render/v2-boss-fight.mp4').write_bytes(media);(a/'receipts/render.json').write_text('{}')
    with self.assertRaisesRegex(ValueError,'receipt mismatch'):prepare(root,a,root/'bad')
