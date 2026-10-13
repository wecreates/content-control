#!/usr/bin/env python3
"""Preserve every diagnostic receipt, then propagate unresolved shard outcomes."""
import argparse
import json
import subprocess
import sys
from pathlib import Path
try:
    from .complete_task_one_by_one import select_task
except ImportError:
    from complete_task_one_by_one import select_task


def run_shard(plan, shard, out_dir, runner=subprocess.run):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    results = []
    reasons = []
    try:
        if type(shard) is not int or shard < 0:
            raise ValueError('invalid_shard')
        tasks = [select_task(plan, i) for i in range(len(plan.get('tasks', [])))]
        tasks = [task for task in tasks if task.get('shard') == shard]
        if not tasks:
            raise ValueError('empty_validation_shard')
        ids = [task['capability_id'] for task in tasks]
        if len(ids) != len(set(ids)):
            raise ValueError('duplicate_capability_id')
    except (AttributeError, TypeError, ValueError) as error:
        tasks = []
        reasons.append(str(error))
    for task in tasks:
        out = out_dir / f"{task['capability_id']}.json"
        entry = {'capability_id': task['capability_id'], 'returncode': None,
                 'status': 'BLOCKED', 'completion_verified': False}
        try:
            # A failed launch must not reuse an earlier receipt at this path.
            out.unlink(missing_ok=True)
            process = runner([sys.executable, 'scripts/upgrade_and_test_capability.py',
                              '--task', json.dumps(task), '--out', str(out)], timeout=330)
            entry['returncode'] = process.returncode
            receipt = json.loads(out.read_text())
            valid = (isinstance(receipt, dict)
                     and type(receipt.get('capability_id')) is int
                     and receipt['capability_id'] == task['capability_id']
                     and receipt.get('publication_enabled') is False
                     and receipt.get('status') == 'PASS'
                     and receipt.get('completion_verified') is True)
            if process.returncode == 0 and valid:
                entry.update(status='PASS', completion_verified=True)
            else:
                entry['reason'] = 'diagnostic_failed_or_capability_unverified'
        except (OSError, ValueError, subprocess.TimeoutExpired):
            entry['reason'] = 'diagnostic_or_receipt_unavailable'
        results.append(entry)
    passed = bool(results) and not reasons and all(row['status'] == 'PASS' for row in results)
    report = {'schema_version': 1, 'shard': shard, 'status': 'PASS' if passed else 'BLOCKED',
              'completion_verified': passed, 'publication_enabled': False,
              'status_scope': 'Aggregate diagnostic receipts only; no capability state promotion',
              'results': results, 'reasons': reasons}
    (out_dir / f'shard-{shard}.json').write_text(json.dumps(report, indent=2, sort_keys=True) + '\n')
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--plan', required=True)
    ap.add_argument('--shard', type=int, required=True)
    ap.add_argument('--out-dir', required=True)
    args = ap.parse_args()
    report = run_shard(json.loads(Path(args.plan).read_text()), args.shard, args.out_dir)
    print(json.dumps({'status': report['status'], 'completion_verified': report['completion_verified']}))
    return 0 if report['status'] == 'PASS' else 2


if __name__ == '__main__':
    raise SystemExit(main())
