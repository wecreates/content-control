import json, tempfile, unittest
from pathlib import Path
from scripts.audit_system_wiring import audit_root, _paid_boundary_locked, _review_server_status_safe

class SystemWiringAuditTests(unittest.TestCase):
    def test_episode3_caption_link_requires_the_accepted_caption_hash(self):
        server=(Path(__file__).resolve().parents[1]/'server-lowmem.js').read_text()
        bound='src="/episode3/captions?sha256=\'+a.captionHash+\'"'
        self.assertIn(bound,server)
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            target=root/'server-lowmem.js'
            target.write_text(server)
            self.assertTrue(audit_root(root)['checks']['episode3_hash_bound_captions'])
            for replacement in ['src="/episode3/captions"', 'src="/episode3/captions?sha256=\'+a.expected+\'"', 'src="/unrelated/captions"']:
                with self.subTest(link=replacement):
                    target.write_text(server.replace(bound,replacement))
                    self.assertFalse(audit_root(root)['checks']['episode3_hash_bound_captions'])

    def test_extracted_validation_status_wiring_remains_guarded(self):
        repository=Path(__file__).resolve().parents[1]
        server=(repository/'server-lowmem.js').read_text()
        helper=(repository/'validation-process.js').read_text()
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            target=root/'validation-process.js'
            target.write_text(helper)
            self.assertTrue(_review_server_status_safe(root,server))
            self.assertFalse(_review_server_status_safe(root,server.replace('./validation-process.js','./unrelated.js')))
            self.assertFalse(_review_server_status_safe(root,server.replace('renderState=validationProcess.state','renderState={}')))
            for before,after in [("child.once('error',", "child.once('ignored',"), ("PUBLICATION_ENABLED:'false'", "PUBLICATION_ENABLED:'true'"), ('state.logs.length-40','state.logs.length-40000'), ("child.kill('SIGKILL')",'void 0')]:
                with self.subTest(guard=before):
                    target.write_text(helper.replace(before,after))
                    self.assertFalse(_review_server_status_safe(root,server))
            target.unlink()
            self.assertFalse(_review_server_status_safe(root,server))

    def test_paid_guard_must_precede_all_work(self):
        with tempfile.TemporaryDirectory() as td:
            source=Path(td)/"provider.py"
            source.write_text('def request_audio():\n    network_call()\n    raise RuntimeError("paid_voice_provider_disabled")\n')
            self.assertFalse(_paid_boundary_locked(source,"request_audio"))
            source.write_text('def request_audio():\n    raise RuntimeError("paid_voice_provider_disabled")\n    network_call()\n')
            self.assertTrue(_paid_boundary_locked(source,"request_audio"))

    def test_unregistered_automatic_workflow_remains_denied(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td)
            workflows=root/".github/workflows"
            workflows.mkdir(parents=True)
            (workflows/"unexpected.yml").write_text("name: Unexpected\non:\n  push:\n    branches: [main]\n")
            report=audit_root(root)
            self.assertIn("workflow_registry_covers_automatic", report["failed_checks"])
            self.assertIn({"path":".github/workflows/unexpected.yml", "reason":"automatic_not_registered"}, report["details"]["workflow_violations"])

    def test_audit_workflow_regenerates_receipts_after_test_failure(self):
        workflow=(Path(__file__).resolve().parents[1]/".github/workflows/system-wiring-audit.yml").read_text()
        for step_id in ["audit", "workflow_control"]:
            self.assertIn(f"id: {step_id}\n        if: always()", workflow)
        self.assertIn('os.environ.get("WIRING_AUDIT_OUTCOME") != "success"', workflow)
        self.assertIn('os.environ.get("WORKFLOW_CONTROL_OUTCOME") != "success"', workflow)

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
