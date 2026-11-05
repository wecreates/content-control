"""Offline tests for fail-closed consumer and read-only workflow wiring."""
import ast
import copy
import json
from pathlib import Path
import tempfile
import unittest
from test_npm_security_audit import audit, fixture

ROOT = Path(__file__).resolve().parents[1]

class ConsumerTests(unittest.TestCase):
    def test_complete_clean_report(self):
        self.assertTrue(audit.security_report_is_clean(audit.normalize(fixture(), 0)))
    def test_legacy_missing_error_and_findings_rejected(self):
        for doc in [None, {}, {'npm_counts': {}}, {'schema_version':1,'npm_counts':{'high':0}}, audit.normalize(fixture(), 2), audit.normalize(fixture('high'), 1)]:
            self.assertFalse(audit.security_report_is_clean(doc))
    def test_each_required_field_and_count(self):
        clean = audit.normalize(fixture(), 0)
        for key in clean:
            doc = copy.deepcopy(clean); del doc[key]
            self.assertFalse(audit.security_report_is_clean(doc), key)
        for key in (*audit.SEVERITIES, 'total'):
            for value in [None, False, '0', -1, 1, [], {}]:
                doc = copy.deepcopy(clean); doc['npm_counts'][key] = value
                self.assertFalse(audit.security_report_is_clean(doc), (key,value))
    def test_retained_raw_evidence_revalidated(self):
        doc = audit.normalize(fixture(), 0)
        doc['raw_audit'] = fixture('high')
        self.assertFalse(audit.security_report_is_clean(doc))
    def test_legacy_fields_preserved(self):
        doc = audit.normalize(fixture('high'), 1)
        self.assertEqual(doc['high_count'], 1)
        self.assertEqual(doc['critical_count'], 0)
        self.assertIsInstance(doc['vulnerabilities'], list)
        self.assertEqual(doc['vulnerabilities'][0]['name'], 'example')
    def test_missing_malformed_and_nonobject_files_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'security.json'
            self.assertFalse(audit.security_report_is_clean(audit.load_security_report(path)))
            for value in ['', '{', 'null', '[]', '{}']:
                path.write_text(value)
                self.assertFalse(audit.security_report_is_clean(audit.load_security_report(path)))
    def test_watchdog_calls_safe_loader_and_gate(self):
        source = (ROOT/'scripts/verify_free_production_health.py').read_text()
        tree = ast.parse(source)
        assignments = [n for n in tree.body if isinstance(n, ast.Assign)]
        security = next(n for n in assignments if any(isinstance(t,ast.Name) and t.id=='security' for t in n.targets))
        self.assertEqual(security.value.func.id, 'load_hosted_report')
        self.assertEqual(security.value.args[1].value, 'wecreates/content-control')
        check = next(n for n in assignments if any(isinstance(t,ast.Subscript) and isinstance(t.slice,ast.Constant) and t.slice.value=='dependency_security_clean' for t in n.targets))
        self.assertEqual(check.value.func.id, 'security_report_is_clean')
    def test_workflow_readonly_fresh_artifact_and_scans(self):
        text = (ROOT/'.github/workflows/runtime-security-audit.yml').read_text()
        for forbidden in ['contents: write','git push','git commit','gh workflow run','--output state/']:
            self.assertNotIn(forbidden,text)
        for required in ['contents: read','ref: ${{ github.sha }}','persist-credentials: false','mktemp -d','--audit-level=info','npm audit --package-lock-only','--include=dev','--include=optional','--include=peer',"steps.receipt.outcome == 'success'",'report_sha256','package_lock_sha256',"branches: [main]","cron: '29 11 * * 1'",'test_npm_security*.py']:
            self.assertIn(required,text)
    def test_cli_clean_preserves_legacy_summary(self):
        import subprocess, sys
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root/'raw.json').write_text(json.dumps(fixture()))
            (root/'exit').write_text('0')
            run = subprocess.run([sys.executable, str(ROOT/'scripts/normalize_npm_security_audit.py'), '--input', str(root/'raw.json'), '--exit-code-file', str(root/'exit'), '--output', str(root/'report.json')],capture_output=True)
            self.assertEqual(run.returncode,0)
            self.assertTrue(audit.security_report_is_clean(json.loads((root/'report.json').read_text())))
    def test_watchdog_no_default_zero_security_shortcut(self):
        source = (ROOT/'scripts/verify_free_production_health.py').read_text()
        self.assertNotIn('security.get("npm_counts",{}).get(k,0)', source)
