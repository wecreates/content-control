import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts/normalize_python_security_audit.py'
spec = importlib.util.spec_from_file_location('audit', SCRIPT)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        for scope in audit.SCOPES:
            self.write(scope)

    def write(self, scope, code=0, vulns=None, doc=None):
        if doc is None:
            doc = {'dependencies': [{'name': name, 'version': version, 'vulns': vulns or [] if name == 'pillow' else []}
                                    for name, version in audit.direct_requirements(ROOT / audit.SCOPES[scope]).items()]}
        (self.directory / f'{scope}-audit.json').write_text(json.dumps(doc))
        (self.directory / f'{scope}-exit').write_text(str(code))

    def result(self):
        return audit.normalize(self.directory)

    def test_clean_scopes_pass(self):
        self.assertEqual(self.result()['status'], 'PASS')
        self.assertFalse(self.result()['publication_enabled'])
        self.assertIn('requirements-pod-runtime.txt', self.result()['audited_requirements'])

    def test_pod_vulnerability_fails(self):
        self.write('pod', 1, [{'id': 'TEST-1', 'fix_versions': ['13.0.0']}])
        result = self.result()
        self.assertEqual(result['status'], 'FAIL')
        self.assertEqual(result['total_vulnerabilities'], 1)
        self.assertEqual(result['pod_vulnerabilities'][0]['id'], 'TEST-1')

    def test_missing_report_fails_closed(self):
        (self.directory / 'qa-audit.json').unlink()
        self.assertEqual(self.result()['status'], 'ERROR')

    def test_empty_and_malformed_reports_fail_closed(self):
        for value in ['', '{']:
            with self.subTest(value=value):
                (self.directory / 'qa-audit.json').write_text(value)
                self.assertEqual(self.result()['status'], 'ERROR')

    def test_invalid_inventory_fails_closed(self):
        for doc in [{}, {'dependencies': []}, {'dependencies': {}}, [], None, 3,
                    {'dependencies': [{'name': 'pillow', 'version': '13.0.0'}]},
                    {'dependencies': [{'name': 'pillow', 'skip_reason': 'unavailable'}]},
                    {'dependencies': [{'name': 'pillow', 'version': '13.0.0', 'vulns': [{}]}]}]:
            with self.subTest(doc=doc):
                (self.directory / 'qa-audit.json').write_text(json.dumps(doc))
                self.assertEqual(self.result()['status'], 'ERROR')

    def test_missing_bad_and_failure_exit_codes_fail_closed(self):
        path = self.directory / 'qa-exit'
        for value in ['2', '127', '-1', '', 'invalid']:
            with self.subTest(value=value):
                path.write_text(value)
                self.assertEqual(self.result()['status'], 'ERROR')
        path.unlink()
        self.assertEqual(self.result()['status'], 'ERROR')

    def test_exit_code_must_match_findings(self):
        self.write('qa', 1)
        self.assertEqual(self.result()['status'], 'ERROR')
        self.write('qa', 0, [{'id': 'TEST-1'}])
        self.assertEqual(self.result()['status'], 'ERROR')
        self.assertEqual(self.result()['total_vulnerabilities'], 1)

    def test_blank_dependency_identity_fails_closed(self):
        for key in ['name', 'version']:
            for value in ['', '   ']:
                with self.subTest(key=key, value=value):
                    dep = {'name': 'pillow', 'version': '13.0.0', 'vulns': []}
                    dep[key] = value
                    self.write('qa', doc={'dependencies': [dep]})
                    self.assertEqual(self.result()['status'], 'ERROR')

    def test_known_findings_survive_other_scope_error(self):
        self.write('pod', 1, [{'id': 'TEST-1'}])
        (self.directory / 'qa-exit').unlink()
        self.assertEqual(self.result()['status'], 'ERROR')
        self.assertEqual(self.result()['total_vulnerabilities'], 1)

    def test_list_format(self):
        self.write('qa')
        path = self.directory / 'qa-audit.json'
        path.write_text(json.dumps(json.loads(path.read_text())['dependencies']))
        self.assertEqual(self.result()['status'], 'PASS')

    def test_valid_findings_survive_same_scope_errors_in_either_order(self):
        valid = {'name': 'pillow', 'version': '12.3.0', 'vulns': [{'id': 'TEST-1'}]}
        for invalid in [None, {}, {'name': 'other', 'skip_reason': 'unavailable'}]:
            for deps in [[valid, invalid], [invalid, valid]]:
                with self.subTest(deps=deps):
                    self.write('qa', 1, doc={'dependencies': deps})
                    result = self.result()
                    self.assertEqual(result['status'], 'ERROR')
                    self.assertEqual(result['total_vulnerabilities'], 1)
                    self.assertEqual(result['qa_vulnerabilities'][0]['id'], 'TEST-1')
                    self.assertTrue(result['audit_errors'])

    def test_valid_findings_survive_bad_vulnerability_and_exit(self):
        self.write('qa', 2, doc={'dependencies': [
            {'name': 'pillow', 'version': '12.3.0',
             'vulns': [{'id': 'TEST-1'}, {}, {'id': 'TEST-2'}]}]})
        result = self.result()
        self.assertEqual(result['status'], 'ERROR')
        self.assertEqual(result['total_vulnerabilities'], 2)
        self.assertEqual([v['id'] for v in result['qa_vulnerabilities']], ['TEST-1', 'TEST-2'])

    def test_cli_persists_error_and_exits_nonzero(self):
        (self.directory / 'pod-exit').unlink()
        output = self.directory / 'report.json'
        run = subprocess.run([sys.executable, str(SCRIPT), '--input-dir', str(self.directory),
                              '--output', str(output)], capture_output=True, text=True)
        self.assertEqual(run.returncode, 2)
        self.assertEqual(json.loads(output.read_text())['status'], 'ERROR')

    def test_unrelated_only_inventory_fails_completeness(self):
        self.write('qa', doc={'dependencies': [{'name': 'unrelated', 'version': '1.0', 'vulns': []}]})
        result = self.result()
        self.assertEqual(result['status'], 'ERROR')
        self.assertFalse(result['direct_requirements_verified'])

    def test_duplicate_versions_fail_in_either_order(self):
        path = self.directory / 'qa-audit.json'
        for versions in [('12.3.0', '13.0.0'), ('13.0.0', '12.3.0'), ('13.0.0', '13.0.0')]:
            self.write('qa')
            doc = json.loads(path.read_text())
            doc['dependencies'] = [d for d in doc['dependencies'] if d['name'] != 'pillow']
            doc['dependencies'].extend({'name': 'Pillow', 'version': v, 'vulns': []} for v in versions)
            path.write_text(json.dumps(doc))
            self.assertEqual(self.result()['status'], 'ERROR')

    def test_malformed_local_version_fails_closed(self):
        path = self.directory / 'qa-audit.json'
        for version in ['13.0.0+not a version', '13.0.0+', '13.0.0+cpu/evil']:
            self.write('qa')
            doc = json.loads(path.read_text())
            next(d for d in doc['dependencies'] if d['name'] == 'pillow')['version'] = version
            path.write_text(json.dumps(doc))
            self.assertEqual(self.result()['status'], 'ERROR')

    def test_identifiable_advisory_survives_malformed_fix_versions(self):
        for fixes in [None, '13.0.0', [None]]:
            self.write('qa', 1, [{'id': 'TEST-1', 'fix_versions': fixes}])
            result = self.result()
            self.assertEqual(result['status'], 'ERROR')
            self.assertEqual(result['total_vulnerabilities'], 1)
            finding = result['qa_vulnerabilities'][0]
            self.assertEqual(finding['id'], 'TEST-1')
            self.assertFalse(finding['fix_versions_valid'])
            self.assertEqual(finding['original_fix_versions'], fixes)

    def test_missing_or_wrong_direct_pin_fails(self):
        path = self.directory / 'pod-audit.json'
        for replacement in [None, '12.3.0']:
            self.write('pod')
            doc = json.loads(path.read_text())
            if replacement is None:
                doc['dependencies'] = [d for d in doc['dependencies'] if d['name'] != 'pillow']
            else:
                next(d for d in doc['dependencies'] if d['name'] == 'pillow')['version'] = replacement
            path.write_text(json.dumps(doc))
            self.assertEqual(self.result()['status'], 'ERROR')

    def test_transitive_dependencies_and_canonical_names_are_allowed(self):
        path = self.directory / 'qa-audit.json'
        doc = json.loads(path.read_text())
        for dep in doc['dependencies']:
            dep['name'] = dep['name'].replace('-', '_').upper()
            if dep['name'] == 'TORCH':
                dep['version'] += '+cpu'
        doc['dependencies'].append({'name': 'extra-transitive', 'version': '1.0', 'vulns': []})
        path.write_text(json.dumps(doc))
        self.assertEqual(self.result()['status'], 'PASS')
        self.assertTrue(self.result()['direct_requirements_verified'])

    def test_unsupported_or_missing_manifest_fails_closed(self):
        manifest = self.directory / 'requirements-free-qa.lock.txt'
        manifest.write_text('Pillow>=13.0.0\n')
        self.assertEqual(audit.normalize(self.directory, self.directory)['status'], 'ERROR')
        manifest.unlink()
        self.assertEqual(audit.normalize(self.directory, self.directory)['status'], 'ERROR')

    def test_pin_and_workflow_coverage(self):
        for name in ['requirements-free-qa.lock.txt', 'requirements-pod-runtime.txt']:
            self.assertIn('Pillow==13.0.0', (ROOT / name).read_text().splitlines())
        workflow = (ROOT / '.github/workflows/python-security-audit.yml').read_text()
        for name in audit.SCOPES.values():
            self.assertIn(f'pip-audit -r {name}', workflow)
            self.assertIn(f"- '{name}'", workflow)
        self.assertIn('python scripts/normalize_python_security_audit.py', workflow)

    def test_pod_ci_uses_runtime_manifest_with_unchanged_other_pins(self):
        workflow = (ROOT / '.github/workflows/pod-integration.yml').read_text()
        self.assertIn('      - run: pip install -r requirements-pod-runtime.txt', workflow)
        self.assertNotIn('pip install Pillow==', workflow)
        self.assertEqual(audit.direct_requirements(ROOT / 'requirements-pod-runtime.txt'), {
            'pillow': '13.0.0', 'numpy': '2.3.5', 'opencv-python-headless': '5.0.0.93',
            'reportlab': '4.4.9', 'pymupdf': '1.26.6', 'fonttools': '4.61.1'})

    def test_semantic_workflow_pin_preserves_other_dependencies(self):
        workflow = (ROOT / '.github/workflows/semantic-visual-analysis.yml').read_text()
        self.assertIn('python -m pip install open_clip_torch==3.3.0 transformers==5.19.0 pillow==13.0.0', workflow)
        self.assertIn('python -m pip install torch==2.14.1 torchvision==0.29.1 --index-url https://download.pytorch.org/whl/cpu', workflow)
        self.assertNotIn('pillow==12.3.0', workflow)


if __name__ == '__main__':
    unittest.main()
