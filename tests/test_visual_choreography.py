import unittest
from scripts.visual_choreography import build_choreography
from scripts.choreography_qa import validate_choreography

class VisualChoreographyTests(unittest.TestCase):
    def setUp(self):
        self.scene={
          "id":"scene-001","start":0.0,"end":2.0,
          "story":{"beat":"annual fee reveal","purpose":"consequence"},
          "camera":{"shot_scale":"medium","move":"tracking"},
          "characters":[{"id":"dave","pose":"recoil","emotion":"shock"}],
          "environment":{"id":"white_stage"},
          "props":[{"id":"card","state":"active"},{"id":"fee_meter","state":"active"}],
          "lighting":{},"audio":{"dialogue":[],"sfx":[],"music":{}},
          "text":{"zone":"upper_third","content":"$695 FEE"},"fx":[],"continuity":{}
        }

    def test_builds_all_choreography_layers(self):
        c=build_choreography(self.scene)
        for key in [
          "object_actions","character_actions","text_actions","overlays",
          "camera_events","transition_in","transition_out","contact_events",
          "physics","animation_curves","visual_gags","depth_layers","visual_metaphor"
        ]:
            self.assertIn(key,c)

    def test_finance_concept_becomes_physical_metaphor(self):
        c=build_choreography(self.scene)
        self.assertIn(c["visual_metaphor"]["type"],{"toll_gate","weight_drop","pressure_meter","cash_leak"})

    def test_text_is_kinetic_not_static_caption(self):
        c=build_choreography(self.scene)
        self.assertGreaterEqual(len(c["text_actions"]),1)
        self.assertNotEqual(c["text_actions"][0]["motion"],"static")

    def test_props_get_physics_and_entry_action(self):
        c=build_choreography(self.scene)
        ids={x["target"] for x in c["object_actions"]}
        self.assertIn("card",ids)
        self.assertTrue(c["physics"]["enabled"])

    def test_qa_rejects_static_scene(self):
        bad={"object_actions":[],"character_actions":[],"text_actions":[],"overlays":[],"camera_events":[],"contact_events":[],"visual_gags":[],"transition_in":{"type":"cut"},"transition_out":{"type":"cut"},"physics":{"enabled":False},"depth_layers":[]}
        r=validate_choreography(bad,2.0)
        self.assertIn("meaningful_motion",r["failed_checks"])
        self.assertIn("state_change_density",r["failed_checks"])

if __name__=="__main__":
    unittest.main()
