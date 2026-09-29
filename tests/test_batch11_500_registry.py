import unittest
from scripts.batch11_500_registry import build
class Batch11(unittest.TestCase):
 def test_complete_endpoint(self):
  d=build();ids=[x["id"] for x in d["capabilities"]];self.assertEqual(ids,list(range(2001,2501)));self.assertEqual(len(ids),500);self.assertEqual(d["endpoint_assertion"],2500);self.assertEqual(ids[-1],2500);self.assertTrue(all(x["evidence_required"] for x in d["capabilities"]));self.assertFalse(d["publication_enabled"])
if __name__=="__main__":unittest.main()
