import json
import shutil
import tempfile
import unittest
from pathlib import Path
from scripts.verify_deployment_contract import verify

ROOT = Path(__file__).resolve().parents[1]

class DeploymentContractTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for name in ['render.yaml', 'Dockerfile', 'package.json', 'state/deployment-contract.json']:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        contract = json.loads((self.root / 'state/deployment-contract.json').read_text())
        for name in [contract['canonical_server'], contract['canonical_media']]:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.touch()

    def mutate(self, name, old, new):
        target = self.root / name
        target.write_text(target.read_text().replace(old, new))

    def test_current_container_contract(self):
        self.assertEqual(verify(self.root)['status'], 'PASS')

    def test_rollout_health_uses_liveness_not_evidence_readiness(self):
        contract = json.loads((self.root / 'state/deployment-contract.json').read_text())
        manifest = (self.root / 'render.yaml').read_text()
        server = (ROOT / contract['canonical_server']).read_text()
        self.assertEqual(contract['health_check_path'], '/livez')
        self.assertIn('healthCheckPath: /livez', manifest)
        self.assertIn('app.get("/livez"', server)
        self.assertIn('production_approved:false,publication:false', server)

    def test_other_false_flags_cannot_mask_publication_enabled(self):
        self.mutate('render.yaml', 'key: PUBLICATION_ENABLED\n        value: "false"', 'key: PUBLICATION_ENABLED\n        value: "true"')
        self.assertIn('publication_lock', verify(self.root)['failed_checks'])

    def test_wrong_runtime_is_rejected(self):
        self.mutate('render.yaml', 'runtime: docker', 'runtime: node')
        self.assertIn('runtime_matches_contract', verify(self.root)['failed_checks'])

    def test_wrong_container_start_is_rejected(self):
        self.mutate('Dockerfile', 'CMD ["npm", "start"]', 'CMD ["node", "old-server.js"]')
        self.assertIn('start_command', verify(self.root)['failed_checks'])

    def test_paid_plan_is_rejected(self):
        self.mutate('render.yaml', 'plan: free', 'plan: starter')
        self.assertIn('free_plan', verify(self.root)['failed_checks'])
