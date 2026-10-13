#!/usr/bin/env python3
"""Load an evidence-auditable plan; this does not execute or certify tasks."""
import argparse
import json
from pathlib import Path
try:
    from .autonomous_completion_scheduler import build_plan
except ImportError:
    from autonomous_completion_scheduler import build_plan


def build_queue(progress):
    count = len(progress.get('capabilities', {})) if isinstance(progress, dict) else 0
    plan = build_plan(progress, shards=1, limit=max(1, count))
    for position, task in enumerate(plan['tasks'], 1):
        task.update(position=position, status='QUEUED')
    plan.update(mode='ORDERED_COMPLETION', total_tasks=len(plan['tasks']))
    return plan


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--progress', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    report = build_queue(json.loads(Path(args.progress).read_text()))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, sort_keys=True) + '\n')
    print(json.dumps({'status': report['status'], 'tasks': report['total_tasks'], 'blocked_capabilities': report['blocked_capabilities']}))


if __name__ == '__main__':
    main()
