#!/usr/bin/env python3
"""Plan remaining work from recorded states; never certify evidence or execute tasks."""
import argparse
import json
from pathlib import Path

REQUIRED = {
    'MISSING': ['implement', 'integrate', 'test', 'verify_render_evidence'],
    'INSTALLED': ['implement', 'integrate', 'test', 'verify_render_evidence'],
    'IMPLEMENTED': ['integrate', 'test', 'verify_render_evidence'],
    'INTEGRATED': ['test', 'verify_render_evidence'],
    'TESTED': ['verify_render_evidence'],
    # Recorded terminal labels still require an evidence audit, not blind completion.
    'RENDER_PROVEN': ['audit_render_evidence'],
}


def build_plan(progress, shards=50, limit=2000):
    for name, value in [('shards', shards), ('limit', limit)]:
        if type(value) is not int or value <= 0:
            raise ValueError(f'{name} must be a positive integer')
    caps = progress.get('capabilities') if isinstance(progress, dict) else None
    blockers = []
    rows = []
    if not isinstance(caps, dict) or not caps:
        blockers.append('capability_registry_missing_empty_or_invalid')
    else:
        for key, value in caps.items():
            row = value if isinstance(value, dict) else {}
            cid = int(key) if str(key).isdigit() and int(key) > 0 else str(key)
            missing = [field for field in ('capability', 'group', 'domain')
                       if not isinstance(row.get(field), str) or not row[field].strip()]
            issues = [f'missing_{field}' for field in missing]
            if not isinstance(value, dict):
                issues.append('invalid_capability_record')
            if not isinstance(cid, int):
                issues.append('invalid_capability_id')
            state = row.get('state')
            required = REQUIRED.get(state) if isinstance(state, str) else None
            if required is None:
                issues.append('unknown_capability_state')
            rows.append({'capability_id': cid, 'capability': row.get('capability') if 'capability' not in missing else 'unknown',
                         'group': row.get('group') if 'group' not in missing else 'unknown',
                         'domain': row.get('domain') if 'domain' not in missing else 'unknown',
                         'current_state': state, 'required': list(required or ['resolve_state', 'verify_render_evidence']),
                         'blockers': issues, 'publication_enabled': False})
    rows.sort(key=lambda row: (not isinstance(row['capability_id'], int), row['capability_id']))
    eligible = [row for row in rows if not row['blockers']]
    blocked_tasks = [row for row in rows if row['blockers']]
    tasks = [dict(row, shard=i % shards) for i, row in enumerate(eligible[:limit])]
    blocked = bool(blockers or any(row['blockers'] for row in rows))
    return {'schema_version': 1, 'status': 'BLOCKED' if blocked else 'READY',
            'status_scope': 'Work plan only; recorded states and evidence have not been verified',
            'parallel_shards': shards, 'tasks': tasks, 'blocked_tasks': blocked_tasks, 'remaining_total': len(rows),
            'remaining_selected': len(tasks), 'blockers': blockers,
            'blocked_capabilities': sum(bool(row['blockers']) for row in rows),
            'publication_enabled': False}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--progress', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--shards', type=int, default=50)
    ap.add_argument('--limit', type=int, default=2000)
    args = ap.parse_args()
    try:
        report = build_plan(json.loads(Path(args.progress).read_text()), args.shards, args.limit)
    except ValueError as exc:
        ap.error(str(exc))
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(report, indent=2, sort_keys=True) + '\n')
    print(json.dumps({'status': report['status'], 'tasks': len(report['tasks']),
                      'remaining_total': report['remaining_total'], 'publication_enabled': False}))


if __name__ == '__main__':
    main()
