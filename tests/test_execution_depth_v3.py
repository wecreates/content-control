import unittest
from scripts.execution_depth_v3 import apply
class ExecutionDepth(unittest.TestCase):
 def test_execution_layers(self):
  d={"publication_enabled":False,"scenes":[{"id":"s","start":0,"end":2,"story":{"intent":"reveal"},"camera":{"move":"snap_reveal"},"characters":[{"id":"dave"}],"props":[{"id":"card"}],"environment":{"id":"bank"},"audio":{"dialogue":[{"speaker":"dave","text":"No way"}]}}]}
  o=apply(d);s=o["scenes"][0]
  self.assertTrue(s["characters"][0]["motion_engine"]["ground_solver"]["foot_pin"]);self.assertTrue(s["props"][0]["state_machine"]["hand_solver"]["acquire"]);self.assertEqual(s["shot_tournament"]["variants"],5);self.assertTrue(s["audio"]["stem_engine"]["event_reactive"]);self.assertEqual(s["audio"]["dialogue"][0]["voice_tournament"]["takes"],3);self.assertTrue(o["reference_dna_v4"]["multi_reference"]);self.assertTrue(o["final_tribunal"]["technical_unanimous"]);self.assertFalse(o["publication_enabled"])
if __name__=="__main__":unittest.main()
