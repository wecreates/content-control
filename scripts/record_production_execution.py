#!/usr/bin/env python3
"""Summarize exact execution artifacts; never authorize playback or publishing."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import re
try:
    from .production_package import REQUIRED
except ImportError:
    from production_package import REQUIRED

PROBE_REQUIRED = {'candidate_unchanged', 'probe_bound_to_candidate', 'duration_matches', 'audio_stream_present', 'audio_sample_rate_valid', 'audio_channels_valid', 'av_streams_present'}


def read(path):
    try:
        value = json.loads(path.read_text())
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def summarize(workdir, format, run_id, attempt, source_commit, outcome):
    if format not in ('short', 'long') or run_id <= 0 or attempt <= 0 or not re.fullmatch(r'[a-f0-9]{40}', source_commit):
        raise ValueError('Invalid run identity')
    root = Path(workdir)
    video = root / 'candidate.mp4'
    candidate_hash = None
    if video.is_file() and video.stat().st_size > 0:
        with video.open('rb') as stream:
            candidate_hash = hashlib.file_digest(stream, 'sha256').hexdigest()
    execution = read(root / 'execution.json')
    checks = {}
    for name, filename in [('technical_video', 'media-qa.json'), ('openmontage_probe', 'openmontage-probe.json')]:
        receipt = read(root / filename)
        required = REQUIRED if name == 'technical_video' else PROBE_REQUIRED
        passed = bool(candidate_hash) and receipt.get('candidate_sha256') == candidate_hash and receipt.get('publication_enabled') is False and receipt.get('status') == 'PASS' and isinstance(receipt.get('checks'), dict) and required.issubset(receipt['checks']) and all(v is True for v in receipt['checks'].values())
        checks[name] = {'status': 'PASS' if passed else 'BLOCKED', 'hash_bound': bool(candidate_hash) and receipt.get('candidate_sha256') == candidate_hash}
    execution_valid = (execution.get('publication_enabled') is False and execution.get('production_approved') is False and execution.get('status') == 'REVIEW_CANDIDATE' and execution.get('candidate_sha256') == candidate_hash and bool(candidate_hash) and not (root / 'execution-blocked.json').exists())
    technical_pass = outcome == 'success' and execution_valid and all(c['status'] == 'PASS' for c in checks.values())
    return {'schema_version': 1, 'format': format, 'run_id': run_id, 'run_attempt': attempt,
            'recorded_at': datetime.now(timezone.utc).isoformat(), 'source_commit': source_commit,
            'workflow_outcome': outcome, 'candidate_sha256': candidate_hash,
            'candidate_generated': bool(candidate_hash), 'technical_status': 'PASS' if technical_pass else 'BLOCKED',
            'status': 'REVIEW_PENDING' if technical_pass else 'BLOCKED', 'checks': checks,
            'creative_review': 'PENDING', 'audio_listening_review': 'PENDING',
            'production_approved': False, 'publication_enabled': False,
            'scope': 'Recorded execution artifact checks only; creative and listening review remain pending'}


def main():
    p = argparse.ArgumentParser()
    for key in ('workdir', 'format', 'source-commit', 'outcome', 'out'):
        p.add_argument('--' + key, required=True)
    p.add_argument('--run-id', required=True, type=int)
    p.add_argument('--attempt', required=True, type=int)
    a = p.parse_args()
    report = summarize(a.workdir, a.format, a.run_id, a.attempt, a.source_commit, a.outcome)
    out = Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()
