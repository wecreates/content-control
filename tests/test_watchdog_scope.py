import unittest
from scripts.watchdog_scope import completion_scope


class WatchdogScopeTests(unittest.TestCase):
    def test_component_success_does_not_approve_system(self):
        result = completion_scope("GREEN")
        self.assertTrue(result["component_checks_passed"])
        self.assertEqual(result["status"], "COMPONENT_CHECKS_PASSED")
        self.assertFalse(result["machine_system_complete"])
        self.assertFalse(result["production_ready"])

    def test_failure_and_unknown_remain_repair_required(self):
        for status in ["RED", "MISSING", None, "COMPLETE"]:
            result = completion_scope(status)
            self.assertEqual(result["status"], "REPAIR_REQUIRED")
            self.assertFalse(result["component_checks_passed"])
            self.assertFalse(result["production_ready"])
