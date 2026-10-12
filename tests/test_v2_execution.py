import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from scripts.v2_execution import StageRunner, job_lock


class ResumeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'source'
        self.source.write_text('input')
        self.output = self.root / 'output'
        self.calls = 0

    def action(self):
        self.calls += 1
        self.output.write_text(self.source.read_text())
        return [self.output]

    def run_stage(self):
        return StageRunner(self.root).stage('test', [self.source], self.action)

    def test_resume_skips_verified_success(self):
        self.run_stage()
        self.run_stage()
        self.assertEqual(self.calls, 1)

    def test_output_tamper_is_repaired(self):
        self.run_stage()
        self.output.write_text('corruption')
        self.run_stage()
        self.assertEqual(self.calls, 2)
        self.assertEqual(self.output.read_text(), 'input')

    def test_input_change_invalidates_success(self):
        self.run_stage()
        self.source.write_text('revised dialogue')
        self.run_stage()
        self.assertEqual(self.calls, 2)
        self.assertEqual(self.output.read_text(), 'revised dialogue')

    def test_crash_after_output_before_commit_reruns(self):
        def crash():
            self.action()
            raise KeyboardInterrupt('power loss')
        with self.assertRaises(KeyboardInterrupt):
            StageRunner(self.root).stage('test', [self.source], crash)
        state = json.loads((self.root / 'execution.json').read_text())
        self.assertEqual(state['stages']['test']['status'], 'RUNNING')
        self.run_stage()
        self.assertEqual(self.calls, 2)

    def test_retries_are_bounded_and_real(self):
        def failure():
            self.calls += 1
            raise subprocess.CalledProcessError(1, ['renderer'])
        with self.assertRaises(subprocess.CalledProcessError):
            StageRunner(self.root).stage('test', [self.source], failure, attempts=2)
        self.assertEqual(self.calls, 2)
        self.assertEqual(json.loads((self.root / 'execution.json').read_text())['status'], 'BLOCKED')

    def test_policy_failure_does_not_retry(self):
        def failure():
            self.calls += 1
            raise ValueError('Unapproved voice')
        with self.assertRaises(ValueError):
            StageRunner(self.root).stage('test', [self.source], failure, attempts=2)
        self.assertEqual(self.calls, 1)

    def test_force_repair_rebuilds_valid_output(self):
        self.run_stage()
        StageRunner(self.root).stage('test', [self.source], self.action, force=True)
        self.assertEqual(self.calls, 2)

    def test_concurrent_job_fails_without_mutating_state(self):
        with job_lock(self.root):
            with self.assertRaises(BlockingIOError):
                with job_lock(self.root):
                    self.fail('Acquired duplicate lock')

    def test_input_mutation_during_work_cannot_pass(self):
        def mutation():
            self.action()
            self.source.write_text('changed mid-stage')
            return [self.output]
        with self.assertRaisesRegex(ValueError, 'inputs changed'):
            StageRunner(self.root).stage('test', [self.source], mutation)


    def test_identical_repair_forces_qa_preserves_voice(self):
        voice = self.root / 'voice.wav'
        qa = self.root / 'qa.json'
        calls = {'voice': 0, 'render': 0, 'qa': 0}
        def action(name, path):
            def run():
                calls[name] += 1
                path.write_text('deterministic ' + name)
                return [path]
            return run
        def pipeline():
            runner = StageRunner(self.root)
            runner.stage('voice', [self.source], action('voice', voice))
            runner.stage('render', [voice], action('render', self.output))
            runner.stage('qa', [self.output], action('qa', qa), force=runner.rebuilt_media())
        pipeline()
        pipeline()
        self.assertEqual(calls, {'voice': 1, 'render': 1, 'qa': 1})
        self.output.write_text('corrupted media')
        pipeline()
        self.assertEqual(calls, {'voice': 1, 'render': 2, 'qa': 2})

    def test_malformed_checkpoints_preserved_and_blocked(self):
        for payload in ['invalid json', '[]', json.dumps({'schema_version': 1, 'stages': {'qa': []}}), json.dumps({'schema_version': 1, 'stages': {'qa': {'status': 'PASS'}}})]:
            with self.subTest(payload=payload):
                (self.root / 'execution.json').write_text(payload)
                with self.assertRaises(ValueError):
                    StageRunner(self.root)
                self.assertEqual((self.root / 'execution.json').read_text(), payload)
                failure = json.loads((self.root / 'execution-blocked.json').read_text())
                self.assertEqual(failure['status'], 'BLOCKED')
                self.assertFalse(failure['publication_enabled'])


if __name__ == '__main__':
    unittest.main()
