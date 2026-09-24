import json, pathlib, unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]

class Episode1V4Tests(unittest.TestCase):
    def test_v4_spec_has_multiple_entertainment_engines(self):
        d=json.loads((ROOT/"production/episode1/rebuild-v4/creative-spec.json").read_text())
        self.assertFalse(d["publication_enabled"])
        self.assertFalse(d["slideshow"])
        self.assertFalse(d["lecture"])
        self.assertTrue(d["continuous_motion"])
        self.assertGreaterEqual(len(d["entertainment_engines"]),8)
        self.assertLessEqual(d["meaningful_visual_change_sec"],2.0)
        self.assertLessEqual(d["max_static_hold_sec"],2.2)
        self.assertGreaterEqual(d["visual_jokes"],12)
        self.assertGreaterEqual(d["callbacks"],4)
        self.assertGreaterEqual(d["physical_action_ratio"],0.70)

    def test_component_declares_all_engine_sections(self):
        src=(ROOT/"remotion/Episode1V4.jsx").read_text()
        for name in [
            "ColdOpenFeeCrash","RewardsArcade","CreditCardChase","CardGameShow",
            "InterestBossBattle","BonusHeist","ZeroAprGameShow","FinaleCallback"
        ]:
            self.assertIn(name,src)
        self.assertIn('episode1-rebuild-voice.mp3',src)
        self.assertNotIn("PowerPoint",src)

if __name__=="__main__":
    unittest.main()
