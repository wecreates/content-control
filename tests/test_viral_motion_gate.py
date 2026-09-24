import json, pathlib, tempfile, unittest
from scripts.viral_motion_gate import evaluate_spec

ROOT=pathlib.Path(__file__).resolve().parents[1]

class ViralMotionGateTests(unittest.TestCase):
    def test_rejects_slideshow_short(self):
        spec={
          "format":"short","aspect":"9:16","duration_sec":45,
          "hook_sec":0.8,"promise_sec":3.0,"meaningful_visual_change_sec":1.4,
          "max_static_hold_sec":1.5,"retention_reset_sec":8,
          "continuous_motion":False,"slideshow":True,"lecture":False,
          "physical_action_ratio":0.75,"visual_jokes":4,"callbacks":2,
          "sound_sync":True,"loop_end":True,"publication_enabled":False
        }
        result=evaluate_spec(spec)
        self.assertFalse(result["pass"])
        self.assertIn("slideshow",result["hard_failures"])

    def test_rejects_lecture_long_form(self):
        spec={
          "format":"long","aspect":"16:9","duration_sec":480,
          "hook_sec":2.0,"promise_sec":11.0,"meaningful_visual_change_sec":1.9,
          "max_static_hold_sec":2.1,"retention_reset_sec":20,
          "continuous_motion":True,"slideshow":False,"lecture":True,
          "physical_action_ratio":0.7,"visual_jokes":18,"callbacks":4,
          "sound_sync":True,"loop_end":False,"publication_enabled":False
        }
        result=evaluate_spec(spec)
        self.assertFalse(result["pass"])
        self.assertIn("lecture",result["hard_failures"])

    def test_accepts_strong_short_motion_contract(self):
        spec={
          "format":"short","aspect":"9:16","duration_sec":42,
          "hook_sec":0.6,"promise_sec":2.5,"meaningful_visual_change_sec":1.2,
          "max_static_hold_sec":1.3,"retention_reset_sec":7,
          "continuous_motion":True,"slideshow":False,"lecture":False,
          "physical_action_ratio":0.82,"visual_jokes":6,"callbacks":2,
          "sound_sync":True,"loop_end":True,"publication_enabled":False
        }
        result=evaluate_spec(spec)
        self.assertTrue(result["pass"])
        self.assertEqual(result["hard_failures"],[])

    def test_accepts_strong_long_motion_contract(self):
        spec={
          "format":"long","aspect":"16:9","duration_sec":430,
          "hook_sec":1.8,"promise_sec":10.0,"meaningful_visual_change_sec":1.7,
          "max_static_hold_sec":2.0,"retention_reset_sec":22,
          "continuous_motion":True,"slideshow":False,"lecture":False,
          "physical_action_ratio":0.68,"visual_jokes":16,"callbacks":4,
          "sound_sync":True,"loop_end":False,"publication_enabled":False
        }
        result=evaluate_spec(spec)
        self.assertTrue(result["pass"])

if __name__=="__main__":
    unittest.main()
