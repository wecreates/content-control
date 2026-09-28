import json, tempfile, unittest
from pathlib import Path
from scripts.audit_system_wiring import audit_root

class SystemWiringAuditTests(unittest.TestCase):
    def test_current_repository_contracts_are_connected(self):
        root=Path(__file__).resolve().parents[1]
        report=audit_root(root)
        self.assertEqual(report["status"],"PASS",report.get("failed_checks"))

    def test_detects_missing_character_renderer(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td)
            (root/"control").mkdir()
            (root/"remotion").mkdir()
            (root/".github/workflows").mkdir(parents=True)
            (root/"state").mkdir()
            (root/"control/agent-swarm.json").write_text(json.dumps({"agents":[],"creative_contracts":{"reusable_character_renderer":"remotion/CharacterSystem.jsx"},"publication_enabled":False}))
            (root/"state/canonical-workflow-registry.json").write_text(json.dumps({"allowed_automatic":[],"manual_only":[],"publication_enabled":False,"canonical_generation_workflow":".github/workflows/free-vision-qa.yml"}))
            report=audit_root(root)
            self.assertIn("creative_contract_paths_exist",report["failed_checks"])

if __name__=="__main__":
    unittest.main()
