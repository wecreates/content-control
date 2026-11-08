import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/normalize_npm_security_audit.py'
spec = importlib.util.spec_from_file_location('audit', SCRIPT)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def fixture(severity=None):
    counts = dict.fromkeys(audit.SEVERITIES, 0)
    counts['total'] = int(severity is not None)
    vulns = {}
    if severity:
        counts[severity] = 1
        vulns['example'] = {'name': 'example', 'severity': severity, 'via': [{'name': 'example', 'title': 'synthetic advisory'}], 'nodes': ['node_modules/example']}
    return {'auditReportVersion': 2, 'vulnerabilities': vulns, 'metadata': {'vulnerabilities': counts}}


class AuditTests(unittest.TestCase):
    def test_clean(self):
        self.assertEqual(audit.normalize(fixture(), 0)['status'], 'PASS')
    def test_each_severity_fails(self):
        for severity in audit.SEVERITIES:
            self.assertEqual(audit.normalize(fixture(severity), 1)['status'], 'FAIL')
    def test_missing_or_failed_document(self):
        for raw in [{}, None, [], {'error': {'code': 'ENOTFOUND'}}, {'auditReportVersion': 1}]:
            self.assertEqual(audit.normalize(raw, 0)['status'], 'ERROR')
    def test_bad_exit(self):
        for code in [2, 127, None, True]:
            self.assertEqual(audit.normalize(fixture(), code)['status'], 'ERROR')
    def test_contradictory_exit(self):
        self.assertEqual(audit.normalize(fixture(), 1)['status'], 'ERROR')
        self.assertEqual(audit.normalize(fixture('high'), 0)['status'], 'ERROR')
    def test_malformed_counts(self):
        for value in [None, {}, {'total': 0}, {'high': '8'}]:
            doc = fixture(); doc['metadata']['vulnerabilities'] = value
            self.assertEqual(audit.normalize(doc, 0)['status'], 'ERROR')
    def test_counts_disagreement(self):
        doc = fixture('high'); doc['metadata']['vulnerabilities']['total'] = 0
        self.assertEqual(audit.normalize(doc, 1)['status'], 'ERROR')
    def test_invalid_inventory(self):
        for item in [None, {}, {'name':'wrong'}, {'name':'example', 'severity':'banana', 'via':[], 'nodes':[]}]:
            doc = fixture('high'); doc['vulnerabilities']['example'] = item
            self.assertEqual(audit.normalize(doc, 1)['status'], 'ERROR')
    def test_findings_preserved_on_error(self):
        doc = fixture('high'); result = audit.normalize(doc, 2)
        self.assertEqual(result['raw_audit']['vulnerabilities'], doc['vulnerabilities'])
    def test_unhashable_and_nonstring_severity_fails_closed(self):
        for severity in [[], {}, None, True, 1]:
            doc = fixture('high')
            doc['vulnerabilities']['example']['severity'] = severity
            self.assertEqual(audit.normalize(doc, 1)['status'], 'ERROR')
    def test_invalid_advisory_causes(self):
        for cause in [None, {}, [], 42, '', '   ', {'name':'example'}, {'name': [], 'title':'bad'}]:
            doc = fixture('high')
            doc['vulnerabilities']['example']['via'] = [cause]
            self.assertEqual(audit.normalize(doc, 1)['status'], 'ERROR')
    def test_transitive_cause_is_valid(self):
        doc = fixture('high')
        doc['vulnerabilities']['example']['via'] = ['affected-dependency']
        self.assertEqual(audit.normalize(doc, 1)['status'], 'FAIL')
    def test_cli_preserves_findings_with_missing_or_malformed_exit(self):
        for value in [None, 'not-an-exit-code']:
            with self.subTest(value=value), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                source, code, output = root/'audit.json', root/'exit', root/'result.json'
                source.write_text(json.dumps(fixture('high')))
                if value is not None:
                    code.write_text(value)
                run = subprocess.run([sys.executable, str(SCRIPT), '--input', str(source), '--exit-code-file', str(code), '--output', str(output)], capture_output=True)
                self.assertEqual(run.returncode, 2)
                report = json.loads(output.read_text())
                self.assertEqual(report['status'], 'ERROR')
                self.assertEqual(report['raw_audit']['vulnerabilities']['example']['severity'], 'high')
    def test_cli_replaces_stale_pass_on_malformed_severity(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, code, output = root/'audit.json', root/'exit', root/'result.json'
            doc = fixture('high')
            doc['vulnerabilities']['example']['severity'] = []
            source.write_text(json.dumps(doc)); code.write_text('1')
            output.write_text(json.dumps({'status':'PASS'}))
            run = subprocess.run([sys.executable, str(SCRIPT), '--input', str(source), '--exit-code-file', str(code), '--output', str(output)], capture_output=True)
            self.assertEqual(run.returncode, 2)
            self.assertEqual(json.loads(output.read_text())['status'], 'ERROR')
    def test_missing_input_cli_is_nonzero_and_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            output=Path(tmp)/'result.json'
            run=subprocess.run([sys.executable,str(SCRIPT),'--input',str(Path(tmp)/'missing'),'--exit-code-file',str(Path(tmp)/'missing-exit'),'--output',str(output)],capture_output=True)
            self.assertEqual(run.returncode,2)
            self.assertEqual(json.loads(output.read_text())['status'],'ERROR')

if __name__ == '__main__': unittest.main()
