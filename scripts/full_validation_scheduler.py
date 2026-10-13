#!/usr/bin/env python3
"""Plan validation without inventing metadata or trusting terminal state labels."""
import argparse
import json
from pathlib import Path
try:
    from .autonomous_completion_scheduler import build_plan
except ImportError:
    from autonomous_completion_scheduler import build_plan


def build_validation_plan(progress, shards=50, limit=500):
    plan = build_plan(progress, shards=shards, limit=limit)
    if not isinstance(progress, dict) or progress.get('publication_enabled') is not False:
        plan['blockers'].append('publication_must_remain_disabled')
        plan['status'] = 'BLOCKED'
    plan.update(phase='FULL_VALIDATION', shards=shards, selected=len(plan['tasks']),
                completion_verified=False)
    return plan


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--progress', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--limit', type=int, default=500)
    ap.add_argument('--shards', type=int, default=50)
    args = ap.parse_args()
    plan = build_validation_plan(json.loads(Path(args.progress).read_text()), args.shards, args.limit)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(plan, indent=2, sort_keys=True) + '\n')
    print(json.dumps({'status': plan['status'], 'selected': plan['selected'],
                      'remaining': plan['remaining_total'],
                      'blocked_capabilities': plan['blocked_capabilities']}))
    return 0 if plan['status'] == 'READY' else 2


if __name__ == '__main__':
    raise SystemExit(main())
