import json, pathlib, unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

class Episode1MotionGraphicTests(unittest.TestCase):
    def test_motion_design_is_continuous_not_slideshow(self):
        p = ROOT / "production/episode1/rebuild-v3/motion-design.json"
        d = json.load(open(p))
        self.assertEqual(d["format"], "continuous-motion-graphic")
        self.assertFalse(d["uses_fullscreen_slide_cards"])
        self.assertTrue(d["persistent_world"])
        self.assertTrue(d["continuous_camera"])
        self.assertGreaterEqual(d["beats_per_minute_visual"], 24)

    def test_remotion_source_has_camera_and_character_motion(self):
        src = (ROOT / "remotion/Episode1Motion.jsx").read_text()
        self.assertIn("CameraRig", src)
        self.assertIn("Alex", src)
        self.assertIn("InterestMonster", src)
        self.assertIn("spring(", src)
        self.assertNotIn("SlideDeck", src)

    def test_publication_stays_disabled(self):
        d = json.load(open(ROOT / "production/episode1/rebuild-v3/motion-design.json"))
        self.assertFalse(d["publication_enabled"])

if __name__ == "__main__":
    unittest.main()
