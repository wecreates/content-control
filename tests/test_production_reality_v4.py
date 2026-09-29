import unittest
from scripts.production_reality_v4 import apply
class RealityV4(unittest.TestCase):
 def test_contracts(self):
  d={"publication_enabled":False,"scenes":[{"id":"s","start":0,"end":2,"characters":[{"id":"dave"}],"props":[{"id":"card"}],"audio":{"dialogue":[{"speaker":"dave","text":"hello"}]}}]}
  o=apply(d);s=o["scenes"][0]
  self.assertTrue(s["characters"][0]["motion_engine"]["render_contract"]["ground_ik"]);self.assertTrue(s["cinema_v4"]["world_camera"]);self.assertTrue(s["audio"]["production_v4"]["music_stems"]);self.assertEqual(s["render_tournament_v4"]["variants"],5);self.assertTrue(s["media_qa_v4"]["mouth_sync"]);self.assertTrue(s["render_infra_v4"]["content_addressed_cache"]);self.assertTrue(s["learning_v4"]["approved_shot_retrieval"]);self.assertTrue(o["production_reality_v4"]["installed"]);self.assertFalse(o["publication_enabled"])
if __name__=="__main__":unittest.main()
