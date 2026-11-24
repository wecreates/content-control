import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import os
from scripts.review_smoke_inputs import inspect, observed_hash

REPO = Path(__file__).resolve().parents[1]


class SmokeInputTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'state').mkdir()
        (self.root / 'public-review').mkdir()
        self.media = b'SYNTHETIC byte-binding fixture only'
        self.vtt = b'WEBVTT\n\nSYNTHETIC fixture'
        (self.root / 'public-review/episode1-v10-free.mp4').write_bytes(self.media)
        (self.root / 'public-review/episode1-v10-free.vtt').write_bytes(self.vtt)
        self.hash = hashlib.sha256(self.media).hexdigest()
        self.base_url = 'https://synthetic.invalid'
        self.write('content-control-health.json', {'status': 'GREEN', 'publication_enabled': False, 'candidate_sha256': self.hash})
        self.write('caption-health.json', {'status': 'PASS', 'publication_enabled': False, 'candidate_sha256': self.hash, 'caption_sha256': hashlib.sha256(self.vtt).hexdigest()})
        self.write('deployment-contract.json', {'public_base_url': self.base_url})

    def write(self, name, value):
        (self.root / 'state' / name).write_text(json.dumps(value))

    def test_bound_inputs_do_not_grant_production_approval(self):
        result = inspect(self.root)
        self.assertEqual(result['status'], 'INPUTS_BOUND')
        self.assertFalse(result['production_approved'])

    def test_failed_receipt_retains_observed_metadata_without_approval(self):
        self.write('caption-health.json', {'status': 'FAIL', 'publication_enabled': False})
        result = inspect(self.root)
        self.assertEqual(result['status'], 'BLOCKED')
        self.assertIn('caption_receipt_not_pass', result['reasons'])
        self.assertEqual(result['observed']['caption'], hashlib.sha256(self.vtt).hexdigest())
        self.assertNotIn('caption_sha256', result)

    def test_missing_caption_and_changed_candidate_block(self):
        (self.root / 'public-review/episode1-v10-free.vtt').unlink()
        (self.root / 'public-review/episode1-v10-free.mp4').write_bytes(b'SYNTHETIC changed')
        result = inspect(self.root)
        self.assertEqual(result['status'], 'BLOCKED')
        self.assertIn('candidate_binding_missing_or_mismatched', result['reasons'])
        self.assertIn('caption_bytes_missing_or_invalid', result['reasons'])

    def stat_with(self, info, **changes):
        values = {k: getattr(info, k) for k in ('st_dev', 'st_ino', 'st_size', 'st_mtime_ns', 'st_ctime_ns', 'st_mode')}
        return SimpleNamespace(**(values | changes))

    def test_unchanged_file_accepts_different_stat_and_fstat_ctime_semantics(self):
        original = Path.stat
        def path_stat(path, *args, **kwargs):
            info = original(path, *args, **kwargs)
            return self.stat_with(info, st_ctime_ns=info.st_ctime_ns + 1000000000)
        with patch.object(Path, 'stat', path_stat):
            self.assertEqual(inspect(self.root)['status'], 'INPUTS_BOUND')

    def test_path_change_timestamp_still_detects_mutation(self):
        path = self.root / 'public-review/episode1-v10-free.mp4'
        info = path.stat()
        with patch.object(Path, 'stat', side_effect=[info, self.stat_with(info, st_ctime_ns=info.st_ctime_ns + 1)]):
            with self.assertRaisesRegex(ValueError, 'Input replaced'):
                observed_hash(path, 1024)

    def test_descriptor_change_timestamp_still_detects_mutation(self):
        path = self.root / 'public-review/episode1-v10-free.mp4'
        original = os.fstat
        calls = 0
        def fstat(fd):
            nonlocal calls
            calls += 1
            info = original(fd)
            return self.stat_with(info, st_ctime_ns=info.st_ctime_ns + (calls - 1))
        with patch('scripts.review_smoke_inputs.os.fstat', fstat):
            with self.assertRaisesRegex(ValueError, 'Input changed'):
                observed_hash(path, 1024)

    def test_path_replacement_still_detected_even_when_size_and_times_match(self):
        path = self.root / 'public-review/episode1-v10-free.mp4'
        info = path.stat()
        with patch.object(Path, 'stat', side_effect=[info, self.stat_with(info, st_ino=info.st_ino + 1)]):
            with self.assertRaisesRegex(ValueError, 'Input replaced'):
                observed_hash(path, 1024)

    def receipt_script(self, workflow, step):
        source = (REPO / '.github/workflows' / workflow).read_text()
        section = source.split('- name: ' + step, 1)[1]
        script = section.split("python - <<'PY'\n", 1)[1].split('\n          PY', 1)[0]
        return textwrap.dedent(script)

    def test_local_receipt_requires_successful_assertions_not_file_existence(self):
        script = self.receipt_script('review-server-smoke.yml', 'Emit smoke receipt')
        script = script.replace('${{ steps.routes.outcome }}', 'success').replace('${{ steps.corruption.outcome }}', 'failure')
        subprocess.run([sys.executable, '-c', script], cwd=self.root, check=True, capture_output=True)
        receipt = json.loads((self.root / 'state/review-server-smoke.json').read_text())
        self.assertEqual(receipt['status'], 'INCOMPLETE')
        self.assertFalse(receipt['fail_closed_corruption_verified'])

    def test_live_receipt_never_treats_two_missing_hashes_as_match(self):
        self.write('caption-health.json', {'status': 'FAIL'})
        script = self.receipt_script('live-render-deployment-smoke.yml', 'Write live deployment receipt')
        script = script.replace('${{ steps.probe.outcome }}', 'failure').replace('/tmp/live-probe', str(self.root / 'absent').replace('\\', '/'))
        subprocess.run([sys.executable, '-c', script], cwd=self.root, check=True, capture_output=True)
        receipt = json.loads((self.root / 'state/live-deployment-health.json').read_text())
        self.assertEqual(receipt['status'], 'FAIL')
        self.assertFalse(receipt['checks']['caption_hash_matches'])
        self.assertFalse(receipt['checks']['probe_completed'])
        self.assertFalse(receipt['checks']['deployed_source_commit_matches'])

    def test_live_surface_uses_exact_caption_url_and_stale_guard(self):
        source = (REPO / '.github/workflows/live-render-deployment-smoke.yml').read_text()
        self.assertIn('/captions?sha256=$EXPECTED_CAPTION', source)
        self.assertIn('/media?sha256=$EXPECTED', source)
        self.assertIn('verify_live_caption_response.py /tmp/live-probe/media.headers "$EXPECTED"', source)
        self.assertIn('head -c 1024 public-review/episode1-v10-free.mp4 | cmp', source)
        self.assertIn('verify_deployed_source_identity.py /tmp/live-probe/health.json "$EXPECTED_SOURCE_SHA"', source)
        self.assertIn('python scripts/live_probe_identity.py origin/main', source)

    def test_live_evidence_is_artifact_only_and_cannot_advance_main(self):
        source = (REPO / '.github/workflows/live-render-deployment-smoke.yml').read_text()
        self.assertIn('permissions:\n  contents: read\n', source)
        for mutation in ('git add', 'git commit', 'git push', 'gh workflow run'):
            self.assertNotIn(mutation, source)
        self.assertNotIn('Persist live deployment evidence', source)
        self.assertIn('uses: actions/upload-artifact@v4', source)
        artifact = source.split('uses: actions/upload-artifact@v4', 1)[1]
        self.assertIn("if: always() && steps.bundle.outcome == 'success'", artifact)
        self.assertIn('name: live-render-deployment-smoke-${{ github.sha }}-${{ github.run_id }}-${{ github.run_attempt }}', artifact)
        self.assertIn("cp state/live-deployment-health.json \"$bundle/live-deployment-health.json\"", source)
        self.assertIn("'origin':'github_actions'", source)

    def test_live_probe_rejects_stale_captions_or_host_for_same_video(self):
        def git(*args):
            subprocess.run(['git', *args], cwd=self.root, check=True, capture_output=True)

        def commit(message):
            git('add', 'state', 'public-review')
            git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                'commit', '--no-gpg-sign', '-m', message)

        def identity(*args, ref='HEAD', env=None):
            return subprocess.run(
                [sys.executable, str(REPO / 'scripts/live_probe_identity.py'), ref, *args],
                cwd=self.root, env=env, text=True, capture_output=True)

        git('init', '-q')
        commit('Initial snapshot')
        original_sha = hashlib.sha256(self.vtt).hexdigest()
        captured = identity('--capture')
        self.assertEqual(captured.returncode, 0, captured.stderr)
        self.assertEqual(captured.stdout.splitlines(),
                         [f'CANDIDATE_SHA={self.hash}', f'CAPTION_SHA={original_sha}',
                          f'PROBE_BASE_URL={self.base_url}', f'EXPECTED_SOURCE_SHA={subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=self.root, text=True).strip()}'])
        captured_env = dict(os.environ, CANDIDATE_SHA=self.hash, CAPTION_SHA=original_sha,
                            PROBE_BASE_URL=self.base_url,
                            EXPECTED_SOURCE_SHA=captured.stdout.splitlines()[-1].split('=', 1)[1])
        corrected = self.vtt + b' with corrected wording'
        corrected_sha = hashlib.sha256(corrected).hexdigest()
        (self.root / 'public-review/episode1-v10-free.vtt').write_bytes(corrected)
        self.write('caption-health.json', {'status': 'PASS', 'publication_enabled': False,
                                           'candidate_sha256': self.hash, 'caption_sha256': corrected_sha})
        commit('Caption-only correction')
        result = identity(env=captured_env)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('refusing stale live probe evidence', result.stderr)
        captured_env['CAPTION_SHA'] = corrected_sha
        captured_env['EXPECTED_SOURCE_SHA'] = subprocess.check_output(
            ['git', 'rev-parse', 'HEAD'], cwd=self.root, text=True).strip()
        result = identity(env=captured_env)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.write('deployment-contract.json', {'public_base_url': 'https://new.synthetic.invalid'})
        commit('Deployment contract changed')
        result = identity(env=captured_env)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('refusing stale live probe evidence', result.stderr)

    def test_live_probe_rejects_tree_and_blob_object_refs(self):
        def git(*args):
            return subprocess.check_output(['git', *args], cwd=self.root, text=True).strip()

        subprocess.run(['git', 'init', '-q'], cwd=self.root, check=True)
        subprocess.run(['git', 'add', 'state', 'public-review'], cwd=self.root, check=True)
        subprocess.run(['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                        'commit', '--no-gpg-sign', '-m', 'Fixture'], cwd=self.root,
                       check=True, capture_output=True)
        for ref in (git('rev-parse', 'HEAD^{tree}'),
                    git('rev-parse', 'HEAD:state/content-control-health.json')):
            with self.subTest(ref=ref):
                result = subprocess.run(
                    [sys.executable, str(REPO / 'scripts/live_probe_identity.py'), ref, '--capture'],
                    cwd=self.root, text=True, capture_output=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('Cannot read live probe identity', result.stderr)


if __name__ == '__main__':
    unittest.main()
