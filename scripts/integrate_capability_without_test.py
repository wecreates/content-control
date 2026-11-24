#!/usr/bin/env python3
"""Record a blocked integration when no capability-specific consumer is available."""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--task', required=True, type=json.loads)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    task = args.task
    if not isinstance(task, dict) or task.get('publication_enabled') is not False:
        parser.error('invalid_task_or_publication_policy')
    capability_id = task.get('capability_id')
    domain = task.get('domain')
    if type(capability_id) is not int or capability_id <= 0 or not isinstance(domain, str) or not domain.strip():
        parser.error('invalid_capability_identity')

    receipt = {
        'schema_version': 1, 'status': 'BLOCKED', 'capability_id': capability_id, 'domain': domain,
        'reason': 'capability_specific_implementation_evidence_required',
        'completion_verified': False, 'publication_enabled': False,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(receipt, indent=2, sort_keys=True) + '\n')
    print(json.dumps({
        'status': receipt['status'], 'id': capability_id, 'completion_verified': False,
    }))
    return 2


if __name__ == '__main__':
    raise SystemExit(main())
