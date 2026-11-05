"""Normalize pip-audit results without treating tool failures as a clean audit."""
import argparse
import json
import re
from pathlib import Path

SCOPES = {
    'transcription': 'requirements-transcription.txt',
    'qa': 'requirements-free-qa.lock.txt',
    'pod': 'requirements-pod-runtime.txt',
}


def canonical_name(name):
    return re.sub(r'[-_.]+', '-', name).lower()


def direct_requirements(path):
    """Read this repository's exact-pin manifests; fail on unsupported syntax."""
    required = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or line.startswith('--index-url '):
            continue
        match = re.fullmatch(r'([A-Za-z0-9][A-Za-z0-9._-]*)==([A-Za-z0-9][A-Za-z0-9.!+_-]*)', line)
        if not match:
            raise ValueError(f'unsupported requirement syntax in {path.name}')
        name, version = canonical_name(match[1]), match[2]
        if name in required and required[name] != version:
            raise ValueError(f'conflicting direct pins for {name}')
        required[name] = version
    if not required:
        raise ValueError(f'empty direct requirements in {path.name}')
    return required


def read_scope(directory, scope, requirements_dir):
    findings, errors = [], []
    observed = {}
    code = None
    try:
        code = int((directory / f'{scope}-exit').read_text().strip())
        if code not in (0, 1):
            errors.append(f'audit tool exited {code}')
    except (OSError, ValueError) as exc:
        errors.append(str(exc))
    try:
        doc = json.loads((directory / f'{scope}-audit.json').read_text())
    except (OSError, ValueError) as exc:
        return findings, errors + [str(exc)]
    deps = doc if isinstance(doc, list) else doc.get('dependencies') if isinstance(doc, dict) else None
    if not isinstance(deps, list) or not deps:
        return findings, errors + ['missing or empty dependency inventory']
    for index, dep in enumerate(deps):
        prefix = f'dependency {index}: '
        if not isinstance(dep, dict) or dep.get('skip_reason'):
            errors.append(prefix + 'invalid or skipped dependency')
            continue
        if not isinstance(dep.get('name'), str) or not dep['name'].strip() or not isinstance(dep.get('version'), str) or not dep['version'].strip():
            errors.append(prefix + 'missing dependency identity')
            continue
        name = canonical_name(dep['name'])
        version = dep['version']
        if not re.fullmatch(r'[0-9]+(?:\.[0-9]+)*(?:(?:a|b|rc)[0-9]+)?(?:\.post[0-9]+)?(?:\.dev[0-9]+)?(?:\+[a-z0-9]+(?:[._-][a-z0-9]+)*)?', version, re.IGNORECASE):
            errors.append(prefix + 'invalid or unsupported dependency version')
        elif name in observed:
            errors.append(prefix + 'duplicate dependency identity')
        else:
            observed[name] = version
        vulns = dep.get('vulns')
        if not isinstance(vulns, list):
            errors.append(prefix + 'missing vulnerability inventory')
            continue
        for vuln in vulns:
            if not isinstance(vuln, dict) or not isinstance(vuln.get('id'), str) or not vuln['id']:
                errors.append(prefix + 'invalid vulnerability record')
                continue
            fixes = vuln.get('fix_versions', [])
            if not isinstance(fixes, list) or any(not isinstance(v, str) for v in fixes):
                errors.append(prefix + 'invalid fix versions')
                finding = {'package': dep['name'], 'version': dep['version'],
                           'id': vuln['id'], 'fix_versions': [],
                           'description': vuln.get('description'),
                           'fix_versions_valid': False, 'original_fix_versions': fixes}
            else:
                finding = {'package': dep['name'], 'version': dep['version'],
                           'id': vuln['id'], 'fix_versions': fixes,
                           'description': vuln.get('description')}
            findings.append(finding)
    try:
        required = direct_requirements(requirements_dir / SCOPES[scope])
        for name, expected in required.items():
            actual = observed.get(name)
            # Local wheel suffixes (e.g. +cpu) satisfy an exact public-version pin.
            if actual != expected and not (actual and actual.startswith(expected + '+')):
                errors.append(f'direct requirement {name}=={expected} missing or mismatched (observed {actual})')
    except (OSError, ValueError) as exc:
        errors.append(str(exc))
    if code in (0, 1) and (code == 0) != (not findings):
        errors.append('audit exit code contradicts findings')
    return findings, errors


def normalize(directory, requirements_dir=None):
    directory = Path(directory)
    requirements_dir = Path(requirements_dir) if requirements_dir else Path(__file__).resolve().parents[1]
    report = {'schema_version': 2, 'status': 'PASS', 'publication_enabled': False,
              'total_vulnerabilities': 0, 'audit_errors': [],
              'audited_requirements': list(SCOPES.values()), 'direct_requirements_verified': False}
    for scope in SCOPES:
        findings, errors = read_scope(directory, scope, requirements_dir)
        report['audit_errors'].extend({'scope': scope, 'error': error} for error in errors)
        report[f'{scope}_vulnerabilities'] = findings
        report['total_vulnerabilities'] += len(findings)
    report['direct_requirements_verified'] = not report['audit_errors']
    if report['audit_errors']:
        report['status'] = 'ERROR'
    elif report['total_vulnerabilities']:
        report['status'] = 'FAIL'
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    report = normalize(args.input_dir)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + '\n')
    print(json.dumps(report, sort_keys=True))
    return 0 if report['status'] == 'PASS' else 2


if __name__ == '__main__':
    raise SystemExit(main())
