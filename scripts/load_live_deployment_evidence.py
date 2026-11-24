"""Load a successful, source-bound live deployment receipt from GitHub Actions.

This consumer is read-only.  It accepts only the newest run for the exact
checked-out commit, re-authenticates that run and its artifact through the
official GitHub API, and fails closed instead of falling back to tracked state.
"""
from pathlib import Path
import hashlib
import io
import json
import re
import stat
import subprocess
import sys
import zipfile
import zlib

sys.dont_write_bytecode = True

from import_hosted_npm_security_evidence import GitHubAPI

WORKFLOW = '.github/workflows/live-render-deployment-smoke.yml'
MEMBERS = {
    'live-deployment-health.json', 'health.json', 'watch.html',
    'media.headers', 'captions.headers', 'captions.vtt', 'range.bin',
    'provenance.json',
}
CANONICAL_MEDIA = (
    'public-review/episode1-v10-free.mp4',
    'public-review/episode1-v10-free.vtt',
)
EXPECTED_CHECKS = {
    'probe_completed', 'health_200_and_green', 'publication_disabled',
    'hash_bound', 'expected_hash_matches', 'actual_hash_matches',
    'watch_page_present', 'range_streaming_present', 'captions_present',
    'caption_hash_matches', 'deployed_source_commit_matches',
}
CRITICAL = (
    WORKFLOW,
    'scripts/load_live_deployment_evidence.py',
    'scripts/import_hosted_npm_security_evidence.py',
    'scripts/verify_free_production_health.py',
    'scripts/live_probe_identity.py',
    'scripts/verify_deployed_source_identity.py',
    'scripts/verify_live_caption_response.py',
)
LIMIT = 16 * 1024 * 1024


def sha(data):
    return hashlib.sha256(data).hexdigest()


def _git(root, *args, binary=False):
    result = subprocess.run(['git', *args], cwd=root, capture_output=True,
                            timeout=30, text=not binary)
    if result.returncode:
        raise ValueError('Cannot verify checkout source')
    return result.stdout


def _snapshot(root):
    root = Path(root).resolve()
    top = Path(_git(root, 'rev-parse', '--show-toplevel').strip()).resolve()
    if top != root:
        raise ValueError('Checkout must be the repository root')
    source = _git(root, 'rev-parse', '--verify', 'HEAD^{commit}').strip()
    if not re.fullmatch(r'[0-9a-f]{40}', source):
        raise ValueError('Invalid checkout commit')
    files = {}
    for name in (*CRITICAL, *CANONICAL_MEDIA):
        path = root / name
        if path.is_symlink() or not path.is_file():
            raise ValueError('Critical source and canonical media must be regular files')
        committed = _git(root, 'show', f'HEAD:{name}', binary=True)
        current = path.read_bytes()
        if current != committed:
            raise ValueError('Critical source or canonical media differs from committed HEAD')
        files[name] = sha(current)
    return {
        'source_sha': source,
        'critical_sha256': {name: files[name] for name in CRITICAL},
        'canonical_sha256': {name: files[name] for name in CANONICAL_MEDIA},
    }


def _unpack(archive):
    if not isinstance(archive, bytes) or len(archive) > LIMIT:
        raise ValueError('Artifact exceeds size limit')
    with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
        infos = zipped.infolist()
        if len(infos) != len(MEMBERS) or {item.filename for item in infos} != MEMBERS:
            raise ValueError('Artifact members are missing, duplicated or unexpected')
        if sum(item.file_size for item in infos) > LIMIT:
            raise ValueError('Expanded artifact exceeds size limit')
        for item in infos:
            if item.flag_bits & 1 or stat.S_ISLNK(item.external_attr >> 16):
                raise ValueError('Encrypted or linked artifact member')
        return {name: zipped.read(name) for name in MEMBERS}


def _json(files, name):
    value = json.loads(files[name])
    if not isinstance(value, dict):
        raise ValueError(f'{name} must contain an object')
    return value


