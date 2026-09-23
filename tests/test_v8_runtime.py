import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "v8_runtime.py"

class V8RuntimeContractTests(unittest.TestCase):
    def load_module(self):
        spec = importlib.util.spec_from_file_location("v8_runtime", SCRIPT)
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

    def test_resilience_and_release_safety_are_mandatory(self):
        m = self.load_module()
        required = {"dependency-break-test","receipt-chain-audit","publication-kill-switch","recovery-replay","done-gate"}
        self.assertTrue(required.issubset(set(m.PHASES)))

    def test_v7_source_is_complete_and_publication_locked(self):
        s = json.load(open(ROOT / "state" / "v7-runtime-summary.json"))
        self.assertTrue(s["all_200_runtime_verified_done"])
        self.assertEqual(s["runtime_verified"], 200)
        self.assertEqual(s["remaining"], 0)
        self.assertFalse(s["publication_enabled"])

if __name__ == "__main__":
    unittest.main()
