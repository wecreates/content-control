import unittest
from scripts.studio_intelligence_v2 import apply
class V2(unittest.TestCase):
 def test_all_major_layers(self):
  d={"publication_enabled":False,"scenes":[{"id":"s","start":0,"end":2,"story":{"intent":"pressure","setup":"card"},"camera":{"move":"guided_track"},"characters":[{"id":"dave"}],"props":[{"id":"card"}],"environment":{"id":"bank"},"audio":{"dialogue":[{"speaker":"dave","text":"This fee is bad"}]},"fx":[],"text":{"content":"FEE"}}]}
  o=apply(d);s=o["scenes"][0]
  self.assertIn("attention_model",s);self.assertIn("acting_memory",s["characters"][0]);self.assertIn("state_machine",s["props"][0]);self.assertIn("set_memory",s["environment"]);self.assertEqual(len(s["shot_candidates"]),4);self.assertIn("music_architecture",s["audio"]);self.assertIn("take_search",s["audio"]["dialogue"][0]);self.assertIn("macro_retention",o);self.assertFalse(o["publication_enabled"])
if __name__=="__main__":unittest.main()