def _verify_payload(root, files, expected):
    receipt = _json(files, 'provenance.json')
    required = {
        'receipt_schema_version': 1,
        'origin': 'github_actions',
        'SOURCE_SHA': expected['source_sha'],
        'RUN_ID': str(expected['run_id']),
        'RUN_ATTEMPT': str(expected['run_attempt']),
        'REPOSITORY': expected['repository'],
        'WORKFLOW_PATH': WORKFLOW,
    }
    if any(receipt.get(key) != value for key, value in required.items()):
        raise ValueError('Hosted receipt identity mismatch')
    hashes = receipt.get('file_sha256')
    payload_names = MEMBERS - {'provenance.json'}
    if not isinstance(hashes, dict) or set(hashes) != payload_names:
        raise ValueError('Hosted receipt file manifest mismatch')
    if any(hashes[name] != sha(files[name]) for name in payload_names):
        raise ValueError('Hosted receipt file digest mismatch')

    report = _json(files, 'live-deployment-health.json')
    health = _json(files, 'health.json')
    checks = report.get('checks')
    candidate = report.get('candidate_sha256')
    caption = report.get('caption_sha256')
    if (report.get('schema_version') != 1 or report.get('status') != 'PASS'
            or report.get('publication_enabled') is not False
            or not isinstance(checks, dict) or set(checks) != EXPECTED_CHECKS
            or any(value is not True for value in checks.values())
            or report.get('failed_checks') != []
            or candidate != expected['candidate_sha256']
            or caption != expected['caption_sha256']
            or report.get('expected_source_commit') != expected['source_sha']
            or report.get('deployed_source_commit') != expected['source_sha']
            or report.get('live_expected_sha256') != candidate
            or report.get('live_actual_sha256') != candidate):
        raise ValueError('Live deployment report is not an exact PASS')
    if (health.get('ok') is not True or health.get('publication') is not False
            or health.get('hashBound') is not True or health.get('captionReady') is not True
            or health.get('expectedSha256') != candidate
            or health.get('actualSha256') != candidate
            or health.get('captionSha256') != caption
            or health.get('deployed_source_commit') != expected['source_sha']):
        raise ValueError('Raw live health disagrees with the receipt')

    watch = files['watch.html']
    if (f'src="/media?sha256={candidate}"'.encode() not in watch
            or f'src="/captions?sha256={caption}"'.encode() not in watch):
        raise ValueError('Watch page is not bound to the accepted candidate')
    captions = files['captions.vtt']
    if not captions.startswith(b'WEBVTT') or sha(captions) != caption:
        raise ValueError('Caption response does not match its receipt')
    media_headers = files['media.headers'].lower()
    caption_headers = files['captions.headers'].lower()
    if (b'content-range: bytes 0-1023/' not in media_headers
            or b'accept-ranges: bytes' not in media_headers
            or b'content-type: text/vtt' not in caption_headers):
        raise ValueError('Response headers do not prove the expected surfaces')
    if len(files['range.bin']) != 1024:
        raise ValueError('Range response has the wrong length')
    video = Path(root) / 'public-review/episode1-v10-free.mp4'
    if video.is_symlink() or not video.is_file():
        raise ValueError('Canonical candidate is unavailable')
    with video.open('rb') as stream:
        if files['range.bin'] != stream.read(1024):
            raise ValueError('Live range response does not match the local candidate')
    return report, receipt


