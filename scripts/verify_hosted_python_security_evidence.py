"""Read-only hosted Python audit verification; never promotes, dispatches or deploys.

CLI requires real official GitHub API retrieval. Injectable API is for explicitly
synthetic offline tests only. A returned JSON result is not an offline signature.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import zipfile
sys.dont_write_bytecode = True
from normalize_python_security_audit import SCOPES, normalize
from npm_security_source_equivalence import assert_source_equivalent

WORKFLOW = '.github/workflows/python-security-audit.yml'
REPORT = 'python-security-audit.json'
RECEIPT = 'python-security-audit-provenance.json'
LIMIT = 16 * 1024 * 1024
RAW = {f'{scope}-{suffix}' for scope in SCOPES for suffix in ('audit.json', 'exit')}
MEMBERS = RAW | {REPORT, RECEIPT} | set(SCOPES.values())


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encode(value):
    return (json.dumps(value, sort_keys=True) + '\n').encode()


def snapshot(root):
    root = Path(root).resolve()
    def git(*args):
        result = subprocess.run(['git', *args], cwd=root, capture_output=True, text=True, timeout=30)
        if result.returncode:
            raise ValueError('Cannot verify checkout identity')
        return result.stdout.strip()
    if Path(git('rev-parse', '--show-toplevel')).resolve() != root:
        raise ValueError('Not exact repository root')
    source = git('rev-parse', 'HEAD')
    if not re.fullmatch('[0-9a-f]{40}', source) or git('status', '--porcelain', '--untracked-files=all'):
        raise ValueError('Require clean exact Git checkout')
    # Git status alone can hide assume-unchanged, skip-worktree and ignored
    # source. Independently bind actual working bytes before reading manifests.
    before = assert_source_equivalent(root, source, expected_head=source)
    manifests = {}
    for name in SCOPES.values():
        path = root / name
        if path.is_symlink() or not path.is_file():
            raise ValueError('Manifest must be a regular file')
        manifests[name] = path.read_bytes()
    if assert_source_equivalent(root, source, expected_head=source) != before:
        raise ValueError('Source changed while reading manifests')
    return source, manifests


def build_receipt(directory, identity):
    """Producer only: binds actual existing files, never invents scan results."""
    directory = Path(directory)
    document = json.loads((directory / REPORT).read_bytes())
    if not isinstance(document, dict) or document.get('status') not in ('PASS', 'FAIL', 'ERROR'):
        raise ValueError('Missing normalized report status')
    present = {name for name in MEMBERS - {RECEIPT} if (directory / name).is_file()}
    missing = sorted(MEMBERS - {RECEIPT} - present)
    if missing and document['status'] == 'PASS':
        raise ValueError('PASS report has incomplete raw evidence')
    return {'receipt_schema_version': 1, 'origin': 'github_actions', **identity,
            'missing_files': missing,
            'file_sha256': {name: sha((directory / name).read_bytes()) for name in sorted(present)}}


def unpack(archive):
    if not isinstance(archive, bytes) or len(archive) > LIMIT:
        raise ValueError('Oversized artifact')
    with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
        infos = zipped.infolist()
        if len(infos) != len(MEMBERS) or {x.filename for x in infos} != MEMBERS:
            raise ValueError('Missing, duplicate or unexpected artifact member')
        if sum(x.file_size for x in infos) > LIMIT:
            raise ValueError('Expanded artifact too large')
        for item in infos:
            mode = item.external_attr >> 16
            if item.flag_bits & 1 or (stat.S_IFMT(mode) not in (0, stat.S_IFREG)):
                raise ValueError('Artifact member is encrypted or not a regular file')
        return {name: zipped.read(name) for name in MEMBERS}


def verify_payload(files, expected, manifests):
    if set(files) != MEMBERS:
        raise ValueError('Incomplete evidence')
    receipt = json.loads(files[RECEIPT])
    if not isinstance(receipt, dict) or type(receipt.get('receipt_schema_version')) is not int or receipt['receipt_schema_version'] != 1 or receipt.get('origin') != 'github_actions':
        raise ValueError('Invalid receipt schema')
    if any(receipt.get(k) != v for k, v in expected.items()):
        raise ValueError('Receipt identity mismatch')
    hashes = {name: sha(files[name]) for name in MEMBERS - {RECEIPT}}
    if receipt.get('missing_files') != [] or receipt.get('file_sha256') != hashes or any(files[name] != content for name, content in manifests.items()):
        raise ValueError('Evidence or manifest mismatch')
    # All disk writes are confined to a disposable local temporary directory.
    with tempfile.TemporaryDirectory(prefix='verify-python-audit-') as tmp:
        directory = Path(tmp)
        for name in MEMBERS - {RECEIPT}:
            (directory / name).write_bytes(files[name])
        report = normalize(directory, directory)
    supplied = json.loads(files[REPORT])
    if report != supplied or report['status'] != 'PASS' or report['publication_enabled'] is not False:
        raise ValueError('Raw scans do not reproduce a clean report')
    return report


class GitHubAPI:
    def get(self, route, binary=False):
        result = subprocess.run(['gh', 'api', '--hostname', 'github.com', route], capture_output=True, timeout=120)
        if result.returncode or len(result.stdout) > LIMIT:
            raise ValueError('Official GitHub retrieval failed or exceeded limit')
        return result.stdout if binary else json.loads(result.stdout)


def _retrieve_verified(checkout, expected_sha, repository, run_id, api, snapshotter):
    if not re.fullmatch('[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository) or type(run_id) is not int or run_id <= 0:
        raise ValueError('Invalid repository/run')
    before = snapshotter(checkout)
    if before[0] != expected_sha:
        raise ValueError('Source mismatch')
    api = api or GitHubAPI()
    base = f'repos/{repository}'
    run = api.get(f'{base}/actions/runs/{run_id}')
    if (not isinstance(run, dict) or run.get('id') != run_id or type(run.get('id')) is not int
        or run.get('status') != 'completed' or run.get('conclusion') != 'success'
        or run.get('head_sha') != expected_sha or run.get('head_branch') != 'main'
        or run.get('path') != WORKFLOW or run.get('repository', {}).get('full_name') != repository
        or run.get('head_repository', {}).get('full_name') != repository
        or run.get('event') not in ('push', 'schedule', 'workflow_dispatch')
        or type(run.get('run_attempt')) is not int or run['run_attempt'] <= 0):
        raise ValueError('Ineligible hosted run')
    attempt = run['run_attempt']
    wanted = f'python-security-audit-{expected_sha}-{run_id}-{attempt}'
    artifacts = []
    for page in range(1, 101):
        response = api.get(f'{base}/actions/runs/{run_id}/artifacts?per_page=100&page={page}')
        batch = response.get('artifacts')
        if not isinstance(batch, list) or any(not isinstance(x, dict) for x in batch):
            raise ValueError('Invalid artifact list')
        artifacts.extend(x for x in batch if x.get('name') == wanted)
        if len(batch) < 100:
            break
    else:
        raise ValueError('Artifact pagination exceeded')
    if len(artifacts) != 1:
        raise ValueError('Require exactly one artifact')
    artifact = artifacts[0]
    size, digest, artifact_id = (artifact.get(k) for k in ('size_in_bytes', 'digest', 'id'))
    if (type(size) is not int or not 0 < size <= LIMIT or type(artifact_id) is not int or artifact_id <= 0
        or artifact.get('expired') is not False or artifact.get('workflow_run', {}).get('id') != run_id
        or artifact.get('workflow_run', {}).get('head_sha') != expected_sha
        or not isinstance(digest, str) or not re.fullmatch('sha256:[0-9a-f]{64}', digest)):
        raise ValueError('Invalid artifact identity/digest/size')
    archive = api.get(f'{base}/actions/artifacts/{artifact_id}/zip', binary=True)
    if not isinstance(archive, bytes) or len(archive) > LIMIT or 'sha256:' + sha(archive) != digest:
        raise ValueError('Server artifact digest mismatch')
    report = verify_payload(unpack(archive), {'SOURCE_SHA': expected_sha, 'SOURCE_REF': 'refs/heads/main',
        'REPOSITORY': repository, 'WORKFLOW_PATH': WORKFLOW, 'RUN_ID': str(run_id), 'RUN_ATTEMPT': str(attempt)}, before[1])
    if snapshotter(checkout) != before:
        raise ValueError('Checkout changed during verification')
    return {'origin': 'github_actions', 'source_sha': expected_sha, 'repository': repository,
            'run_id': run_id, 'run_attempt': attempt, 'artifact_id': artifact_id,
            'github_artifact_digest': digest, 'manifest_sha256': {k: sha(v) for k, v in before[1].items()},
            'report': report, 'verification': 'official_github_api_at_verification_time_not_offline_signature'}


def retrieve_verified(checkout, expected_sha, repository, run_id, api=None):
    """Strict original API: require clean exact audited HEAD, never descendants."""
    return _retrieve_verified(checkout, expected_sha, repository, run_id, api, snapshot)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkout', required=True)
    parser.add_argument('--expected-sha', required=True)
    parser.add_argument('--repository', required=True)
    parser.add_argument('--run-id', type=int, required=True)
    args = parser.parse_args()
    try:
        result = retrieve_verified(args.checkout, args.expected_sha, args.repository, args.run_id)
    except (OSError, ValueError, TypeError, AttributeError, KeyError, subprocess.SubprocessError, zipfile.BadZipFile):
        parser.exit(2, 'Hosted Python evidence verification failed.\n')
    print(json.dumps(result, sort_keys=True))


if __name__ == '__main__':
    main()
