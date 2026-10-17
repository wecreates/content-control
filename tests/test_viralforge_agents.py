import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STUDIO = ROOT / "agentic-studio"
if str(STUDIO) not in sys.path:
    sys.path.insert(0, str(STUDIO))

from agents.gemini_client import build_chain
from agents.researcher import research_topic
from agents.scriptwriter import write_script

class ViralForgeAgentTests(unittest.TestCase):
    def test_current_model_chain_starts_with_38_flash(self):
        chain = build_chain("gemini-3.8-flash")
        self.assertEqual(chain[0], "gemini-3.8-flash")
        self.assertIn("gemini-3.5-flash", chain)

    def test_researcher_is_callable(self):
        self.assertTrue(callable(research_topic))

    def test_scriptwriter_is_callable(self):
        self.assertTrue(callable(write_script))

if __name__ == "__main__":
    unittest.main()
