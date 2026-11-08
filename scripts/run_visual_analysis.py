#!/usr/bin/env python3
"""Analyze an explicit draft lane without granting creative or publication approval."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys

try:
    from scripts.review_smoke_inputs import observed_hash
except ModuleNotFoundError:
    from review_smoke_inputs import observed_hash

LANES = {
    'v2': ('public-review/v2-draft.mp4', 'state/visual-analysis/frame-review.json'),
    'canonical-v10': ('public-review/episode1-v10-free.mp4',
                      'state/visual-analysis/v10-frame-review.json'),
}
HEALTH = 'state/content-control-health.json'
MEDIA_LIMIT = 512 * 1024 * 1024
JSON_LIMIT = 2 * 1024 * 1024


def read_object(path):
    digest = observed_hash(path, JSON_LIMIT)
    value = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(value, dict) or observed_hash(path, JSON_LIMIT) != digest:
        raise ValueError('Invalid or changed JSON object: ' + str(path))
    return value, digest


def bind_candidate(root, lane):
    if lane not in LANES:
        raise ValueError('Unknown candidate lane')
    video, _ = LANES[lane]
    digest = observed_hash(root / video, MEDIA_LIMIT)
    binding = {'candidate_lane': lane, 'candidate_path': video, 'candidate_sha256': digest}
    if lane == 'canonical-v10':
        health, health_digest = read_object(root / HEALTH)
        expected = health.get('candidate_sha256')
        if not isinstance(expected, str) or not re.fullmatch('[0-9a-f]{64}', expected):
            raise ValueError('Canonical health candidate SHA-256 missing or invalid')
        if expected != digest:
            raise ValueError('Canonical candidate does not match current health')
        if health.get('publication_enabled') is not False:
            raise ValueError('Canonical health must explicitly disable publication')
        binding.update(health_path=HEALTH, health_sha256=health_digest)
    return binding


def review_binding(root, lane, digest):
    path = root / LANES[lane][1]
    result = {'path': LANES[lane][1], 'status': 'BLOCKED',
              'blocker': 'MISSING_VISUAL_REVIEW', 'review_sha256': None}
    if not path.exists():
        return result
    try:
        review, review_digest = read_object(path)
        result['review_sha256'] = review_digest
        candidate = review.get('candidate')
        claim = candidate.get('sha256') if isinstance(candidate, dict) else None
        if not isinstance(claim, str) or not re.fullmatch('[0-9a-f]{64}', claim):
            result['blocker'] = 'INVALID_VISUAL_REVIEW'
        elif claim != digest:
            result['blocker'] = 'OUTDATED_VISUAL_REVIEW'
        else:
            # Matching identity is not a review verdict; the existing evaluator
            # must still validate the complete documented review.
            result.update(status='IDENTITY_BOUND', blocker=None)
    except (OSError, ValueError):
        result['blocker'] = 'INVALID_VISUAL_REVIEW'
    return result


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + '\n', encoding='utf-8')


def run(root, lane, output, run_id, source_commit, execute=subprocess.run):
    root = Path(root).resolve()
    output = Path(output).resolve()
    if type(run_id) is not int or run_id <= 0 or not re.fullmatch('[0-9a-f]{40}', source_commit):
        raise ValueError('Valid workflow run and source commit required')
    # Refuse stale artifacts rather than silently promoting a prior run.
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise ValueError('Analysis output directory must be empty')
    initial = bind_candidate(root, lane)
    review = review_binding(root, lane, initial['candidate_sha256'])
    original_review_binding = dict(review)
    write_json(output / 'candidate-binding.json', initial)
    write_json(output / 'review-binding.json', review)
    video = initial['candidate_path']
    comparison = [sys.executable, 'scripts/rendered_visual_parity.py',
                  '--reference-dir', 'reference/frames', '--candidate-video', video,
                  '--out', str(output / 'comparison.json'), '--analysis-only']
    if review['status'] == 'IDENTITY_BOUND':
        comparison.extend(['--visual-review', review['path']])
    execute(comparison, cwd=root, check=True)
    execute([sys.executable, 'scripts/visual_motion_analysis.py', '--video', video,
             '--out', str(output / 'motion.json')], cwd=root, check=True)
    if bind_candidate(root, lane) != initial:
        raise ValueError('Candidate or canonical health changed during analysis')
    if review_binding(root, lane, initial['candidate_sha256']) != review:
        raise ValueError('Visual review changed during analysis')
    reports = {}
    for name in ('comparison', 'motion'):
        report, _ = read_object(output / (name + '.json'))
        if report.get('analysis_status') != 'COMPLETE' or report.get('candidate_sha256') != initial['candidate_sha256']:
            raise ValueError('Incomplete or mismatched ' + name + ' evidence')
        if report.get('publication_enabled') is not False or report.get('production_approved', False) is not False:
            raise ValueError('Analysis evidence cannot grant approval')
        reports[name] = report
    if review['status'] == 'IDENTITY_BOUND':
        comparison = reports['comparison']
        verdict = comparison.get('visual_review')
        if comparison.get('visual_review_sha256') != review['review_sha256'] or not isinstance(verdict, dict):
            raise ValueError('Comparison lacks exact-review evidence')
        review = dict(review, status=verdict.get('status', 'BLOCKED'),
                      blocker=verdict.get('blocker'))
    manifest = {'schema_version': 2, 'run_id': run_id, 'source_commit': source_commit,
                **initial, 'review': review, 'analysis_status': 'COMPLETE',
                'production_approved': False, 'publication_enabled': False,
                'scope': 'Visual measurements only; no full audiovisual or creative approval',
                'files': {str(p.relative_to(output)): observed_hash(p, MEDIA_LIMIT)
                          for p in output.rglob('*') if p.is_file()}}
    # Last check before sealing the receipt, including the health snapshot.
    if bind_candidate(root, lane) != initial:
        raise ValueError('Candidate or canonical health changed before receipt')
    if review_binding(root, lane, initial['candidate_sha256']) != original_review_binding:
        raise ValueError('Visual review changed before receipt')
    write_json(output / 'run.json', manifest)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lane', choices=LANES, default='v2')
    parser.add_argument('--root', default='.')
    parser.add_argument('--out', default='state/visual-analysis-run')
    args = parser.parse_args()
    result = run(args.root, args.lane, args.out, int(os.environ['GITHUB_RUN_ID']), os.environ['GITHUB_SHA'])
    print(json.dumps(result, sort_keys=True))


if __name__ == '__main__':
    main()
