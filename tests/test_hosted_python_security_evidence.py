"""SYNTHETIC offline API/scan fixtures. No real hosted audit is claimed."""
import copy
import io
import json
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
import warnings
import zipfile
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import verify_hosted_python_security_evidence as v


class HostedPythonTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='synthetic-python-evidence-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for name in v.SCOPES.values():
            (self.root / name).write_text('synthetic-package==1.0.0\n')
        self.git('init', '--quiet')
        self.git('config', 'user.name', 'Synthetic Fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.git('add', '.')
        self.git('commit', '--quiet', '-m', 'Synthetic test fixture only')
        self.source, self.manifests = v.snapshot(self.root)
        self.identity = dict(SOURCE_SHA=self.source, SOURCE_REF='refs/heads/main', REPOSITORY='fixture/repository',
                             WORKFLOW_PATH=v.WORKFLOW, RUN_ID='123', RUN_ATTEMPT='1')
        self.files = dict(self.manifests)
        for scope in v.SCOPES:
            self.files[scope+'-audit.json'] = v.encode({'dependencies': [{'name': 'synthetic-package', 'version': '1.0.0', 'vulns': []}]})
            self.files[scope+'-exit'] = b'0\n'
        self.refresh_report_receipt()
        self.run = dict(id=123, status='completed', conclusion='success', head_sha=self.source, head_branch='main',
                        path=v.WORKFLOW, repository={'full_name': 'fixture/repository'},
                        head_repository={'full_name': 'fixture/repository'}, event='push', run_attempt=1)
        self.zip_calls = 0
        self.artifact_overrides = {}
        self.run_mutation = None

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, text=True).strip()

    def refresh_report_receipt(self):
        with tempfile.TemporaryDirectory() as t:
            p = Path(t)
            for name, data in self.files.items():
                (p/name).write_bytes(data)
            self.files[v.REPORT] = v.encode(v.normalize(p, p))
            (p/v.REPORT).write_bytes(self.files[v.REPORT])
            self.files[v.RECEIPT] = v.encode(v.build_receipt(p, self.identity))

    def archive(self, files=None):
        out = io.BytesIO()
        with zipfile.ZipFile(out, 'w') as z:
            for name, data in (files or self.files).items():
                z.writestr(name, data)
        return out.getvalue()

    def get(self, route, binary=False):
        if route.endswith('/runs/123'):
            if self.run_mutation:
                self.run_mutation()
            return copy.deepcopy(self.run)
        if '/artifacts?' in route:
            archive = self.archive()
            artifact = dict(id=456, name=f'python-security-audit-{self.source}-123-1', size_in_bytes=len(archive),
                            digest='sha256:'+v.sha(archive), expired=False, workflow_run={'id': 123, 'head_sha': self.source})
            artifact.update(self.artifact_overrides)
            return {'artifacts': [artifact]}
        self.assertEqual(route, 'repos/fixture/repository/actions/artifacts/456/zip')
        self.zip_calls += 1
        return self.archive()

    def retrieve(self):
        return v.retrieve_verified(self.root, self.source, 'fixture/repository', 123, api=self)

    def test_synthetic_main_success_clean_checkout_unchanged(self):
        result = self.retrieve()
        self.assertEqual(result['report']['status'], 'PASS')
        self.assertEqual(result['origin'], 'github_actions')
        self.assertEqual(self.git('status', '--porcelain'), '')

    def test_reject_run_identity_variants(self):
        for key, value in [('head_sha', '0'*40), ('head_branch', 'feature'), ('path', 'wrong.yml'), ('run_attempt', 0),
                           ('conclusion', 'failure'), ('event', 'pull_request'), ('repository', {'full_name': 'other/repo'})]:
            with self.subTest(key=key):
                saved = self.run[key]; self.run[key] = value
                with self.assertRaises(ValueError): self.retrieve()
                self.run[key] = saved
        self.assertEqual(self.zip_calls, 0)

    def test_oversize_expired_missing_digest_rejected_before_download(self):
        for overrides in [{'size_in_bytes': v.LIMIT+1}, {'size_in_bytes': True}, {'expired': True}, {'digest': None},
                          {'workflow_run': {'id': 999, 'head_sha': self.source}}]:
            self.artifact_overrides = overrides
            with self.assertRaises(ValueError): self.retrieve()
        self.assertEqual(self.zip_calls, 0)

    def test_server_digest_tampering(self):
        self.artifact_overrides = {'digest': 'sha256:'+'0'*64}
        with self.assertRaises(ValueError): self.retrieve()

    def test_unsigned_normalized_pass_cannot_replace_raw_scan(self):
        self.files['qa-audit.json'] = b'{}'
        with self.assertRaises(ValueError): self.retrieve()

    def test_rehashed_finding_or_error_still_rejected(self):
        for raw, code in [({'dependencies': [{'name': 'synthetic-package', 'version': '1.0.0', 'vulns': [{'id': 'SYNTHETIC-1'}]}]}, b'1'), ({}, b'2')]:
            self.files['qa-audit.json'] = v.encode(raw); self.files['qa-exit'] = code
            self.refresh_report_receipt()
            with self.assertRaises(ValueError): self.retrieve()

    def test_manifest_mismatch_even_with_rehashed_receipt(self):
        self.files['requirements-transcription.txt'] = b'synthetic-package==2.0.0\n'
        self.refresh_report_receipt()
        with self.assertRaises(ValueError): self.retrieve()

    def test_receipt_identity_mismatch(self):
        self.identity['RUN_ID'] = '999'; self.refresh_report_receipt()
        with self.assertRaises(ValueError): self.retrieve()

    def test_checkout_race_and_dirty_source(self):
        self.run_mutation = lambda: (self.root/'untracked.py').write_text('synthetic change')
        with self.assertRaises(ValueError): self.retrieve()
        with self.assertRaises(ValueError): self.retrieve()

    def test_hidden_protected_source_changes_rejected(self):
        path = self.root/'audit-workflow.py'
        path.write_text('synthetic protected source\n')
        self.git('add', '.')
        self.git('commit', '--quiet', '-m', 'Synthetic protected source')
        self.source, self.manifests = v.snapshot(self.root)
        self.identity['SOURCE_SHA'] = self.source
        self.run['head_sha'] = self.source
        self.refresh_report_receipt()
        for flag in ('assume-unchanged', 'skip-worktree'):
            with self.subTest(flag=flag):
                self.git('update-index', '--'+flag, 'audit-workflow.py')
                path.write_text('altered protected source\n')
                self.assertEqual(self.git('status', '--porcelain'), '')
                with self.assertRaises(ValueError): self.retrieve()
                path.write_text('synthetic protected source\n')
                self.git('update-index', '--no-'+flag, 'audit-workflow.py')
        self.assertEqual(self.zip_calls, 0)
        self.assertEqual(self.retrieve()['report']['status'], 'PASS')

    def test_ignored_executable_source_rejected(self):
        (self.root/'.gitignore').write_text('ignored-source.py\n')
        self.git('add', '.')
        self.git('commit', '--quiet', '-m', 'Synthetic ignored source policy')
        self.source, self.manifests = v.snapshot(self.root)
        self.identity['SOURCE_SHA'] = self.source
        self.run['head_sha'] = self.source
        self.refresh_report_receipt()
        ignored = self.root/'ignored-source.py'
        ignored.write_text('#!/usr/bin/env python3\n')
        ignored.chmod(0o755)
        self.assertEqual(self.git('status', '--porcelain'), '')
        with self.assertRaises(ValueError): self.retrieve()
        self.assertEqual(self.zip_calls, 0)

    def test_symlink_manifest_rejected(self):
        p = self.root/'requirements-transcription.txt'; p.unlink(); p.symlink_to('requirements-pod-runtime.txt')
        self.git('add', '.'); self.git('commit', '--quiet', '-m', 'Synthetic symlink')
        with self.assertRaises(ValueError): v.snapshot(self.root)

    def test_zip_path_duplicate_and_symlink_rejected(self):
        for name in ['../escape', 'unexpected']:
            with self.assertRaises(ValueError): v.unpack(self.archive({**self.files, name: b'x'}))
        duplicate = io.BytesIO()
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', UserWarning)
            with zipfile.ZipFile(duplicate, 'w') as z:
                for name, data in self.files.items():
                    z.writestr(name, data)
                z.writestr('qa-exit', b'0')
        with self.assertRaises(ValueError): v.unpack(duplicate.getvalue())
        out = io.BytesIO()
        with zipfile.ZipFile(out, 'w') as z:
            for name, data in self.files.items():
                info = zipfile.ZipInfo(name)
                info.external_attr = (stat.S_IFLNK | 0o777) << 16 if name == 'qa-exit' else (stat.S_IFREG | 0o600) << 16
                z.writestr(info, data)
        with self.assertRaises(ValueError): v.unpack(out.getvalue())

    def test_producer_has_no_raw_input_fallback(self):
        with tempfile.TemporaryDirectory() as t:
            (Path(t)/v.REPORT).write_bytes(self.files[v.REPORT])
            with self.assertRaises(ValueError): v.build_receipt(t, self.identity)


if __name__ == '__main__':
    unittest.main()
