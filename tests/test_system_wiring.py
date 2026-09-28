import json, tempfile, unittest
from pathlib import Path
from scripts.audit_system_wiring import audit_root

class SystemWiringAuditTests(unittest.TestCase):
    def test_current_repository_contracts_are_connected(self):
        root=Path(__file__).resolve().parents[1]
        report=audit_root(root)
        runtime_only={"latest_candidate_accepted","latest_candidate_live_verified","latest_path_end_to_end"}
        structural_failures=[x for x in report.get("failed_checks",[]) if x not in runtime_only]
        self.assertEqual(structural_failures,[],structural_failures)

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

    def test_detects_missing_latest_candidate_state(self):
        root=Path(__file__).resolve().parents[1]
        report=audit_root(root)
        # Current repository must not claim end-to-end latest-path readiness
        # unless the newest candidate and live receipt actually exist.
        if not (root/"state/episode3-health.json").is_file():
            self.assertIn("latest_candidate_accepted",report["failed_checks"])
        if not (root/"state/episode3-live-health.json").is_file():
            self.assertIn("latest_candidate_live_verified",report["failed_checks"])

if __name__=="__main__":
    unittest.main()
