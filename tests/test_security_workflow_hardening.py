"""Offline structural and SHA-guard tests; do not dispatch workflows."""
import pathlib
import subprocess
import unittest
import tempfile
import os
import json
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
TEXT = (ROOT / '.github/workflows/python-security-audit.yml').read_text()
DOC = yaml.load(TEXT, Loader=yaml.BaseLoader)

class HardeningTests(unittest.TestCase):
    def test_read_only_permissions(self):
        self.assertEqual(DOC['permissions'], {'contents': 'read'})
        for job in DOC['jobs'].values():
            self.assertEqual(job['permissions'], {'contents': 'read'})
    def test_no_repository_persistence(self):
        for forbidden in ('git push', 'git commit', 'git pull', 'contents: write', 'Persist Python security evidence'):
            self.assertNotIn(forbidden, TEXT)
    def test_checkout_is_exact_and_does_not_persist_credentials(self):
        for job in DOC['jobs'].values():
            step = next(s for s in job['steps'] if s.get('uses', '').startswith('actions/checkout@'))
            self.assertEqual(step['with'], {'ref': '${{ github.sha }}', 'persist-credentials': 'false'})
    def test_both_manual_guards_fail_closed(self):
        for job in DOC['jobs'].values():
            guard = job['steps'][0]
            self.assertIn('EXPECTED_SHA', guard['env'])
            for supplied, actual, passes in [('a'*40, 'a'*40, True), ('b'*40, 'a'*40, False), ('', 'a'*40, False), ('a'*39, 'a'*40, False), ('a'*40+'; echo x', 'a'*40, False)]:
                result = subprocess.run(['bash', '-c', guard['run']], env={'EXPECTED_SHA': supplied, 'GITHUB_SHA': actual}, capture_output=True)
                self.assertEqual(result.returncode == 0, passes)
        self.assertEqual(DOC['jobs']['audit']['steps'][0]['if'], "github.event_name == 'workflow_dispatch'")
    def test_scanning_triggers_preserved(self):
        self.assertEqual(DOC['on']['push']['branches'], ['main'])
        self.assertEqual(DOC['on']['schedule'], [{'cron': '13 11 * * 2'}])
        for path in ['requirements-free-qa.lock.txt', 'requirements-transcription.txt', 'requirements-pod-runtime.txt']:
            self.assertIn(path, DOC['on']['push']['paths'])
            self.assertIn('pip-audit -r '+path, TEXT)
    def test_job_routing_preserves_manual_guard_and_allows_pr_scan(self):
        self.assertEqual(DOC['jobs']['validation']['if'], "github.event_name == 'workflow_dispatch' && inputs.validation_only")
        self.assertEqual(DOC['jobs']['audit']['if'], "(github.event_name == 'pull_request' || github.ref == 'refs/heads/main') && !(github.event_name == 'workflow_dispatch' && inputs.validation_only)")
    def test_artifact_provenance(self):
        steps = DOC['jobs']['audit']['steps']
        provenance = next(s for s in steps if s.get('name') == 'Bind evidence to this run')
        self.assertEqual(provenance['if'], "always() && steps.evidence.outcome == 'success'")
        self.assertEqual(provenance['env']['SOURCE_SHA'], '${{ github.sha }}')
        self.assertIn('RUN_ATTEMPT', provenance['env'])
        upload = steps[-1]
        self.assertEqual(upload['if'], "always() && steps.receipt.outcome == 'success'")
        self.assertEqual(upload['with']['if-no-files-found'], 'error')
        self.assertEqual('${{ steps.evidence.outputs.directory }}/', upload['with']['path'])
        self.assertIn('${{ github.run_id }}', upload['with']['name'])
    def test_normalization_remains_fail_closed(self):
        step = next(s for s in DOC['jobs']['audit']['steps'] if s.get('name') == 'Normalize Python security report')
        self.assertNotIn('continue-on-error', step)
        self.assertEqual(step['if'], "always() && steps.evidence.outcome == 'success'")

    def test_ci_wiring_and_dependency_pin(self):
        self.assertIn('tests/test_security_workflow_hardening.py', DOC['on']['push']['paths'])
        for job in DOC['jobs'].values():
            commands = '\n'.join(step.get('run', '') for step in job['steps'])
            self.assertIn('--no-deps', commands)
            self.assertIn('PyYAML==6.0.3', commands)
            self.assertIn('python -m unittest discover -s tests -p test_security_workflow_hardening.py -v', commands)

    def test_stale_tracked_pass_cannot_be_rebound(self):
        receipt = next(s for s in DOC['jobs']['audit']['steps'] if s.get('id') == 'receipt')
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root / 'state').mkdir()
            (root / 'state/python-security-audit.json').write_text('{"status":"PASS"}')
            (root / 'scripts').mkdir()
            for name in ('verify_hosted_python_security_evidence.py', 'normalize_python_security_audit.py',
                         'npm_security_source_equivalence.py'):
                (root / 'scripts' / name).write_bytes((ROOT / 'scripts' / name).read_bytes())
            fresh = root / 'fresh'; fresh.mkdir()
            env = {**os.environ, 'REPOSITORY': 'synthetic/fixture', 'EVIDENCE_DIR': str(fresh), 'SOURCE_SHA': 'a'*40, 'SOURCE_REF': 'refs/heads/main', 'RUN_ID': '1', 'RUN_ATTEMPT': '1'}
            result = subprocess.run(['bash', '-c', receipt['run']], cwd=root, env=env, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((fresh / 'python-security-audit-provenance.json').exists())
    def test_fresh_error_report_is_preserved(self):
        receipt = next(s for s in DOC['jobs']['audit']['steps'] if s.get('id') == 'receipt')
        with tempfile.TemporaryDirectory() as tmp:
            fresh = pathlib.Path(tmp)
            (fresh / 'python-security-audit.json').write_text('{"status":"ERROR"}')
            env = {**os.environ, 'REPOSITORY': 'synthetic/fixture', 'EVIDENCE_DIR': str(fresh), 'SOURCE_SHA': 'a'*40, 'SOURCE_REF': 'refs/heads/main', 'RUN_ID': '1', 'RUN_ATTEMPT': '1'}
            result = subprocess.run(['bash', '-c', receipt['run']], cwd=ROOT, env=env, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            data = json.loads((fresh / 'python-security-audit-provenance.json').read_text())
            self.assertEqual(data['SOURCE_SHA'], 'a'*40)
            self.assertIn('qa-audit.json', data['missing_files'])

    def test_pr_scans_are_readonly_scoped_and_not_main_evidence(self):
        for name in ('runtime-security-audit.yml', 'python-security-audit.yml'):
            text = (ROOT/'.github/workflows'/name).read_text()
            doc = yaml.load(text, Loader=yaml.BaseLoader)
            self.assertEqual(doc['on']['pull_request'], doc['on']['push'])
            self.assertEqual(doc['on']['pull_request']['branches'], ['main'])
            self.assertEqual(doc['permissions'], {'contents': 'read'})
            for forbidden in ('pull_request_target', 'secrets.', 'git push', 'git commit', 'gh workflow run'):
                self.assertNotIn(forbidden, text)
            for job in doc['jobs'].values():
                self.assertEqual(job['runs-on'], 'ubuntu-latest')
                self.assertLessEqual(int(job['timeout-minutes']),20)
        for module in ('import_hosted_npm_security_evidence.py', 'verify_hosted_python_security_evidence.py'):
            source=(ROOT/'scripts'/module).read_text()
            self.assertIn("('push', 'schedule', 'workflow_dispatch')".replace(' ',''),source.replace(' ',''))
            self.assertIn("head_branch",source)

if __name__ == '__main__': unittest.main()
