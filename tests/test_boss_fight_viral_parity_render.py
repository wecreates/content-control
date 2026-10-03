import unittest
from pathlib import Path

class BossFightViralParityRenderTests(unittest.TestCase):
    def test_dedicated_boss_fight_composition_is_wired(self):
        index=Path("remotion/studio-animatic-index.jsx").read_text()
        self.assertIn("BossFightShort", index)
        self.assertIn("BossFightShortComposition", index)

    def test_boss_fight_has_dense_visual_beats_and_no_debug_footer(self):
        text=Path("remotion/BossFightShortComposition.jsx").read_text()
        self.assertGreaterEqual(text.count("start:"), 16)
        self.assertIn("HealthBar", text)
        self.assertIn("ImpactLines", text)
        self.assertIn("debt_chain", text)
        self.assertIn("NEXT STATEMENT", text)
        self.assertNotIn("story.intent", text)
        self.assertNotIn("camera •", text)

if __name__=="__main__":
    unittest.main()
