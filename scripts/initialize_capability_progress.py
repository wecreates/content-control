#!/usr/bin/env python3
"""Restore registry metadata without promoting recorded states or inventing domains."""
import argparse
import copy
import json
from pathlib import Path


def reconcile(progress, registries):
    if not isinstance(progress, dict) or not isinstance(progress.get('capabilities'), dict):
        raise ValueError('invalid_progress')
    if progress.get('publication_enabled') is not False:
        raise ValueError('publication_must_remain_disabled')
    result = copy.deepcopy(progress)
    definitions = {}
    for registry in registries:
        if registry.get('publication_enabled') is not False or not isinstance(registry.get('capabilities'), list):
            raise ValueError('invalid_registry')
        for row in registry['capabilities']:
            if not isinstance(row, dict) or type(row.get('id')) is not int or row['id'] <= 0 or row.get('publication_enabled') is not False:
                raise ValueError('invalid_registry_record')
            key = str(row['id'])
            if key in definitions and definitions[key] != row:
                raise ValueError('conflicting_registry_definition')
            definitions[key] = row
    for key, source in definitions.items():
        target = result['capabilities'].setdefault(key, {'state': source.get('state'), 'evidence': []})
        if not isinstance(target, dict):
            raise ValueError('invalid_progress_record')
        for field in ('capability', 'group', 'domain'):
            value = source.get(field)
            if not isinstance(value, str) or not value.strip():
                continue
            existing = target.get(field)
            if existing is not None and existing != '' and existing != value:
                raise ValueError('conflicting_progress_metadata')
            target[field] = value
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--registries', nargs='+', required=True)
    ap.add_argument('--progress', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    path = Path(args.progress)
    # Missing input can initialize; malformed existing input must never be replaced.
    progress = json.loads(path.read_text()) if path.exists() else {'schema_version': 1, 'capabilities': {}, 'publication_enabled': False}
    result = reconcile(progress, [json.loads(Path(p).read_text()) for p in args.registries])
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2, sort_keys=True) + '\n')
    print(json.dumps({'status': 'METADATA_RECONCILED', 'total': len(result['capabilities']), 'publication_enabled': False}))


if __name__ == '__main__':
    main()
