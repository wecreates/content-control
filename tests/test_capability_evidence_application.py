import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class CapabilityEvidenceApplicationTests(unittest.TestCase):
    def test_unverified_receipts_do_not_promote_or_create_capabilities(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            progress_path = root / 'progress.json'
            evidence_dir = root / 'evidence'
            output = root / 'next.json'
            evidence_dir.mkdir()
            progress = {
                'schema_version': 1, 'publication_enabled': False,
                'capabilities': {
                    '1': {'state': 'INSTALLED', 'domain': 'renderer', 'evidence': []},
                    '2': {'state': 'TESTED', 'domain': 'story', 'evidence': ['existing.json']},
                },
            }
            progress_path.write_text(json.dumps(progress))
            receipts = [
                {'capability_id': 1, 'domain': 'renderer', 'proven_state': 'INTEGRATED', 'validation_deferred': True},
                {'capability_id': 1, 'domain': 'renderer', 'proven_state': 'TESTED', 'checks': [{'rc': 0}]},
                {'capability_id': 2, 'domain': 'story', 'proven_state': 'RENDER_PROVEN', 'evidence_kind': 'non_media_test_proof'},
                {'capability_id': 3, 'domain': 'renderer', 'proven_state': 'RENDER_PROVEN', 'completion_verified': True},
            ]
            for index, receipt in enumerate(receipts):
                (evidence_dir / f'{index}.json').write_text(json.dumps({
                    **receipt, 'status': 'PASS', 'publication_enabled': False,
                }))
            result = self.run_script(
                'apply_capability_evidence.py',
                '--progress', progress_path, '--evidence-dir', evidence_dir, '--out', output,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(output.read_text()), progress)
            self.assertEqual(json.loads(result.stdout), {
                'status': 'PROGRESS_RETAINED', 'total': 2, 'receipts_observed': 4,
                'capabilities_promoted': 0, 'publication_enabled': False,
            })

    def test_invalid_progress_does_not_replace_existing_output(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            progress_path, output = root / 'progress.json', root / 'next.json'
            output.write_text('existing evidence')
            for invalid in ('{', '{"capabilities":{},"publication_enabled":true}'):
                with self.subTest(invalid=invalid):
                    progress_path.write_text(invalid)
                    result = self.run_script(
                        'apply_capability_evidence.py',
                        '--progress', progress_path, '--evidence-dir', root, '--out', output,
                    )
                    self.assertNotEqual(result.returncode, 0)
                    self.assertEqual(output.read_text(), 'existing evidence')

    def test_integration_placeholder_reports_a_blocker_without_promoting(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'evidence' / '1.json'
            result = self.run_script(
                'integrate_capability_without_test.py', '--task',
                json.dumps({'capability_id': 1, 'domain': 'renderer', 'publication_enabled': False}),
                '--out', output,
            )
            self.assertEqual(result.returncode, 2, result.stderr)
            self.assertEqual(json.loads(output.read_text()), {
                'schema_version': 1, 'status': 'BLOCKED', 'capability_id': 1, 'domain': 'renderer',
                'reason': 'capability_specific_implementation_evidence_required',
                'completion_verified': False, 'publication_enabled': False,
            })

    @staticmethod
    def run_script(script, *arguments):
        return subprocess.run(
            [sys.executable, str(ROOT / 'scripts' / script), *map(str, arguments)],
            capture_output=True, text=True, timeout=5,
        )


if __name__ == '__main__':
    unittest.main()
