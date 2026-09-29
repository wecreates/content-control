import unittest
from scripts.batch10_500_registry import build
class Batch10(unittest.TestCase):
 def test_complete_range(self):
  d=build();ids=[x["id"] for x in d["capabilities"]];self.assertEqual(ids,list(range(1501,2001)));self.assertEqual(len(ids),500);self.assertTrue(all(x["evidence_required"] for x in d["capabilities"]));self.assertTrue(all(x["target_state"]=="RENDER_PROVEN" for x in d["capabilities"]));self.assertFalse(d["publication_enabled"])
if __name__=="__main__":unittest.main()
