"""Adversarial fixtures use real local Git repositories, never a remote."""
from dataclasses import FrozenInstanceError
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import npm_security_source_equivalence as policy


class SourceEquivalenceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='npm-source-equivalence-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / 'repo'
        self.root.mkdir()
        self.env = {'PATH': os.environ['PATH'], 'HOME': self.temporary.name,
                    'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': os.devnull,
                    'GIT_AUTHOR_NAME': 'Local Fixture', 'GIT_AUTHOR_EMAIL': 'fixture@example.invalid',
                    'GIT_COMMITTER_NAME': 'Local Fixture', 'GIT_COMMITTER_EMAIL': 'fixture@example.invalid'}
        self.git('init', '--quiet', '--initial-branch=main')
        self.files = {
            'package.json': '{"name":"fixture"}\n',
            'package-lock.json': '{"lockfileVersion":3}\n',
            'server-lowmem.js': 'export const value=1;\n',
            '.github/workflows/runtime-security-audit.yml': 'permissions: {contents: read}\n',
            '.github/workflows/free-production-watchdog.yml': 'name: watchdog fixture\n',
            'scripts/import_hosted_npm_security_evidence.py': '# importer fixture\n',
            'scripts/verify_free_production_health.py': '# consumer fixture\n',
            'state/content-control-health.json': '{"status":"NOT_ACCEPTED"}\n',
            'state/canonical-workflow-registry.json': '{}\n',
            '.gitignore': 'ignored-cache/\n*.pyc\n',
            **{path: '{"status":"FAIL"}\n' for path in policy.GENERATED_WATCHDOG},
            policy.CANONICAL_NPM[0]: '{}\n',
        }
        for relative, text in self.files.items():
            self.write(relative, text)
        self.write('scripts/npm_security_source_equivalence.py', Path(policy.__file__).read_text())
        self.git('add', '.')
        self.commit('Audited fixture')
        self.source = self.head()

    def git(self, *args, check=True):
        result = subprocess.run(['git', *args], cwd=self.root, env=self.env,
                                capture_output=True, text=True, timeout=20)
        if check and result.returncode:
            self.fail('Local fixture Git failed: ' + result.stderr)
        return result.stdout.strip()

    def write(self, relative, text):
        target = self.root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)

    def commit(self, message='Fixture change'):
        self.git('commit', '--quiet', '-m', message)

    def head(self):
        return self.git('rev-parse', 'HEAD')

    def verify(self, **kwargs):
        return policy.assert_source_equivalent(self.root, self.source, **kwargs)

    def rejected(self, **kwargs):
        with self.assertRaises(policy.SourceEquivalenceError):
            self.verify(**kwargs)

    def test_exact_source_passes_with_immutable_stable_snapshot(self):
        first = self.verify(expected_head=self.source)
        self.assertEqual(first, self.verify())
        self.assertEqual(first.head_sha, self.source)
        self.assertEqual(first.audited_sha, self.source)
        self.assertEqual(first.policy_version, policy.POLICY_VERSION)
        with self.assertRaises(FrozenInstanceError):
            first.head_sha = '0' * 40

    def test_all_six_generated_outputs_can_change_without_interpreting_status(self):
        for path in policy.GENERATED_WATCHDOG:
            self.write(path, '{"status":"FAIL","not_a_health_verdict":true}\n')
        dirty = self.verify()
        self.git('add', 'state')
        staged = self.verify()
        self.commit()
        committed = self.verify(expected_head=self.head())
        self.assertNotEqual(dirty.index_sha256, staged.index_sha256)
        self.assertNotEqual(committed.head_sha, self.source)

    def test_canonical_pair_updates_and_additions_allowed(self):
        before = self.verify()
        for path in policy.CANONICAL_NPM:
            self.write(path, '{"unverified_fixture":true}\n')
        self.assertNotEqual(before.worktree_sha256, self.verify().worktree_sha256)
        self.git('add', 'state')
        self.verify()
        self.commit()
        self.verify()

    def test_missing_generated_output_can_be_added_as_regular_file(self):
        path = policy.GENERATED_WATCHDOG[0]
        self.git('rm', path)
        self.commit()
        self.source = self.head()
        self.write(path, '{}\n')
        self.verify()
        self.git('add', path)
        self.verify()
        self.commit()
        self.verify()

    def test_generated_payload_changes_are_in_snapshot(self):
        first = self.verify()
        self.write(policy.GENERATED_WATCHDOG[0], '{"changed":true}\n')
        second = self.verify()
        self.assertNotEqual(first.worktree_sha256, second.worktree_sha256)
        self.assertEqual(first.head_sha, second.head_sha)
        self.assertEqual(first.index_sha256, second.index_sha256)

    def test_target_head_is_separate_from_audited_source(self):
        self.write(policy.GENERATED_WATCHDOG[0], '{}\n')
        self.git('add', 'state')
        self.commit()
        self.verify(expected_head=self.head())
        self.rejected(expected_head=self.source)

    def test_committed_protected_changes_rejected(self):
        for path in ('package.json', 'package-lock.json', 'server-lowmem.js',
                     '.github/workflows/runtime-security-audit.yml',
                     '.github/workflows/free-production-watchdog.yml',
                     'scripts/npm_security_source_equivalence.py',
                     'scripts/import_hosted_npm_security_evidence.py',
                     'scripts/verify_free_production_health.py',
                     'state/canonical-workflow-registry.json', 'state/content-control-health.json'):
            with self.subTest(path=path):
                self.write(path, 'changed\n')
                self.git('add', path)
                self.commit()
                self.rejected()
                self.git('reset', '--hard', self.source)

    def test_unknown_state_committed_dirty_and_untracked_rejected(self):
        self.write('state/new-health.json', '{}\n')
        self.rejected()
        self.git('add', 'state/new-health.json')
        self.rejected()
        self.commit()
        self.rejected()

    def test_existing_source_dirty_and_staged_changes_rejected(self):
        self.write('server-lowmem.js', 'changed\n')
        self.rejected()
        self.git('add', 'server-lowmem.js')
        self.rejected()
        self.write('server-lowmem.js', self.files['server-lowmem.js'])
        self.rejected()

    def test_untracked_executable_and_ignored_cache_rejected(self):
        for path in ('new-source.js', 'ignored-cache/hidden.js', 'cached.pyc', 'state/runtime-security-audit.json.bak'):
            with self.subTest(path=path):
                self.write(path, 'untracked\n')
                self.rejected()
                (self.root / path).unlink()

    def test_protected_rename_and_delete_rejected(self):
        self.git('mv', 'server-lowmem.js', 'renamed.js')
        self.rejected()
        self.commit()
        self.rejected()
        self.git('reset', '--hard', self.source)
        self.git('rm', 'server-lowmem.js')
        self.rejected()
        self.commit()
        self.rejected()

    def test_existing_evidence_deletion_rejected_at_every_layer(self):
        for path in (*policy.GENERATED_WATCHDOG, policy.CANONICAL_NPM[0]):
            with self.subTest(path=path):
                (self.root / path).unlink()
                self.rejected()
                self.git('add', '-u')
                self.rejected()
                self.commit()
                self.rejected()
                self.git('reset', '--hard', self.source)

    def test_evidence_rename_to_another_allowlisted_path_rejected(self):
        self.git('mv', policy.GENERATED_WATCHDOG[0], policy.CANONICAL_NPM[1])
        self.rejected()
        self.commit()
        self.rejected()

    def test_evidence_executable_mode_rejected_in_worktree_index_and_commit(self):
        path = self.root / policy.GENERATED_WATCHDOG[0]
        path.chmod(0o755)
        self.rejected()
        self.git('add', 'state')
        path.chmod(0o644)
        self.rejected()
        self.commit()
        self.rejected()

    def test_bad_evidence_mode_at_audited_source_is_rejected(self):
        (self.root / policy.GENERATED_WATCHDOG[0]).chmod(0o755)
        self.git('add', 'state')
        self.commit()
        self.source = self.head()
        self.rejected()

    def test_new_canonical_executable_mode_rejected(self):
        self.write(policy.CANONICAL_NPM[1], '{}\n')
        (self.root / policy.CANONICAL_NPM[1]).chmod(0o755)
        self.rejected()

    def test_protected_mode_change_rejected_even_when_git_filemode_disabled(self):
        self.git('config', 'core.fileMode', 'false')
        (self.root / 'server-lowmem.js').chmod(0o755)
        self.rejected()
        (self.root / 'server-lowmem.js').chmod(0o644)
        self.git('update-index', '--chmod=+x', 'server-lowmem.js')
        self.rejected()
        self.commit()
        self.rejected()

    def test_existing_executable_source_is_allowed_when_unchanged(self):
        (self.root / 'server-lowmem.js').chmod(0o755)
        self.git('add', 'server-lowmem.js')
        self.commit()
        self.source = self.head()
        self.verify()

    def test_allowed_symlink_rejected_untracked_staged_committed(self):
        (self.root / policy.CANONICAL_NPM[1]).symlink_to('../package.json')
        self.rejected()
        self.git('add', 'state')
        self.rejected()
        self.commit()
        self.rejected()

    def test_generated_symlink_and_directory_rejected(self):
        target = self.root / policy.GENERATED_WATCHDOG[0]
        target.unlink()
        target.symlink_to('../package.json')
        self.rejected()
        target.unlink()
        target.mkdir()
        self.rejected()

    def test_canonical_parent_symlink_rejected_without_following(self):
        outside = Path(self.temporary.name) / 'other-state'
        (self.root / 'state').rename(outside)
        (self.root / 'state').symlink_to(outside, target_is_directory=True)
        self.rejected()

    def test_unchanged_source_symlink_is_unsupported_even_when_internal(self):
        (self.root / 'source-link').symlink_to('server-lowmem.js')
        self.git('add', 'source-link')
        self.commit()
        self.source = self.head()
        self.rejected()
        (self.root / 'source-link').unlink()
        (self.root / 'source-link').symlink_to('package.json')
        self.rejected()

    def test_assume_unchanged_does_not_hide_source_changes(self):
        self.git('update-index', '--assume-unchanged', 'server-lowmem.js')
        self.write('server-lowmem.js', 'hidden\n')
        self.rejected()

    def test_skip_worktree_does_not_hide_source_changes(self):
        self.git('update-index', '--skip-worktree', 'server-lowmem.js')
        self.write('server-lowmem.js', 'hidden\n')
        self.rejected()

    def test_missing_skip_worktree_source_is_rejected(self):
        self.git('update-index', '--skip-worktree', 'server-lowmem.js')
        (self.root / 'server-lowmem.js').unlink()
        self.rejected()

    def test_same_size_and_mtime_content_tamper_is_rejected(self):
        path = self.root / 'server-lowmem.js'
        before = path.stat()
        self.write('server-lowmem.js', self.files['server-lowmem.js'].replace('=1', '=2'))
        os.utime(path, ns=(before.st_atime_ns, before.st_mtime_ns))
        self.rejected()

    def test_equal_tree_nonancestor_commit_rejected(self):
        tree = self.git('rev-parse', self.source + '^{tree}')
        unrelated = self.git('commit-tree', tree, '-m', 'Unrelated equal tree')
        with self.assertRaises(policy.SourceEquivalenceError):
            policy.assert_source_equivalent(self.root, unrelated)

    def test_bad_source_identifiers_rejected(self):
        for value in (None, '', 'HEAD', self.source[:8], self.source.upper(), '--all', '0' * 40):
            with self.subTest(value=value), self.assertRaises(policy.SourceEquivalenceError):
                policy.assert_source_equivalent(self.root, value)
        tree = self.git('rev-parse', self.source + '^{tree}')
        with self.assertRaises(policy.SourceEquivalenceError):
            policy.assert_source_equivalent(self.root, tree)

    def test_subdirectory_not_repository_root(self):
        with self.assertRaises(policy.SourceEquivalenceError):
            policy.assert_source_equivalent(self.root / 'state', self.source)

    def test_git_grafts_are_rejected(self):
        self.write('.git/info/grafts', self.source + '\n')
        self.rejected()

    def test_git_environment_redirection_is_ignored(self):
        with patch.dict(os.environ, {'GIT_WORK_TREE': str(Path(self.temporary.name) / 'nonexistent'),
                                     'GIT_DIR': '/nonexistent/git', 'GIT_INDEX_FILE': '/nonexistent/index'}):
            self.verify()

    def test_runner_is_readonly_and_receives_no_tokens(self):
        commands = []
        def runner(command, **kwargs):
            commands.append(command)
            self.assertNotIn('GH_TOKEN', kwargs['env'])
            self.assertNotIn('GITHUB_TOKEN', kwargs['env'])
            self.assertNotIn('GIT_WORK_TREE', kwargs['env'])
            return subprocess.run(command, **kwargs)
        self.verify(runner=runner)
        allowed = {'rev-parse', 'cat-file', 'merge-base', 'ls-tree', 'ls-files'}
        self.assertTrue(commands)
        self.assertTrue(all(command[4] in allowed for command in commands))

    def test_head_race_rejected(self):
        changed = False
        def runner(command, **kwargs):
            nonlocal changed
            result = subprocess.run(command, **kwargs)
            if 'ls-tree' in command and not changed:
                changed = True
                self.write(policy.GENERATED_WATCHDOG[0], '{"raced":true}\n')
                self.git('add', 'state')
                self.commit()
            return result
        self.rejected(runner=runner)

    def test_index_race_rejected(self):
        changed = False
        def runner(command, **kwargs):
            nonlocal changed
            result = subprocess.run(command, **kwargs)
            if 'ls-files' in command and not changed:
                changed = True
                self.write(policy.GENERATED_WATCHDOG[0], '{"raced":true}\n')
                self.git('add', 'state')
            return result
        self.rejected(runner=runner)

    def test_unmerged_index_is_rejected(self):
        oid = self.git('rev-parse', self.source + ':server-lowmem.js')
        payload = '0 ' + '0' * 40 + '\tserver-lowmem.js\n100644 ' + oid + ' 1\tserver-lowmem.js\n'
        subprocess.run(['git', 'update-index', '--index-info'], input=payload,
                       cwd=self.root, env=self.env, text=True, check=True)
        self.rejected()

    def test_gitlink_is_rejected(self):
        self.git('update-index', '--add', '--cacheinfo', '160000', self.source, 'submodule')
        self.rejected()
        self.commit()
        self.rejected()

    def test_untracked_fifo_is_rejected_without_reading(self):
        os.mkfifo(self.root / 'untracked-fifo')
        self.rejected()

    def test_protected_newline_path_cannot_evade_comparison(self):
        self.write('state/unknown\nstate/free-production-watchdog.json', '{}\n')
        self.rejected()
        self.git('add', '.')
        self.commit()
        self.rejected()


if __name__ == '__main__':
    unittest.main()
