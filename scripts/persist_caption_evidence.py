"""Persist caption evidence only while its pinned inputs and receipts are current."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

try:
    from scripts.caption_contract import object_from, sha, snapshot
except ModuleNotFoundError:
    from caption_contract import object_from, sha, snapshot


COMMON_INPUTS = (
    'state/content-control-health.json', 'public/audio/episode1-narration.mp3',
    'state/episode1-factual-contract.json', 'scripts/caption_contract.py',
    'scripts/build_verified_captions.py', 'scripts/verify_captions.py',
    'scripts/free_transcription_qa.py', 'scripts/persist_caption_evidence.py',
    'requirements-transcription.txt',
)
INPUTS = {
    'narration': COMMON_INPUTS + ('.github/workflows/narration-transcription-gate.yml',),
    'reconcile': COMMON_INPUTS + (
        '.github/workflows/candidate-state-reconcile.yml',
        'state/narration-transcription-health.json', 'public-review/episode1-v10-free.mp4',
        'qa-output/free/final-receipt.json', 'scripts/update_acceptance_ledger.py',
        'scripts/verify_acceptance_ledger.py',
    ),
}
OUTPUTS = {
    'narration': ('state/caption-health.json', 'state/narration-transcription-health.json',
                  'public-review/episode1-v10-free.vtt'),
    'reconcile': ('state/caption-health.json', 'public-review/episode1-v10-free.vtt',
                  'state/accepted-candidate-ledger.json', 'state/acceptance-ledger-health.json'),
}


def git(repo, *args, env=None, check=True, input=None):
    result = subprocess.run(['git', '-C', str(repo), *args], input=input,
                            capture_output=True, env=env, timeout=60)
    if check and result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-1500:])
    return result


def blob(repo, commit, path):
    result = git(repo, 'rev-parse', '--verify', f'{commit}:{path}', check=False)
    return result.stdout.decode().strip() if result.returncode == 0 else None


def payload_for(repo, kind, source_bytes):
    cached = dict(source_bytes)
    def read(path):
        if path not in cached:
            cached[path] = snapshot(repo / path)
        return cached[path]
    caption_path = 'state/caption-health.json'
    caption_bytes = read(caption_path)
    caption = object_from(caption_bytes)
    if caption.get('publication_enabled') is not False or caption.get('status') not in ('PASS', 'FAIL'):
        raise ValueError('Publication-disabled caption PASS or FAIL receipt required')
    payload = {caption_path: caption_bytes}
    checks = caption.get('checks')
    if not isinstance(checks, dict):
        raise ValueError('Caption checks object required')
    if caption['status'] == 'FAIL':
        if not caption.get('failed_checks') or checks.get('caption_provenance_valid') is not False:
            raise ValueError('Explicit failed caption provenance check required')
        if kind == 'narration':
            transcription_path = 'state/narration-transcription-health.json'
            try:
                transcription_bytes = read(transcription_path)
                transcription = object_from(transcription_bytes)
            except (OSError, ValueError, RecursionError):
                # Missing/partial ASR output must not suppress the caption FAIL.
                return payload
            # A current-source negative transcription is useful even if ASR setup
            # failed. Never carry a historical PASS forward with failed captions.
            if transcription.get('status') == 'FAIL':
                failed = transcription.get('failed_checks')
                transcript_checks = transcription.get('checks')
                if (transcription.get('publication_enabled') is False
                        and transcription.get('audio_sha256') == sha(read('public/audio/episode1-narration.mp3'))
                        and isinstance(failed, list) and failed
                        and isinstance(transcript_checks, dict)
                        and all(isinstance(name, str) and transcript_checks.get(name) is False for name in failed)):
                    payload[transcription_path] = transcription_bytes
        # Do not carry stale captions or partial acceptance-ledger outputs forward.
        return payload
    health = object_from(read('state/content-control-health.json'))
    if health.get('status') != 'GREEN' or health.get('publication_enabled') is not False or caption.get('candidate_sha256') != health.get('candidate_sha256'):
        raise ValueError('Caption candidate must match current green health')
    bound = {
        'caption_sha256': 'public-review/episode1-v10-free.vtt',
        'transcription_receipt_sha256': 'state/narration-transcription-health.json',
        'caption_contract_sha256': 'state/episode1-factual-contract.json',
        'narration_sha256': 'public/audio/episode1-narration.mp3',
    }
    for field, path in bound.items():
        if caption.get(field) != sha(read(path)):
            raise ValueError('Caption source hash mismatch: ' + field)
    for check in ('source_identity_bound', 'approved_words_match', 'observed_timing_bound', 'candidate_health_green'):
        if checks.get(check) is not True:
            raise ValueError('Passing caption provenance checks required')
    for path in OUTPUTS[kind]:
        payload[path] = read(path)
    if kind == 'reconcile':
        for path in ('state/accepted-candidate-ledger.json', 'state/acceptance-ledger-health.json'):
            value = object_from(payload[path])
            if value.get('publication_enabled') is not False or value.get('current_candidate_sha256') != health.get('candidate_sha256'):
                raise ValueError('Ledger candidate must match current green health')
        if object_from(payload['state/acceptance-ledger-health.json']).get('status') != 'PASS':
            raise ValueError('Passing acceptance-ledger health required')
    return payload


def persist(repo, kind, source_commit, source_ref):
    repo = Path(repo).resolve()
    if source_ref != 'refs/heads/main':
        raise ValueError('Only a main workflow may persist caption evidence')
    if not re.fullmatch(r'[0-9a-f]{40}', source_commit or ''):
        raise ValueError('Pinned full source commit required')
    if git(repo, 'rev-parse', 'HEAD').stdout.decode().strip() != source_commit:
        raise ValueError('Checkout differs from pinned workflow commit')
    source_bytes = {path: snapshot(repo / path, 512 * 1024 * 1024) for path in INPUTS[kind]}
    payload = payload_for(repo, kind, source_bytes)
    watched = tuple(dict.fromkeys(INPUTS[kind] + OUTPUTS[kind]))
    baseline = {path: blob(repo, source_commit, path) for path in watched}
    if any(baseline[path] is None for path in INPUTS[kind]):
        raise ValueError('Pinned source inputs must exist')
    # These are input files, not generated output. Verify local bytes still match
    # the pinned commit before using them to qualify generated evidence.
    for path in INPUTS[kind]:
        actual = git(repo, 'hash-object', '--stdin', input=source_bytes[path]).stdout.decode().strip()
        if actual != baseline[path]:
            raise ValueError('Local source input changed: ' + path)
    with tempfile.TemporaryDirectory(prefix='caption-index-') as temporary:
        env = {**os.environ, 'GIT_INDEX_FILE': str(Path(temporary) / 'index')}
        for _ in range(3):
            git(repo, 'fetch', 'origin', 'main')
            head = git(repo, 'rev-parse', 'origin/main').stdout.decode().strip()
            if git(repo, 'merge-base', '--is-ancestor', source_commit, head, check=False).returncode:
                return {'status': 'SUPERSEDED', 'reason': 'Main no longer descends from source commit'}
            changed = [path for path in watched if blob(repo, head, path) != baseline[path]]
            if changed:
                return {'status': 'SUPERSEDED', 'reason': 'Caption inputs or receipts changed', 'changed_paths': changed}
            git(repo, 'read-tree', head, env=env)
            for path, data in payload.items():
                digest = git(repo, 'hash-object', '-w', '--stdin', input=data).stdout.decode().strip()
                git(repo, 'update-index', '--add', '--cacheinfo', f'100644,{digest},{path}', env=env)
            tree = git(repo, 'write-tree', env=env).stdout.decode().strip()
            if tree == git(repo, 'rev-parse', head + '^{tree}').stdout.decode().strip():
                return {'status': 'UNCHANGED'}
            message = f'Save source-bound {kind} caption evidence [skip ci]\n'
            commit = git(repo, 'commit-tree', tree, '-p', head, input=message.encode()).stdout.decode().strip()
            if git(repo, 'push', 'origin', f'{commit}:refs/heads/main', check=False).returncode == 0:
                return {'status': 'SAVED', 'commit': commit}
        raise RuntimeError('Could not persist after three fresh-main attempts; no force push used')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--kind', required=True, choices=INPUTS)
    parser.add_argument('--repo', default='.')
    parser.add_argument('--source-commit', required=True)
    parser.add_argument('--source-ref', required=True)
    args = parser.parse_args()
    try:
        result = persist(args.repo, args.kind, args.source_commit, args.source_ref)
    except (ValueError, OSError, RuntimeError, subprocess.TimeoutExpired) as exc:
        result = {'status': 'BLOCKED', 'reason': str(exc)}
    print(json.dumps(result, sort_keys=True))
    return 0 if result['status'] in ('SAVED', 'UNCHANGED') else 2


if __name__ == '__main__':
    raise SystemExit(main())
