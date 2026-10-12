#!/usr/bin/env python3
import argparse
import hashlib
import json
import shutil
from pathlib import Path

try:
    from .validate_reference_clone import validate_clone, validate_reference
except ImportError:
    from validate_reference_clone import validate_clone, validate_reference

REQUIRED = ('reference.json', 'clone-blueprint.json', 'scene-plan.json')


def validate_package(src):
    # Validate every input before touching the currently active package.
    objects = {name: json.loads((src / name).read_text()) for name in REQUIRED}
    for name, obj in objects.items():
        if obj.get('publication_enabled') is not False:
            raise ValueError(f'{name}: publication must be explicitly disabled')
    for name, validator in [('reference.json', validate_reference), ('clone-blueprint.json', validate_clone)]:
        result = validator(objects[name])
        if result['status'] != 'PASS':
            raise ValueError(f"{name}: {', '.join(result['failed_checks'])}")
    if not objects['scene-plan.json'].get('scenes'):
        raise ValueError('scene-plan.json: no scenes')
    reference_id = objects['reference.json']['source']['id']
    for name in ('clone-blueprint.json', 'scene-plan.json'):
        if objects[name].get('source_reference_id') != reference_id:
            raise ValueError(f'{name}: reference identity mismatch')
    status_path = src / 'intake-status.json'
    if status_path.exists():
        receipt = json.loads(status_path.read_text())
        if receipt.get('status') != 'COMPLETED' or receipt.get('publication_enabled') is not False:
            raise ValueError('intake is not completed with publication disabled')
        for name in REQUIRED:
            digest = hashlib.sha256((src / name).read_bytes()).hexdigest()
            if receipt.get('artifacts_sha256', {}).get(name) != digest:
                raise ValueError(f'{name}: stale or missing intake artifact receipt')
    return objects


def activate(src, dst):
    objects = validate_package(src)
    dst.mkdir(parents=True, exist_ok=True)
    for name in REQUIRED:
        shutil.copy2(src / name, dst / name)
    for name in ('concept-selection.json', 'voice-assignments.json', 'voice-lock-health.json', 'longform-plan.json'):
        if (src / name).is_file():
            shutil.copy2(src / name, dst / name)
    manifest = {'schema_version': 1, 'source_package': src.as_posix(),
                'reference_id': objects['reference.json']['source']['id'],
                'production_approved': False, 'publication_enabled': False}
    (dst / 'activation.json').write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n')
    return manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--package', required=True)
    parser.add_argument('--active', default='production/reference-clones/active')
    args = parser.parse_args()
    print(json.dumps({'status': 'PASS', **activate(Path(args.package), Path(args.active))}, sort_keys=True))


if __name__ == '__main__':
    main()
