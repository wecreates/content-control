"""Exercise the workflow's actual embedded routing code, without shell/dispatch."""
import contextlib
import io
import json
from pathlib import Path
import textwrap
import unittest
from unittest.mock import mock_open, patch

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / '.github/workflows/free-production-watchdog.yml'


def routes(failed):
    source = WORKFLOW.read_text()
    marker = "          python - <<'PY' > /tmp/repair-workflows\n"
    if source.count(marker) != 1:
        raise AssertionError('Expected exactly one workflow routing program')
    body = source.split(marker, 1)[1].split('\n          PY\n', 1)[0]
    code = compile(textwrap.dedent(body), str(WORKFLOW) + ':routing', 'exec')
    output = io.StringIO()
    fixture = mock_open(read_data=json.dumps({'failed_checks': failed}))
    with patch('builtins.open', fixture), contextlib.redirect_stdout(output):
        exec(code, {})
    fixture.assert_called_once_with('state/free-production-watchdog.json')
    return output.getvalue().splitlines()


class WatchdogRoutingTests(unittest.TestCase):
    def test_python_security_only_does_not_request_vision(self):
        self.assertEqual(routes(['python_dependency_security_clean']),
                         ['python-security-audit.yml'])

    def test_security_and_caption_keep_independent_routes(self):
        self.assertEqual(routes(['python_dependency_security_clean',
                                 'dependency_security_clean', 'caption_health_green']),
                         ['narration-transcription-gate.yml', 'python-security-audit.yml',
                          'runtime-security-audit.yml'])

    def test_genuine_vision_failure_still_routes_vision(self):
        self.assertEqual(routes(['florence_green']), ['free-vision-qa.yml'])
        self.assertEqual(routes(['python_dependency_security_clean', 'florence_green']),
                         ['free-vision-qa.yml', 'python-security-audit.yml'])

    def test_existing_mapping_unchanged_and_targets_exist(self):
        expected = {
            'runtime_integrity_manifest': 'runtime-integrity-manifest.yml',
            'factual_compliance_green': 'factual-compliance-gate.yml',
            'sync_retention_green': 'sync-retention-gate.yml',
            'dependency_security_clean': 'runtime-security-audit.yml',
            'runtime_locks_present': 'generate-runtime-locks.yml',
            'system_wiring_green': 'system-wiring-audit.yml',
            'python_dependency_security_clean': 'python-security-audit.yml',
        }
        for check, workflow in expected.items():
            with self.subTest(check=check):
                self.assertEqual(routes([check]), [workflow])
                self.assertTrue((ROOT/'.github/workflows'/workflow).is_file())

    def test_promotion_order_and_auxiliary_failures_preserved(self):
        self.assertEqual(routes(['caption_health_green', 'review_server_smoke_green',
                                 'provenance_candidate_match', 'live_deployment_green']),
                         ['narration-transcription-gate.yml'])
        self.assertEqual(routes(['review_server_smoke_green', 'live_deployment_green']),
                         ['review-server-smoke.yml'])
        self.assertEqual(routes(['provenance_inputs_current', 'live_deployment_green']),
                         ['runtime-provenance.yml'])
        self.assertEqual(routes(['live_deployment_green']), ['live-render-deployment-smoke.yml'])
        self.assertEqual(routes(['workflow_control_green', 'candidate_converged']), [])

    def test_empty_duplicates_and_unknown_preserve_fallback(self):
        self.assertEqual(routes([]), [])
        self.assertEqual(routes(['python_dependency_security_clean'] * 2), ['python-security-audit.yml'])
        self.assertEqual(routes(['unrecognized_check']), ['free-vision-qa.yml'])


if __name__ == '__main__':
    unittest.main()
