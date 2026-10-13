#!/usr/bin/env python3
"""Recheck exact persisted draft evidence without generation or approval."""
import argparse
import hashlib
import json
from pathlib import Path


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def validate_inputs(root, artifact, run):
    root, artifact = Path(root), Path(artifact)
    read = lambda p: json.loads(p.read_text())
    draft = read(root/'state/v2-draft.json')
    report = read(root/'state/v2-production-status.json')
    candidate = root/'public-review/v2-draft.mp4'
    expected = digest(candidate)
    if any(x.get('publication_enabled') is not False or x.get('production_approved') is not False for x in (draft, report)):
        raise ValueError('Publication and production approval must remain disabled')
    if draft.get('status') != 'DRAFT' or any(x.get('candidate_sha256') != expected for x in (draft, report)):
        raise ValueError('Persisted draft and report candidate mismatch')
    if (type(run.get('id')) is not int or run['id'] <= 0 or
        run['id'] != draft.get('run_id') or run['id'] != report.get('run_id') or
        run.get('head_sha') != draft.get('source_commit') or run.get('head_sha') != report.get('source_commit') or
        run.get('path') != '.github/workflows/content-control-v2.yml' or run.get('head_branch') != 'main' or run.get('status') != 'completed'):
        raise ValueError('Original render run provenance mismatch')
    if digest(artifact/'render/v2-boss-fight.mp4') != expected:
        raise ValueError('Downloaded artifact is not the persisted candidate')
    from scripts.v2_build_status import RECEIPTS
    for name, relative in RECEIPTS.items():
        recorded = report.get('checks', {}).get(name, {})
        if digest(artifact/relative) != recorded.get('receipt_sha256'):
            raise ValueError(f'Original {name} receipt hash mismatch')
    media = read(artifact/'receipts/render.json')
    if media.get('status') != 'PASS' or media.get('candidate_sha256') != expected or media.get('publication_enabled') is not False:
        raise ValueError('Exact-candidate technical media evidence required')
    if not media.get('checks') or any(value is not True for value in media['checks'].values()):
        raise ValueError('Technical checks not all verified')
    return expected, candidate


def revalidate(root, artifact, run):
    expected, candidate = validate_inputs(root, artifact, run)
    from scripts.rendered_visual_parity import evaluate_visual_review
    review_path = Path(root)/'state/visual-analysis/frame-review.json'
    visual = evaluate_visual_review(Path(root)/'reference/frames', candidate, json.loads(review_path.read_text()))
    return {'schema_version': 1, 'status': 'VISUAL_REVALIDATED' if visual.get('status') == 'PASS' else 'BLOCKED',
            'candidate_sha256': expected, 'original_run_id': run['id'], 'visual_review_sha256': digest(review_path),
            'visual_review': visual, 'production_approved': False, 'publication_enabled': False,
            'render_attempted': False, 'full_av_review': False,
            'scope': 'Existing candidate and original receipt integrity plus sampled visual review only; full audiovisual and competitor approval still required.'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='.')
    parser.add_argument('--artifact', required=True)
    parser.add_argument('--run-metadata', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    try:
        result = revalidate(args.root, args.artifact, json.loads(Path(args.run_metadata).read_text()))
    except (ValueError, OSError, TypeError, KeyError) as exc:
        result = {'status': 'BLOCKED', 'reason': str(exc), 'publication_enabled': False, 'production_approved': False, 'render_attempted': False, 'full_av_review': False}
    output = Path(args.out); output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps({'status': result['status'], 'production_approved': False, 'publication_enabled': False}))
    return 0 if result['status'] == 'VISUAL_REVALIDATED' else 2


if __name__ == '__main__':
    raise SystemExit(main())
