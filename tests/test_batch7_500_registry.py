import unittest
from scripts.batch7_500_registry import build
class Batch7(unittest.TestCase):
 def test_exact_registry_and_lock(self):
  d=build();self.assertEqual(d["total"],500);self.assertEqual(len(d["capabilities"]),500);self.assertEqual(len({x["id"] for x in d["capabilities"]}),500);self.assertTrue(all(x["evidence_required"] for x in d["capabilities"]));self.assertTrue(all(x["target_state"]=="RENDER_PROVEN" for x in d["capabilities"]));self.assertFalse(d["publication_enabled"])
if __name__=="__main__":unittest.main()
