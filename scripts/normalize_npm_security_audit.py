"""Fail-closed npm audit report reader. Does not install, scan, or publish."""
import argparse
import json
from pathlib import Path

SEVERITIES = ('info', 'low', 'moderate', 'high', 'critical')


def normalize(raw, exit_code):
    errors = []
    vulnerabilities = raw.get('vulnerabilities') if isinstance(raw, dict) else None
    counts = raw.get('metadata', {}).get('vulnerabilities') if isinstance(raw, dict) and isinstance(raw.get('metadata'), dict) else None
    report = {'schema_version': 2, 'status': 'ERROR', 'publication_enabled': False,
              'audit_errors': errors, 'npm_counts': counts, 'vulnerabilities': [],
              'raw_audit': raw, 'high_count': None, 'critical_count': None}
    if not isinstance(raw, dict) or raw.get('auditReportVersion') != 2 or raw.get('error'):
        errors.append('missing, unsupported, or failed npm audit document')
    if type(exit_code) is not int or exit_code not in (0, 1):
        errors.append('audit tool did not complete successfully')
    if not isinstance(vulnerabilities, dict):
        errors.append('missing vulnerability inventory')
    observed = dict.fromkeys(SEVERITIES, 0)
    if isinstance(vulnerabilities, dict):
        for name, item in vulnerabilities.items():
            if not isinstance(item, dict) or item.get('name') != name or not name:
                errors.append('invalid vulnerability identity')
                continue
            severity = item.get('severity')
            if not isinstance(severity, str) or severity not in observed:
                errors.append('invalid vulnerability severity')
            else:
                observed[severity] += 1
            if not isinstance(item.get('via'), list) or not item['via']:
                errors.append('missing advisory/dependency cause')
            elif any(not (isinstance(cause, str) and cause.strip()) and not (isinstance(cause, dict) and isinstance(cause.get('name'), str) and cause['name'].strip() and isinstance(cause.get('title'), str) and cause['title'].strip()) for cause in item['via']):
                errors.append('invalid advisory/dependency cause')
            if not isinstance(item.get('nodes'), list) or not item['nodes'] or any(not isinstance(n, str) or not n for n in item['nodes']):
                errors.append('missing dependency paths')
    expected = {**observed, 'total': sum(observed.values())}
    if not isinstance(counts, dict) or any(type(counts.get(k)) is not int or counts[k] < 0 for k in expected):
        errors.append('missing or malformed vulnerability counts')
    elif any(counts[k] != expected[k] for k in expected):
        errors.append('counts disagree with vulnerability inventory')
    if isinstance(vulnerabilities, dict) and exit_code in (0, 1) and (exit_code == 0) != (not vulnerabilities):
        errors.append('audit exit code contradicts inventory')
    if isinstance(vulnerabilities, dict):
        for name, item in vulnerabilities.items():
            if not isinstance(item, dict):
                continue
            report['vulnerabilities'].append({
                'name': name, 'severity': item.get('severity'),
                'is_direct': item.get('isDirect'), 'via': item.get('via'),
                'range': item.get('range'), 'fix_available': item.get('fixAvailable'),
            })
    for severity in ('high', 'critical'):
        value = counts.get(severity) if isinstance(counts, dict) else None
        report[severity + '_count'] = value if type(value) is int and value >= 0 else None
    if not errors:
        report['status'] = 'FAIL' if vulnerabilities else 'PASS'
    return report


def load_security_report(path):
    """Missing or malformed evidence is never a clean security result."""
    try:
        report = json.loads(Path(path).read_text())
        if isinstance(report, dict):
            return report
    except (OSError, ValueError):
        pass
    return {'schema_version': 2, 'status': 'ERROR', 'audit_errors': ['missing or malformed security evidence']}


def security_report_is_clean(report):
    if not isinstance(report, dict) or type(report.get('schema_version')) is not int or report['schema_version'] != 2:
        return False
    if report.get('status') != 'PASS' or report.get('audit_errors') != [] or report.get('publication_enabled') is not False:
        return False
    counts = report.get('npm_counts')
    if not isinstance(counts, dict) or any(type(counts.get(k)) is not int or counts[k] != 0 for k in (*SEVERITIES, 'total')):
        return False
    if report.get('vulnerabilities') != []:
        return False
    if any(type(report.get(k)) is not int or report[k] != 0 for k in ('high_count', 'critical_count')):
        return False
    # Revalidate retained raw evidence rather than trusting copied summary fields.
    return normalize(report.get('raw_audit'), 0)['status'] == 'PASS'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--exit-code-file', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    try:
        raw = json.loads(Path(args.input).read_text())
        try:
            code = int(Path(args.exit_code_file).read_text().strip())
            code_error = None
        except (OSError, ValueError) as exc:
            code = None
            code_error = str(exc)
        report = normalize(raw, code)
        if code_error:
            report['audit_errors'].append(code_error)
    except (OSError, ValueError) as exc:
        report = {'schema_version': 2, 'status': 'ERROR', 'publication_enabled': False,
                  'audit_errors': [str(exc)], 'npm_counts': None, 'vulnerabilities': [],
                  'raw_audit': None, 'high_count': None, 'critical_count': None}
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + '\n')
    print(json.dumps(report, sort_keys=True))
    return 0 if report['status'] == 'PASS' else 2


if __name__ == '__main__':
    raise SystemExit(main())
