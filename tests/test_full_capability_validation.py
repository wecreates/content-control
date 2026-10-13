import copy
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from scripts.full_validation_scheduler import build_validation_plan
from scripts.load_remaining_task_queue import build_queue
from scripts.run_validation_shard import run_shard

ROOT = Path(__file__).resolve().parents[1]


def progress(domain='reliability', count=2):
    return {'publication_enabled': False, 'capabilities': {
        str(i): {'capability': f'Actual {i}', 'group': 'Actual', 'domain': domain,
                 'state': 'INTEGRATED', 'evidence': ['original.json']}
        for i in range(1, count + 1)}}


class FullValidationTests(unittest.TestCase):
    def test_explicit_domain_survives_without_mutating_progress(self):
        source = progress()
        original = copy.deepcopy(source)
        plan = build_validation_plan(source, shards=1)
        self.assertEqual(plan['status'], 'READY')
        self.assertTrue(all(row['domain'] == 'reliability' for row in plan['tasks']))
        self.assertFalse(plan['completion_verified'])
        self.assertEqual(source, original)

    def test_missing_domains_block_both_queues_without_fallback(self):
        source = progress(count=2500)
        for row in source['capabilities'].values():
            del row['domain']
        original = copy.deepcopy(source)
        for plan in [build_validation_plan(source), build_queue(source)]:
            self.assertEqual(plan['status'], 'BLOCKED')
            self.assertEqual(plan['tasks'], [])
            self.assertEqual(plan['blocked_capabilities'], 2500)
            self.assertTrue(all('missing_domain' in row['blockers'] for row in plan['blocked_tasks']))
        self.assertEqual(source, original)

    def test_limit_cannot_hide_invalid_metadata_or_trust_terminal_labels(self):
        source = progress()
        source['capabilities']['1']['state'] = 'RENDER_PROVEN'
        del source['capabilities']['2']['domain']
        plan = build_validation_plan(source, limit=1)
        self.assertEqual(plan['status'], 'BLOCKED')
        self.assertEqual(plan['tasks'][0]['required'], ['audit_render_evidence'])
        self.assertEqual(plan['blocked_capabilities'], 1)
        self.assertFalse(plan['completion_verified'])

    def test_empty_input_and_publication_policy_never_complete(self):
        for source in [{}, {'capabilities': {}}, dict(progress(), publication_enabled=True)]:
            self.assertEqual(build_validation_plan(source)['status'], 'BLOCKED')

    def test_planner_cli_saves_blockers_before_nonzero_exit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = progress()
            del source['capabilities']['1']['domain']
            (root / 'progress.json').write_text(json.dumps(source))
            completed = subprocess.run([
                sys.executable, str(ROOT / 'scripts/full_validation_scheduler.py'),
                '--progress', str(root / 'progress.json'), '--out', str(root / 'plan.json')],
                capture_output=True, text=True)
            self.assertEqual(completed.returncode, 2)
            self.assertEqual(json.loads((root / 'plan.json').read_text())['blocked_capabilities'], 1)
            self.assertEqual(json.loads((root / 'progress.json').read_text()), source)

    def test_nonzero_diagnostics_preserve_all_ten_receipts(self):
        plan = build_validation_plan(progress(count=10), shards=1)
        calls = []
        def runner(argv, **kwargs):
            task = json.loads(argv[argv.index('--task') + 1])
            calls.append(task['capability_id'])
            Path(argv[-1]).write_text(json.dumps({
                'capability_id': task['capability_id'], 'status': 'BLOCKED',
                'publication_enabled': False, 'completion_verified': False}))
            return SimpleNamespace(returncode=2)
        with tempfile.TemporaryDirectory() as directory:
            report = run_shard(plan, 0, directory, runner)
            self.assertEqual(calls, list(range(1, 11)))
            self.assertEqual(report['status'], 'BLOCKED')
            self.assertFalse(report['completion_verified'])
            self.assertEqual(len(list(Path(directory).glob('*.json'))), 11)
            self.assertTrue(all(row['returncode'] == 2 for row in report['results']))

    def test_zero_exit_cannot_hide_blocked_unverified_or_wrong_receipt(self):
        mutations = [
            {'status': 'BLOCKED'}, {'status': 'CHECKS_PASSED_UNVERIFIED'},
            {'completion_verified': False}, {'publication_enabled': True},
            {'capability_id': 999}, {'capability_id': True}]
        plan = build_validation_plan(progress(count=1), shards=1)
        for mutation in mutations:
            def runner(argv, **kwargs):
                receipt = dict(capability_id=1, status='PASS',
                               publication_enabled=False, completion_verified=True)
                receipt.update(mutation)
                Path(argv[-1]).write_text(json.dumps(receipt))
                return SimpleNamespace(returncode=0)
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as directory:
                self.assertEqual(run_shard(plan, 0, directory, runner)['status'], 'BLOCKED')

    def test_missing_malformed_receipts_and_timeout_stay_blocked(self):
        plan = build_validation_plan(progress(count=1), shards=1)
        for mode in ['missing', 'malformed', 'timeout']:
            def runner(argv, **kwargs):
                if mode == 'timeout':
                    raise subprocess.TimeoutExpired(argv, 330)
                if mode == 'malformed':
                    Path(argv[-1]).write_text('not json')
                return SimpleNamespace(returncode=0)
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                # This old receipt must not be accepted when the new process fails.
                (Path(directory) / '1.json').write_text(json.dumps(dict(
                    capability_id=1, status='PASS', completion_verified=True, publication_enabled=False)))
                report = run_shard(plan, 0, directory, runner)
                self.assertEqual(report['status'], 'BLOCKED')
                self.assertTrue((Path(directory) / 'shard-0.json').is_file())

    def test_invalid_or_empty_plan_never_launches_diagnostics(self):
        def forbidden(*args, **kwargs):
            self.fail('Invalid plan executed a diagnostic')
        plans = [None, {}, {'tasks': []}, dict(build_validation_plan(progress()), status='BLOCKED')]
        for plan in plans:
            with self.subTest(plan=plan), tempfile.TemporaryDirectory() as directory:
                self.assertEqual(run_shard(plan, 0, directory, forbidden)['status'], 'BLOCKED')

    def test_matching_verified_receipts_pass_without_promoting_registry(self):
        source = progress()
        original = copy.deepcopy(source)
        def runner(argv, **kwargs):
            task = json.loads(argv[argv.index('--task') + 1])
            Path(argv[-1]).write_text(json.dumps(dict(
                capability_id=task['capability_id'], status='PASS',
                publication_enabled=False, completion_verified=True)))
            return SimpleNamespace(returncode=0)
        with tempfile.TemporaryDirectory() as directory:
            report = run_shard(build_validation_plan(source, shards=1), 0, directory, runner)
            self.assertEqual(report['status'], 'PASS')
            self.assertFalse(report['publication_enabled'])
            self.assertEqual(source, original)

    def test_real_cli_propagates_unsupported_domain_and_keeps_receipts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            plan = build_validation_plan(progress(domain='unsupported', count=1), shards=1)
            (root / 'plan.json').write_text(json.dumps(plan))
            completed = subprocess.run([
                sys.executable, 'scripts/run_validation_shard.py', '--plan', str(root / 'plan.json'),
                '--shard', '0', '--out-dir', str(root / 'evidence')],
                cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(completed.returncode, 2)
            receipt = json.loads((root / 'evidence/1.json').read_text())
            self.assertEqual(receipt['reason'], 'unsupported_or_missing_domain')
            self.assertFalse(receipt['completion_verified'])
            self.assertTrue((root / 'evidence/shard-0.json').is_file())

    def test_workflow_saves_evidence_after_failure_and_gates_empty_matrix(self):
        workflow = (ROOT / '.github/workflows/full-capability-validation.yml').read_text()
        uploads = re.findall(r'- uses: actions/upload-artifact@v4\n(.*?)(?=\n      - |\n  [a-z]|\Z)',
                             workflow, re.DOTALL)
        self.assertEqual(len(uploads), 2)
        self.assertTrue(all('if: always()' in step for step in uploads))
        self.assertIn("if: needs.plan.outputs.ready == 'true'", workflow)
        self.assertIn('python scripts/run_validation_shard.py', workflow)
        self.assertNotIn('check=False', workflow)


if __name__ == '__main__':
    unittest.main()
