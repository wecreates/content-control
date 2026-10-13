#!/usr/bin/env python3
"""Reconcile diagnostic receipts without treating generic PASS as capability proof."""
import argparse
import json
from pathlib import Path


def reconcile(plan, evidence_dir):
    rows = []
    tasks = plan.get('tasks', []) if isinstance(plan, dict) else []
    valid_plan = isinstance(plan, dict) and plan.get('status') == 'READY' and plan.get('publication_enabled') is False and not plan.get('blockers') and not plan.get('blocked_tasks') and isinstance(tasks, list) and bool(tasks)
    for task in tasks if isinstance(tasks, list) else []:
        cid = task.get('capability_id') if isinstance(task, dict) else None
        row = {'capability_id': cid, 'status': 'PENDING', 'evidence': None, 'reason': 'invalid_capability_id'}
        if type(cid) is int and cid > 0:
            evidence = Path(evidence_dir, f'{cid}.json')
            row['reason'] = 'evidence_missing'
            if evidence.is_file():
                row['evidence'] = str(evidence)
                try:
                    detail = json.loads(evidence.read_text())
                    matching = isinstance(detail, dict) and detail.get('capability_id') == cid and detail.get('publication_enabled') is False
                    row['reason'] = 'capability_specific_verification_required' if matching else 'receipt_identity_or_policy_mismatch'
                except (ValueError, OSError):
                    row['reason'] = 'invalid_receipt'
        rows.append(row)
    # Existing receipts certify broad domain checks, not implementation or a
    # rendered result for each numbered capability. Retain them without promotion.
    return {'schema_version': 2, 'status': 'BLOCKED', 'completion_verified': False,
            'reason': 'capability_specific_verification_required' if valid_plan else 'plan_not_ready_or_empty',
            'proven': 0, 'pending': len(rows), 'tasks': rows,
            'blocked_capabilities': plan.get('blocked_capabilities', 0) if isinstance(plan, dict) else 0,
            'publication_enabled': False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--plan', required=True)
    parser.add_argument('--evidence-dir', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    result = reconcile(json.loads(Path(args.plan).read_text()), args.evidence_dir)
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, sort_keys=True) + '\n')
    print(json.dumps({'status': result['status'], 'proven': 0, 'pending': result['pending']}))
    return 2


if __name__ == '__main__':
    raise SystemExit(main())
