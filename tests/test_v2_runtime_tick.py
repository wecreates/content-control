import unittest
from pathlib import Path

class V2RuntimeTickTests(unittest.TestCase):
    def test_runtime_tick_exists_and_is_fail_closed(self):
        p=Path("scripts/v2_runtime_tick.py")
        self.assertTrue(p.exists())
        text=p.read_text()
        self.assertIn("PUBLICATION_ENABLED",text)
        self.assertIn("false",text.lower())
        self.assertIn("subprocess",text)
        self.assertIn("remotion",text)
        self.assertIn("production_reality_media_qa.py",text)
        self.assertIn("rendered_visual_parity.py",text)
        self.assertIn("visual_parity_qa",text)
        self.assertIn("v2-boss-fight.mp4",text)

if __name__=="__main__": unittest.main()
