import unittest
from scripts.batch9_500_registry import build
class Batch9(unittest.TestCase):
 def test_range_and_lifecycle(self):
  d=build();ids=[x["id"] for x in d["capabilities"]];self.assertEqual(len(ids),500);self.assertEqual(ids,list(range(1001,1501)));self.assertTrue(all(x["state"]=="INSTALLED" for x in d["capabilities"]));self.assertTrue(all(x["evidence_required"] for x in d["capabilities"]));self.assertFalse(d["publication_enabled"])
if __name__=="__main__":unittest.main()
