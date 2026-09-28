import unittest
from scripts.story_room_v2 import build_room
from scripts.production_scheduler import schedule
from scripts.typography_director import direct_text
from scripts.taste_director import score_taste
from scripts.analytics_learning_v2 import learn
from scripts.reference_motion_v2 import summarize_motion

class QualityDepthTests(unittest.TestCase):
    def test_story_room_has_distinct_arcs_and_callbacks(self):
        r=build_room("annual fee",12)
        self.assertGreaterEqual(len(r["pitches"]),10)
        self.assertGreaterEqual(len({p["arc"] for p in r["pitches"]}),5)
        self.assertTrue(any(p["callbacks"] for p in r["pitches"]))

    def test_scheduler_respects_dependencies(self):
        ccsd={"scenes":[{"id":"s1"},{"id":"s2"}]}
        r=schedule(ccsd)
        self.assertIn("rig",r["shots"][0]["dependencies"])
        self.assertIn("dialogue_timing",r["shots"][0]["dependencies"])

    def test_typography_director_limits_lines_and_scales(self):
        r=direct_text("$695 annual fee is not free money",720,1280)
        self.assertLessEqual(r["line_count"],3)
        self.assertGreaterEqual(r["font_size"],28)

    def test_taste_director_rejects_repetitive_video(self):
        features={"shot_scale_diversity":1,"transition_diversity":1,"static_fraction":.7,"composition_repeat":.8,"joke_density":.1,"visual_metaphor_density":.1}
        r=score_taste(features)
        self.assertEqual(r["status"],"REJECT")

    def test_analytics_learning_extracts_feature_rules(self):
        ccsd={"scenes":[{"id":"s1","start":0,"end":5,"camera":{"move":"punch_in","shot_scale":"close"},"characters":[{"id":"dave"}],"choreography":{"text_actions":[],"visual_gags":[{}],"object_actions":[{}]},"story":{"beat":"hook"}}]}
        a={"retention_points":[{"time":2,"retention":.4}]}
        r=learn(ccsd,a)
        self.assertEqual(r["examples"][0]["scene_id"],"s1")
        self.assertIn("camera_move",r["examples"][0]["features"])

    def test_motion_summary_reports_camera_and_activity(self):
        r=summarize_motion([{"time":.5,"activity":.02},{"time":1.0,"activity":.1},{"time":1.5,"activity":.04}])
        self.assertGreater(r["peak_activity"],r["mean_activity"])

if __name__=="__main__":
    unittest.main()
