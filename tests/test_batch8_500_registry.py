import unittest
from scripts.batch8_500_registry import build
class Batch8(unittest.TestCase):
 def test_range_and_evidence(self):
  d=build();ids=[x["id"] for x in d["capabilities"]];self.assertEqual(len(ids),500);self.assertEqual(ids[0],501);self.assertEqual(ids[-1],1000);self.assertEqual(len(set(ids)),500);self.assertTrue(all(x["evidence_required"] for x in d["capabilities"]));self.assertTrue(all(x["target_state"]=="RENDER_PROVEN" for x in d["capabilities"]));self.assertFalse(d["publication_enabled"])
if __name__=="__main__":unittest.main()
