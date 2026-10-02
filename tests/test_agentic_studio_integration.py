import os
import runpy
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "agentic-studio" / "config.py"

class AgenticStudioIntegrationTests(unittest.TestCase):
    def test_config_exists(self):
        self.assertTrue(CONFIG.exists())

    def test_publication_is_disabled_by_default(self):
        old = os.environ.pop("PUBLICATION_ENABLED", None)
        try:
            cfg = runpy.run_path(str(CONFIG))
            self.assertFalse(cfg["PUBLICATION_ENABLED"])
            self.assertEqual(cfg["VIDEO_PRIVACY"], "private")
        finally:
            if old is not None:
                os.environ["PUBLICATION_ENABLED"] = old

    def test_finance_channel_identity_is_default(self):
        cfg = runpy.run_path(str(CONFIG))
        description = cfg["CHANNEL_DESCRIPTION"].lower()
        self.assertIn("personal-finance", description)
        self.assertIn("credit-card", description)

    def test_no_bundled_youtube_secret_is_required(self):
        cfg = runpy.run_path(str(CONFIG))
        self.assertEqual(cfg["YOUTUBE_CLIENT_SECRET"], "")

def load_tests(loader, tests, pattern):
    suite = unittest.TestSuite()
    suite.addTests(tests)
    from tests.test_viralforge_agents import ViralForgeAgentTests
    from tests.test_viralforge_pipeline import ViralForgePipelineTests
    from tests.test_viralforge_qa_contract import ViralForgeQAContractTests
    for case in (ViralForgeAgentTests, ViralForgePipelineTests, ViralForgeQAContractTests):
        suite.addTests(loader.loadTestsFromTestCase(case))
    return suite

if __name__ == "__main__":
    unittest.main()
