"""Offline Git remotes exercise exact-source persistence and push-race handling."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from scripts import persist_caption_evidence as module

ROOT = Path(__file__).resolve().parents[1]


class CaptionPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.remote, self.repo, self.other = (self.root / name for name in ('remote.git', 'run', 'other'))
        self.git('init', '--bare', '--initial-branch=main', str(self.remote))
        self.git('clone', str(self.remote), str(self.repo))
        self.configure(self.repo)
        paths = set(sum(module.INPUTS.values(), ()) + sum(module.OUTPUTS.values(), ()))
        for path in paths:
            target = self.repo / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text('original ' + path)
        self.write('state/content-control-health.json', {'status': 'GREEN', 'candidate_sha256': 'a' * 64, 'publication_enabled': False})
        self.write('state/episode1-factual-contract.json', {'publication_enabled': False})
        self.write('state/narration-transcription-health.json', {'status': 'PASS', 'publication_enabled': False})
        self.write('state/caption-health.json', {'status': 'PASS', 'publication_enabled': False})
        (self.repo / 'unrelated.txt').write_text('original')
        self.commit(self.repo, 'initial')
        self.source = self.git('-C', str(self.repo), 'rev-parse', 'HEAD').decode().strip()
        self.git('-C', str(self.repo), 'push', 'origin', 'main')
        self.git('clone', str(self.remote), str(self.other))
        self.configure(self.other)

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        return subprocess.run(['git', *args], check=True, capture_output=True, timeout=20).stdout

    def configure(self, repo):
        self.git('-C', str(repo), 'config', 'user.name', 'test')
        self.git('-C', str(repo), 'config', 'user.email', 'test@example.invalid')

    def commit(self, repo, message):
        self.git('-C', str(repo), 'add', '.')
        self.git('-C', str(repo), 'commit', '-m', message)

    def write(self, path, value, repo=None):
        (repo or self.repo).joinpath(path).write_text(json.dumps(value))

    def remote_file(self, path):
        return self.git('--git-dir', str(self.remote), 'show', 'main:' + path)

    def fail(self):
        self.write('state/caption-health.json', {
            'status': 'FAIL', 'publication_enabled': False,
            'checks': {'caption_provenance_valid': False},
            'failed_checks': ['caption_provenance_valid'],
        })

    def passing(self):
        checks = {name: True for name in ('source_identity_bound', 'approved_words_match', 'observed_timing_bound', 'candidate_health_green')}
        report = {'status': 'PASS', 'publication_enabled': False, 'candidate_sha256': 'a' * 64, 'checks': checks}
        for field, path in {
            'caption_sha256': 'public-review/episode1-v10-free.vtt',
            'transcription_receipt_sha256': 'state/narration-transcription-health.json',
            'caption_contract_sha256': 'state/episode1-factual-contract.json',
            'narration_sha256': 'public/audio/episode1-narration.mp3',
        }.items():
            report[field] = hashlib.sha256((self.repo / path).read_bytes()).hexdigest()
        self.write('state/caption-health.json', report)
        for path in ('state/accepted-candidate-ledger.json', 'state/acceptance-ledger-health.json'):
            self.write(path, {'status': 'PASS', 'publication_enabled': False, 'current_candidate_sha256': 'a' * 64})

    def persist(self, kind='narration', **kwargs):
        return module.persist(self.repo, kind, kwargs.get('source_commit', self.source), kwargs.get('source_ref', 'refs/heads/main'))

    def advance(self, path, content):
        (self.other / path).write_text(content)
        self.commit(self.other, 'concurrent change')
        self.git('-C', str(self.other), 'push', 'origin', 'main')

    def test_failed_receipt_persists_without_stale_vtt_transcript_or_ledger(self):
        self.fail()
        original = {path: self.remote_file(path) for path in module.OUTPUTS['reconcile'] if path != 'state/caption-health.json'}
        for path in original:
            (self.repo / path).write_text('unsafe partial output')
        self.assertEqual(self.persist('reconcile')['status'], 'SAVED')
        self.assertEqual(json.loads(self.remote_file('state/caption-health.json'))['status'], 'FAIL')
        for path, data in original.items():
            self.assertEqual(self.remote_file(path), data)

    def test_passing_bound_evidence_persists(self):
        self.passing()
        self.assertEqual(self.persist('reconcile')['status'], 'SAVED')
        self.assertEqual(json.loads(self.remote_file('state/caption-health.json'))['status'], 'PASS')
        self.assertEqual(json.loads(self.remote_file('state/acceptance-ledger-health.json'))['status'], 'PASS')

    def test_main_only_pinned_checkout_and_full_sha_required(self):
        self.fail()
        for ref in ('refs/heads/topic', 'refs/tags/main', '', 'main'):
            with self.subTest(ref=ref), self.assertRaises(ValueError):
                self.persist(source_ref=ref)
        for commit in (self.source[:8], 'b' * 40, '--help', ''):
            with self.subTest(commit=commit), self.assertRaises(ValueError):
                self.persist(source_commit=commit)
        self.assertEqual(json.loads(self.remote_file('state/caption-health.json'))['status'], 'PASS')

    def test_legacy_pass_or_invalid_failure_cannot_be_persisted(self):
        for report in ({'status': 'PASS', 'publication_enabled': False},
                       {'status': 'FAIL', 'publication_enabled': False},
                       {'status': 'FAIL', 'publication_enabled': True}):
            with self.subTest(report=report), self.assertRaises(ValueError):
                self.write('state/caption-health.json', report)
                self.persist()

    def test_changed_caption_bytes_or_ledger_candidate_block_passing_evidence(self):
        self.passing()
        (self.repo / 'public-review/episode1-v10-free.vtt').write_text('changed captions')
        with self.assertRaisesRegex(ValueError, 'source hash'):
            self.persist()
        self.passing()
        self.write('state/accepted-candidate-ledger.json', {'publication_enabled': False, 'current_candidate_sha256': 'b' * 64})
        with self.assertRaisesRegex(ValueError, 'Ledger candidate'):
            self.persist('reconcile')

    def test_local_source_changes_are_rejected(self):
        self.fail()
        (self.repo / 'public/audio/episode1-narration.mp3').write_bytes(b'other audio')
        with self.assertRaisesRegex(ValueError, 'Local source input changed'):
            self.persist()

    def test_caption_bytes_persist_from_the_same_checked_snapshot(self):
        self.passing()
        target = self.repo / 'public-review/episode1-v10-free.vtt'
        expected = target.read_bytes()
        original, reads = module.snapshot, []
        def swapped(path, *args):
            value = original(path, *args)
            if Path(path) == target:
                reads.append(True)
                target.write_bytes(b'changed after validated snapshot')
            return value
        with patch.object(module, 'snapshot', side_effect=swapped):
            self.assertEqual(self.persist()['status'], 'SAVED')
        self.assertEqual(len(reads), 1)
        self.assertEqual(self.remote_file('public-review/episode1-v10-free.vtt'), expected)

    def test_nonregular_source_and_receipt_fail_without_waiting(self):
        self.fail()
        target = self.repo / 'state/caption-health.json'
        target.unlink()
        os.mkfifo(target)
        with self.assertRaisesRegex(ValueError, 'regular file'):
            self.persist()
        target.unlink()
        self.fail()
        target = self.repo / 'public/audio/episode1-narration.mp3'
        target.unlink()
        os.mkfifo(target)
        with self.assertRaisesRegex(ValueError, 'regular file'):
            self.persist()

    def test_malformed_checks_fail_closed(self):
        for checks in (None, [], True, 'pass'):
            self.write('state/caption-health.json', {'status': 'FAIL', 'publication_enabled': False, 'checks': checks})
            with self.subTest(checks=checks), self.assertRaisesRegex(ValueError, 'checks object'):
                self.persist()

    def test_concurrent_candidate_change_cannot_receive_old_failure(self):
        self.fail()
        self.advance('state/content-control-health.json', '{"candidate_sha256":"new"}')
        self.assertEqual(self.persist()['status'], 'SUPERSEDED')
        self.assertEqual(json.loads(self.remote_file('state/caption-health.json'))['status'], 'PASS')

    def test_concurrent_audio_change_cannot_receive_old_pass(self):
        self.passing()
        self.advance('public/audio/episode1-narration.mp3', 'new audio')
        self.assertEqual(self.persist()['status'], 'SUPERSEDED')

    def test_newer_receipt_cannot_be_overwritten(self):
        self.fail()
        self.advance('state/caption-health.json', '{"status":"PASS","newer":true}')
        self.assertEqual(self.persist()['status'], 'SUPERSEDED')
        self.assertTrue(json.loads(self.remote_file('state/caption-health.json'))['newer'])

    def test_unrelated_concurrent_work_and_index_are_preserved(self):
        self.fail()
        self.advance('unrelated.txt', 'keep this')
        (self.repo / 'unrelated.txt').write_text('local staged work')
        self.git('-C', str(self.repo), 'add', 'unrelated.txt')
        before = self.git('-C', str(self.repo), 'diff', '--cached')
        self.assertEqual(self.persist()['status'], 'SAVED')
        self.assertEqual(self.remote_file('unrelated.txt'), b'keep this')
        self.assertEqual(self.git('-C', str(self.repo), 'diff', '--cached'), before)
        self.assertEqual(self.git('-C', str(self.repo), 'rev-parse', 'HEAD').decode().strip(), self.source)

    def test_unrelated_push_race_refetches_without_rebase_or_force(self):
        self.fail()
        original, pushed, commands = module.git, [], []
        def racing(repo, *args, **kwargs):
            commands.append(args)
            if args[0] == 'push' and not pushed:
                pushed.append(True)
                self.advance('unrelated.txt', 'racing change')
            return original(repo, *args, **kwargs)
        with patch.object(module, 'git', side_effect=racing):
            self.assertEqual(self.persist()['status'], 'SAVED')
        self.assertEqual(self.remote_file('unrelated.txt'), b'racing change')
        self.assertFalse(any(args[0] in ('rebase', 'pull') or any('force' in part for part in args) for args in commands))

    def test_candidate_push_race_stops_before_overwriting_receipts(self):
        self.fail()
        original, pushed = module.git, []
        def racing(repo, *args, **kwargs):
            if args[0] == 'push' and not pushed:
                pushed.append(True)
                self.advance('state/content-control-health.json', '{"candidate_sha256":"new"}')
            return original(repo, *args, **kwargs)
        with patch.object(module, 'git', side_effect=racing):
            self.assertEqual(self.persist()['status'], 'SUPERSEDED')
        self.assertEqual(json.loads(self.remote_file('state/caption-health.json'))['status'], 'PASS')

    def test_workflows_pin_main_and_persist_negative_receipts_without_rebase(self):
        for name, kind in (('narration-transcription-gate.yml', 'narration'), ('candidate-state-reconcile.yml', 'reconcile')):
            text = (ROOT / '.github/workflows' / name).read_text()
            with self.subTest(workflow=name):
                self.assertIn("if: ${{ github.ref == 'refs/heads/main' }}", text)
                self.assertIn('ref: "${{ github.sha }}"', text)
                self.assertIn('test "$GITHUB_REF" = refs/heads/main', text)
                self.assertIn('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"', text)
                self.assertIn('python scripts/persist_caption_evidence.py --kind ' + kind, text)
                persist = text.split('      - name: Persist ', 1)[1].split('      - name:', 1)[0]
                self.assertIn('if: ${{ !cancelled() }}', persist)
                self.assertNotIn('git pull --rebase', text)
                self.assertNotIn('git push origin HEAD:main', text)

    def shard_persist_step(self, ref='refs/heads/main'):
        text = (ROOT / '.github/workflows/shot-render-farm.yml').read_text()
        step = text.split('      - name: Persist farm receipt\n', 1)[1].split('      - name:', 1)[0]
        self.assertIn("if: ${{ success() && github.ref == 'refs/heads/main' }}", step)
        self.assertNotIn('rebase', step)
        shell = '\n'.join(line[10:] for line in step.split('        run: |\n', 1)[1].splitlines() if line.startswith('          '))
        self.write('state/shot-render-farm-health.json', {'status': 'PASS', 'publication_enabled': False, 'fixture_only': True})
        (self.repo / 'public-review/reference-clone-sharded-preview.mp4').write_bytes(b'offline persistence fixture')
        return subprocess.run(['bash', '-e', '-o', 'pipefail', '-c', shell], cwd=self.repo,
                              env={**os.environ, 'GITHUB_REF': ref, 'GITHUB_SHA': self.source},
                              capture_output=True, text=True, timeout=15)

    def test_exact_shard_persistence_step_accepts_unchanged_main(self):
        result = self.shard_persist_step()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.remote_file('public-review/reference-clone-sharded-preview.mp4'), b'offline persistence fixture')

    def test_exact_shard_persistence_step_rejects_advanced_main(self):
        self.advance('unrelated.txt', 'new source commit')
        head = self.git('--git-dir', str(self.remote), 'rev-parse', 'main')
        result = self.shard_persist_step()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('refusing stale preview persistence', result.stdout)
        self.assertEqual(self.git('--git-dir', str(self.remote), 'rev-parse', 'main'), head)

    def test_exact_shard_persistence_step_rejects_non_main_dispatch(self):
        result = self.shard_persist_step('refs/heads/topic')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.git('--git-dir', str(self.remote), 'rev-parse', 'main').decode().strip(), self.source)


if __name__ == '__main__':
    unittest.main()
