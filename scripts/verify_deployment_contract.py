#!/usr/bin/env python3
"""Verify the repository deployment contract; live deployment is a separate probe."""
import json
import re
from pathlib import Path


def verify(root=Path('.')):
    root = Path(root)
    manifest = (root / 'render.yaml').read_text()
    contract = json.loads((root / 'state/deployment-contract.json').read_text())
    pkg = json.loads((root / 'package.json').read_text())
    def field(key, value):
        return re.search(r'(?m)^\s*' + re.escape(key) + r':\s*' + re.escape(value) + r'\s*$', manifest) is not None
    docker = (root / contract['dockerfile_path']).read_text()
    def env_locked(key, value):
        return re.search(r'(?m)^\s*- key: ' + re.escape(key) + r'\s*\n\s*value: [\"\']?' + re.escape(value) + r'[\"\']?\s*$', manifest) is not None
    checks = {
        'manifest_exists': (root / 'render.yaml').is_file(),
        'service_name': field('name', contract['service_name']),
        'runtime_matches_contract': contract['runtime'] == 'docker' and field('runtime', 'docker'),
        'free_plan': field('plan', 'free'),
        'dockerfile_path': field('dockerfilePath', contract['dockerfile_path']),
        'docker_context': field('dockerContext', contract['docker_context']),
        'build_command': contract['build_command'] in docker,
        'start_command': contract['start_command'] == 'npm start' and re.search(r'(?m)^CMD\s+\[\s*"npm"\s*,\s*"start"\s*\]\s*$', docker) is not None,
        'health_check': field('healthCheckPath', contract['health_check_path']),
        'publication_lock': contract['publication_enabled'] is False and env_locked('PUBLICATION_ENABLED', 'false'),
        'required_environment': all(env_locked(k, v) for k, v in contract['required_env'].items()),
        'container_publication_lock': 'PUBLICATION_ENABLED=false' in docker and 'POD_PUBLICATION_ENABLED=false' in docker,
        'container_nonroot': re.search(r'(?m)^USER podworker\s*$', docker) is not None,
        'package_start_canonical': pkg.get('scripts', {}).get('start') == 'node server-lowmem.js',
        'canonical_server_exists': (root / contract['canonical_server']).is_file(),
        'canonical_media_exists': (root / contract['canonical_media']).is_file(),
    }
    return {'schema_version': 1, 'status': 'PASS' if all(checks.values()) else 'FAIL',
            'provider': 'render', 'checks': checks, 'failed_checks': [k for k, v in checks.items() if not v],
            'scope': 'Repository configuration only; live container and playback require independent probes',
            'publication_enabled': False}


if __name__ == '__main__':
    report = verify()
    Path('state/deployment-health.json').write_text(json.dumps(report, indent=2, sort_keys=True) + '\n')
    print(json.dumps(report, sort_keys=True))
    raise SystemExit(0 if report['status'] == 'PASS' else 2)
