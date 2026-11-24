"""Offline tests for authenticated, read-only live deployment evidence loading."""
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import load_live_deployment_evidence as live


class API:
    def __init__(self, routes):
        self.routes = routes
    def get(self, route, binary=False):
        value = self.routes[route]
        if isinstance(value, Exception):
            raise value
        return value


class MutatingAPI(API):
    def __init__(self, routes, path, replacement):
        super().__init__(routes)
        self.path = path
        self.replacement = replacement
        self.mutated = False
    def get(self, route, binary=False):
        if route.endswith('/zip') and not self.mutated:
            self.path.write_bytes(self.replacement)
            self.mutated = True
        return super().get(route, binary)


def archive(files):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w') as zipped:
        for name, data in files.items():
            zipped.writestr(name, data)
    return stream.getvalue()


def mutate_artifact(routes, mutate):
    zip_route = next(key for key in routes if key.endswith('/zip'))
    with zipfile.ZipFile(io.BytesIO(routes[zip_route])) as zipped:
        files = {name: zipped.read(name) for name in zipped.namelist()}
    mutate(files)
    receipt = json.loads(files['provenance.json'])
    receipt['file_sha256'] = {
        name: hashlib.sha256(data).hexdigest()
        for name, data in files.items() if name != 'provenance.json'
    }
    files['provenance.json'] = json.dumps(receipt).encode()
    zipped = archive(files)
    routes[zip_route] = zipped
    artifact_route = next(key for key in routes if key.endswith('artifacts?per_page=100&page=1'))
    item = routes[artifact_route]['artifacts'][0]
    item['size_in_bytes'] = len(zipped)
    item['digest'] = 'sha256:' + hashlib.sha256(zipped).hexdigest()