def retrieve_verified(checkout, repository, run_id, api=None):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
        raise ValueError('Invalid repository')
    if type(run_id) is not int or run_id <= 0:
        raise ValueError('Invalid run ID')
    root = Path(checkout).resolve()
    before = _snapshot(root)
    source = before['source_sha']
    api = api or GitHubAPI()
    base = f'repos/{repository}'
    run = api.get(f'{base}/actions/runs/{run_id}')
    if (run.get('id') != run_id or run.get('status') != 'completed'
            or run.get('conclusion') != 'success' or run.get('head_sha') != source
            or run.get('path') != WORKFLOW
            or run.get('repository', {}).get('full_name') != repository
            or run.get('head_repository', {}).get('full_name') != repository
            or run.get('event') not in ('push', 'schedule', 'workflow_dispatch')
            or run.get('head_branch') != 'main'
            or type(run.get('run_attempt')) is not int or run['run_attempt'] <= 0):
        raise ValueError('Run identity, source, workflow or completion is not eligible')
    attempt = run['run_attempt']
    wanted = f'live-render-deployment-smoke-{source}-{run_id}-{attempt}'
    matches = []
    for page in range(1, 101):
        listing = api.get(f'{base}/actions/runs/{run_id}/artifacts?per_page=100&page={page}')
        batch = listing.get('artifacts')
        if not isinstance(batch, list) or any(not isinstance(item, dict) for item in batch):
            raise ValueError('Invalid artifact listing')
        matches.extend(item for item in batch if item.get('name') == wanted)
        if len(batch) < 100:
            break
    else:
        raise ValueError('Artifact listing exceeded pagination limit')
    if len(matches) != 1:
        raise ValueError('Exactly one matching artifact is required')
    artifact = matches[0]
    artifact_id = artifact.get('id')
    digest = artifact.get('digest')
    size = artifact.get('size_in_bytes')
    if (type(artifact_id) is not int or artifact_id <= 0
            or type(size) is not int or size <= 0 or size > LIMIT
            or artifact.get('expired') is not False
            or artifact.get('workflow_run', {}).get('id') != run_id
            or artifact.get('workflow_run', {}).get('head_sha') != source
            or not isinstance(digest, str)
            or not re.fullmatch(r'sha256:[0-9a-f]{64}', digest)):
        raise ValueError('Artifact identity or server digest is unavailable')
    archive = api.get(f'{base}/actions/artifacts/{artifact_id}/zip', binary=True)
    if not isinstance(archive, bytes) or 'sha256:' + sha(archive) != digest:
        raise ValueError('GitHub artifact digest mismatch')
    files = _unpack(archive)
    report, receipt = _verify_payload(root, files, {
        'source_sha': source, 'run_id': run_id, 'run_attempt': attempt,
        'repository': repository,
        'candidate_sha256': before['canonical_sha256'][CANONICAL_MEDIA[0]],
        'caption_sha256': before['canonical_sha256'][CANONICAL_MEDIA[1]],
    })
    if _snapshot(root) != before:
        raise ValueError('Checkout changed during verification')
    return {
        'source_sha': source, 'run_id': run_id, 'run_attempt': attempt,
        'artifact_id': artifact_id, 'github_artifact_digest': digest,
        'report': report, 'receipt': receipt,
    }


def load_live_deployment_report(checkout, repository, api=None, *, include_identity=False):
    """Select the newest exact-source run; its state is decisive."""
    try:
        if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
            raise ValueError('Invalid repository')
        root = Path(checkout).resolve()
        source = _snapshot(root)['source_sha']
        api = api or GitHubAPI()
        listing = api.get(
            f'repos/{repository}/actions/workflows/live-render-deployment-smoke.yml/runs'
            '?branch=main&per_page=10')
        runs = listing.get('workflow_runs')
        if not isinstance(runs, list) or len(runs) > 10:
            raise ValueError('Invalid bounded run listing')
        if any(not isinstance(run, dict) or type(run.get('run_number')) is not int
               or run['run_number'] <= 0 for run in runs):
            raise ValueError('Missing workflow run ordering')
        if len({run['run_number'] for run in runs}) != len(runs):
            raise ValueError('Duplicate workflow run ordering')
        exact = [run for run in runs if run.get('head_sha') == source]
        if not exact:
            raise ValueError('No exact-source hosted run')
        selected = max(exact, key=lambda run: run['run_number'])
        if type(selected.get('id')) is not int or selected['id'] <= 0:
            raise ValueError('Malformed run identity')
        bundle = retrieve_verified(root, repository, selected['id'], api)
        if include_identity:
            identity = {key: bundle[key] for key in
                        ('source_sha', 'run_id', 'run_attempt', 'artifact_id',
                         'github_artifact_digest')}
            return dict(bundle['report'], hosted_identity=identity)
        return bundle['report']
    except (OSError, ValueError, TypeError, AttributeError, KeyError, EOFError,
            RuntimeError, NotImplementedError, zipfile.BadZipFile, zlib.error,
            subprocess.SubprocessError):
        return {'schema_version': 1, 'status': 'ERROR', 'checks': {},
                'publication_enabled': False,
                'audit_errors': ['Hosted live deployment evidence verification unavailable']}
