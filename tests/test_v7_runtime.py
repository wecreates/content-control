import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "v7_runtime.py"

class V7RuntimeContractTests(unittest.TestCase):
    def load_module(self):
        spec = importlib.util.spec_from_file_location("v7_runtime", SCRIPT)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_defines_exactly_200_tasks(self):
        m = self.load_module()
        self.assertEqual(len(m.DOMAINS), 20)
        self.assertEqual(len(m.PHASES), 10)
        self.assertEqual(len(m.DOMAINS) * len(m.PHASES), 200)

    def test_episode1_and_publication_safety_are_hard_requirements(self):
        m = self.load_module()
        self.assertIn("first-watch-lock", m.PHASES)
        self.assertIn("receipt-tamper-rejection", m.PHASES)
        self.assertIn("done-gate", m.PHASES)

    def test_v6_source_summary_is_complete_and_locked(self):
        s = json.load(open(ROOT / "state" / "v6-runtime-summary.json"))
        self.assertTrue(s["all_400_runtime_verified_done"])
        self.assertEqual(s["runtime_verified"], 400)
        self.assertEqual(s["remaining"], 0)
        self.assertFalse(s["publication_enabled"])

if __name__ == "__main__":
    unittest.main()