class LiveEvidenceTests(unittest.TestCase):
    def fixture(self):
        temporary = tempfile.TemporaryDirectory()
        root = Path(temporary.name)
        subprocess.run(['git', 'init', '--quiet'], cwd=root, check=True)
        subprocess.run(['git', 'config', 'user.name', 'Fixture'], cwd=root, check=True)
        subprocess.run(['git', 'config', 'user.email', 'fixture@example.invalid'], cwd=root, check=True)
        for name in live.CRITICAL:
            target = root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        video = b'v' * 2048
        target = root / 'public-review/episode1-v10-free.mp4'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(video)
        captions = b'WEBVTT\n\n00:00.000 --> 00:01.000\nFixture\n'
        (root / 'public-review/episode1-v10-free.vtt').write_bytes(captions)
        subprocess.run(['git', 'add', '.'], cwd=root, check=True)
        subprocess.run(['git', 'commit', '--quiet', '-m', 'fixture'], cwd=root, check=True)
        source = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
        candidate = hashlib.sha256(video).hexdigest()
        caption = hashlib.sha256(captions).hexdigest()
        report = {
            'schema_version': 1, 'status': 'PASS',
            'public_base_url': 'https://review.synthetic.invalid',
            'candidate_sha256': candidate, 'caption_sha256': caption,
            'live_expected_sha256': candidate, 'live_actual_sha256': candidate,
            'expected_source_commit': source, 'deployed_source_commit': source,
            'checks': {name: True for name in live.EXPECTED_CHECKS},
            'failed_checks': [],
            'publication_enabled': False,
        }
        health = {
            'ok': True, 'publication': False, 'hashBound': True,
            'captionReady': True, 'expectedSha256': candidate,
            'actualSha256': candidate, 'captionSha256': caption,
            'deployed_source_commit': source,
        }
        payload = {
            'live-deployment-health.json': json.dumps(report).encode(),
            'health.json': json.dumps(health).encode(),
            'watch.html': (f'<video src="/media?sha256={candidate}"><track '
                           f'src="/captions?sha256={caption}">').encode(),
            'media.headers': b'HTTP/2 206\naccept-ranges: bytes\ncontent-range: bytes 0-1023/2048\n',
            'captions.headers': b'HTTP/2 200\ncontent-type: text/vtt\n',
            'captions.vtt': captions,
            'range.bin': video[:1024],
        }
        run_id, attempt, artifact_id = 41, 2, 83
        provenance = {
            'receipt_schema_version': 1, 'origin': 'github_actions',
            'SOURCE_SHA': source, 'RUN_ID': str(run_id),
            'RUN_ATTEMPT': str(attempt), 'REPOSITORY': 'wecreates/content-control',
            'WORKFLOW_PATH': live.WORKFLOW,
            'file_sha256': {name: hashlib.sha256(data).hexdigest()
                            for name, data in payload.items()},
        }
        payload['provenance.json'] = json.dumps(provenance).encode()
        zipped = archive(payload)
        run = {
            'id': run_id, 'run_number': 9, 'status': 'completed',
            'conclusion': 'success', 'head_sha': source, 'path': live.WORKFLOW,
            'repository': {'full_name': 'wecreates/content-control'},
            'head_repository': {'full_name': 'wecreates/content-control'},
            'event': 'push', 'head_branch': 'main', 'run_attempt': attempt,
        }
        wanted = f'live-render-deployment-smoke-{source}-{run_id}-{attempt}'
        artifact = {
            'id': artifact_id, 'name': wanted, 'size_in_bytes': len(zipped),
            'expired': False, 'digest': 'sha256:' + hashlib.sha256(zipped).hexdigest(),
            'workflow_run': {'id': run_id, 'head_sha': source},
        }
        base = 'repos/wecreates/content-control'
        routes = {
            f'{base}/actions/workflows/live-render-deployment-smoke.yml/runs?branch=main&per_page=10':
                {'workflow_runs': [dict(run)]},
            f'{base}/actions/runs/{run_id}': dict(run),
            f'{base}/actions/runs/{run_id}/artifacts?per_page=100&page=1': {'artifacts': [artifact]},
            f'{base}/actions/artifacts/{artifact_id}/zip': zipped,
        }
        return temporary, root, report, routes, run

    def test_success_is_source_bound_and_read_only(self):
        temporary, root, report, routes, _ = self.fixture()
        with temporary:
            before = subprocess.check_output(['git', 'status', '--porcelain'], cwd=root)
            result = live.load_live_deployment_report(
                root, 'wecreates/content-control', API(routes), include_identity=True)
            after = subprocess.check_output(['git', 'status', '--porcelain'], cwd=root)
            self.assertEqual(result['status'], report['status'])
            self.assertEqual(result['hosted_identity']['run_id'], 41)
            self.assertEqual(before, after)

    def test_failed_newest_exact_run_never_falls_back(self):
        temporary, root, _, routes, run = self.fixture()
        with temporary:
            older = dict(run, id=40, run_number=8)
            listing = next(key for key in routes if '/workflows/' in key)
            routes[listing]['workflow_runs'] = [older, dict(run, conclusion='failure')]
            run_route = next(key for key in routes if key.endswith('/actions/runs/41'))
            routes[run_route]['conclusion'] = 'failure'
            result = live.load_live_deployment_report(root, 'wecreates/content-control', API(routes))
            self.assertEqual(result['status'], 'ERROR')

    def test_digest_and_source_mutation_fail_closed(self):
        for mutation in ('digest', 'source'):
            temporary, root, _, routes, _ = self.fixture()
            with self.subTest(mutation=mutation), temporary:
                if mutation == 'digest':
                    artifact_route = next(key for key in routes if key.endswith('artifacts?per_page=100&page=1'))
                    routes[artifact_route]['artifacts'][0]['digest'] = 'sha256:' + '0' * 64
                else:
                    (root / 'scripts/live_probe_identity.py').write_text('changed\n')
                result = live.load_live_deployment_report(root, 'wecreates/content-control', API(routes))
                self.assertEqual(result['status'], 'ERROR')

    def test_dirty_canonical_media_tail_fails_closed(self):
        for name in live.CANONICAL_MEDIA:
            temporary, root, _, routes, _ = self.fixture()
            with self.subTest(name=name), temporary:
                path = root / name
                data = path.read_bytes()
                path.write_bytes(data[:-1] + bytes([data[-1] ^ 1]))
                result = live.load_live_deployment_report(root, 'wecreates/content-control', API(routes))
                self.assertEqual(result['status'], 'ERROR')

    def test_concurrent_canonical_media_swap_fails_closed(self):
        for name in live.CANONICAL_MEDIA:
            temporary, root, _, routes, _ = self.fixture()
            with self.subTest(name=name), temporary:
                path = root / name
                data = path.read_bytes()
                replacement = data[:-1] + bytes([data[-1] ^ 1])
                api = MutatingAPI(routes, path, replacement)
                result = live.load_live_deployment_report(root, 'wecreates/content-control', api)
                self.assertTrue(api.mutated)
                self.assertEqual(result['status'], 'ERROR')

    def test_report_requires_exact_checks_and_empty_failures(self):
        for mutation in ('missing_check', 'extra_check', 'non_boolean_check', 'failed_checks',
                         'candidate', 'caption'):
            temporary, root, _, routes, _ = self.fixture()
            with self.subTest(mutation=mutation), temporary:
                def change(files):
                    report = json.loads(files['live-deployment-health.json'])
                    if mutation == 'missing_check':
                        report['checks'].pop('probe_completed')
                    elif mutation == 'extra_check':
                        report['checks']['unrecognized'] = True
                    elif mutation == 'non_boolean_check':
                        report['checks']['probe_completed'] = 1
                    elif mutation == 'failed_checks':
                        report['failed_checks'] = ['probe_completed']
                    elif mutation == 'candidate':
                        report['candidate_sha256'] = '0' * 64
                    else:
                        report['caption_sha256'] = '0' * 64
                    files['live-deployment-health.json'] = json.dumps(report).encode()
                mutate_artifact(routes, change)
                result = live.load_live_deployment_report(root, 'wecreates/content-control', API(routes))
                self.assertEqual(result['status'], 'ERROR')

    def test_each_authenticated_run_boundary_fails_closed(self):
        mutations = {
            'status': 'in_progress', 'conclusion': 'failure',
            'head_sha': '0' * 40, 'path': '.github/workflows/other.yml',
            'event': 'pull_request', 'head_branch': 'feature', 'run_attempt': 0,
            'repository': {'full_name': 'other/content-control'},
            'head_repository': {'full_name': 'other/content-control'},
        }
        for field, value in mutations.items():
            temporary, root, _, routes, _ = self.fixture()
            with self.subTest(field=field), temporary:
                run_route = next(key for key in routes if key.endswith('/actions/runs/41'))
                routes[run_route][field] = value
                result = live.load_live_deployment_report(root, 'wecreates/content-control', API(routes))
                self.assertEqual(result['status'], 'ERROR')

    def test_artifact_identity_and_exact_members_fail_closed(self):
        for mutation in ('expired', 'zero_size', 'wrong_run', 'wrong_source',
                         'duplicate', 'missing_member', 'extra_member'):
            temporary, root, _, routes, _ = self.fixture()
            with self.subTest(mutation=mutation), temporary:
                artifact_route = next(key for key in routes if key.endswith('artifacts?per_page=100&page=1'))
                items = routes[artifact_route]['artifacts']
                item = items[0]
                if mutation == 'expired':
                    item['expired'] = True
                elif mutation == 'zero_size':
                    item['size_in_bytes'] = 0
                elif mutation == 'wrong_run':
                    item['workflow_run']['id'] = 99
                elif mutation == 'wrong_source':
                    item['workflow_run']['head_sha'] = '0' * 40
                elif mutation == 'duplicate':
                    items.append(dict(item))
                else:
                    def change(files):
                        if mutation == 'missing_member':
                            files.pop('watch.html')
                        else:
                            files['unexpected.txt'] = b'unexpected'
                    mutate_artifact(routes, change)
                result = live.load_live_deployment_report(root, 'wecreates/content-control', API(routes))
                self.assertEqual(result['status'], 'ERROR')

    def test_wrong_run_identity_or_payload_fails_closed(self):
        for mutation in ('path', 'publication'):
            temporary, root, _, routes, _ = self.fixture()
            with self.subTest(mutation=mutation), temporary:
                if mutation == 'path':
                    run_route = next(key for key in routes if key.endswith('/actions/runs/41'))
                    routes[run_route]['path'] = '.github/workflows/other.yml'
                else:
                    zip_route = next(key for key in routes if key.endswith('/zip'))
                    # Any post-upload byte change is caught by the server digest.
                    routes[zip_route] += b'x'
                result = live.load_live_deployment_report(root, 'wecreates/content-control', API(routes))
                self.assertEqual(result['status'], 'ERROR')


if __name__ == '__main__':
    unittest.main()
