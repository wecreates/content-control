import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "episode1_rebuild_render.py"

class Episode1RebuildRenderTests(unittest.TestCase):
    def load_module(self):
        spec = importlib.util.spec_from_file_location("episode1_rebuild_render", SCRIPT)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_has_required_story_sections(self):
        m = self.load_module()
        self.assertGreaterEqual(len(m.SCENES), 20)
        names = {s["id"] for s in m.SCENES}
        for required in {"cold-open","annual-fee","interest-monster","bonus-ladder","zero-trapdoor","cutting-board","next-episode"}:
            self.assertIn(required, names)

    def test_publication_is_hard_disabled(self):
        m = self.load_module()
        self.assertFalse(m.PUBLICATION_ENABLED)

    def test_every_scene_has_motion_and_sound_intent(self):
        m = self.load_module()
        for scene in m.SCENES:
            self.assertTrue(scene.get("motion"))
            self.assertTrue(scene.get("sfx"))
            self.assertGreater(scene["weight"], 0)

if __name__ == "__main__":
    unittest.main()
