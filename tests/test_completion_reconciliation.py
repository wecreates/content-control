import json
import tempfile
import unittest
from pathlib import Path
from scripts.reconcile_autonomous_completion import reconcile

class ReconciliationTests(unittest.TestCase):
    def test_generic_pass_cannot_certify_capability(self):
        with tempfile.TemporaryDirectory() as root:
            p=Path(root,'1.json');p.write_text(json.dumps({'capability_id':1,'status':'PASS','publication_enabled':False}))
            report=reconcile({'status':'READY','publication_enabled':False,'tasks':[{'capability_id':1}]},root)
            self.assertEqual(report['proven'],0)
            self.assertEqual(report['status'],'BLOCKED')
            self.assertEqual(report['tasks'][0]['reason'],'capability_specific_verification_required')
            self.assertTrue(p.exists())
    def test_empty_blocked_plan_never_success(self):
        report=reconcile({'status':'BLOCKED','tasks':[],'blocked_capabilities':2500,'publication_enabled':False},'.')
        self.assertEqual(report['status'],'BLOCKED');self.assertEqual(report['blocked_capabilities'],2500)
    def test_mismatched_receipt_and_path_escape_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            Path(root,'1.json').write_text(json.dumps({'capability_id':2,'status':'PASS','publication_enabled':False}))
            report=reconcile({'tasks':[{'capability_id':1},{'capability_id':'../private'}]},root)
            self.assertEqual(report['tasks'][0]['reason'],'receipt_identity_or_policy_mismatch')
            self.assertIsNone(report['tasks'][1]['evidence'])
