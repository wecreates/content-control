"""Create local-scan evidence by running a fresh audit, never importing an attestation.

This command contacts the official npm registry when explicitly invoked. It never
installs packages, runs lifecycle scripts, dispatches workflows, or writes Git.
Existing raw audit files are not accepted. Tests mock all subprocess execution.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

# Keep exact-source snapshots clean even when they have no cache ignore rules.
sys.dont_write_bytecode = True
from normalize_npm_security_audit import normalize


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode()


def identity(root, runner):
    def git(*args):
        result = runner(['git', *args], cwd=root, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            raise ValueError('Cannot verify Git checkout')
        return result.stdout.strip()
    if Path(git('rev-parse', '--show-toplevel')).resolve() != root:
        raise ValueError('Checkout must be the repository root')
    sha = git('rev-parse', 'HEAD')
    if not re.fullmatch('[0-9a-f]{40}', sha):
        raise ValueError('Unsupported or invalid source SHA')
    if git('status', '--porcelain', '--untracked-files=all'):
        raise ValueError('A clean exact-source checkout is required')
    files = {}
    for name in ('package.json', 'package-lock.json'):
        path = root / name
        if path.is_symlink() or not path.is_file():
            raise ValueError('Package manifests must be regular checkout files')
        files[name] = digest(path.read_bytes())
    return {'source_sha': sha, 'manifest_sha256': files}


def refresh(checkout, expected_sha, output, runner=subprocess.run):
    root = Path(checkout).resolve()
    output = Path(output).absolute()
    if output.exists():
        raise ValueError('Refusing to replace existing evidence')
    before = identity(root, runner)
    if before['source_sha'] != expected_sha:
        raise ValueError('Source SHA differs from explicitly requested SHA')
    started = datetime.now(timezone.utc).isoformat()
    command = ['npm', 'audit', '--package-lock-only', '--ignore-scripts',
               '--audit-level=info', '--include=dev', '--include=optional',
               '--include=peer', '--registry=https://registry.npmjs.org',
               '--fetch-retries=0', '--fetch-timeout=20000', '--json']
    # Never let a repository .npmrc, inherited npm_config_* values, user config,
    # shared cache, or NODE_OPTIONS determine the audited graph or registry.
    with tempfile.TemporaryDirectory(prefix='npm-isolated-scan-') as temporary_scan:
        scan_root = Path(temporary_scan)
        for name, expected_digest in before['manifest_sha256'].items():
            data = (root / name).read_bytes()
            if digest(data) != expected_digest:
                raise ValueError('Manifest changed before isolated audit')
            (scan_root / name).write_bytes(data)
        user_config, global_config = scan_root/'empty-user.npmrc', scan_root/'empty-global.npmrc'
        user_config.write_text(''); global_config.write_text('')
        # Preserve existing platform transport routing without logging its values.
        # Exclude npm/auth configuration and dynamic Node loader options.
        allowed_environment = ('PATH', 'SYSTEMROOT', 'WINDIR',
                               'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY',
                               'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy',
                               'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE')
        scan_env = {key: os.environ[key] for key in allowed_environment if key in os.environ}
        scan_env.update(HOME=str(scan_root), USERPROFILE=str(scan_root),
                        NPM_CONFIG_USERCONFIG=str(user_config),
                        NPM_CONFIG_GLOBALCONFIG=str(global_config),
                        NPM_CONFIG_CACHE=str(scan_root/'cache'))
        scan = runner(command, cwd=scan_root, env=scan_env, capture_output=True, text=True, timeout=120)
        for name, expected_digest in before['manifest_sha256'].items():
            if digest((scan_root / name).read_bytes()) != expected_digest:
                raise ValueError('Isolated scan modified a manifest')
    after = identity(root, runner)
    if after != before:
        raise ValueError('Checkout or manifests changed during the audit')
    try:
        raw = json.loads(scan.stdout)
    except (TypeError, ValueError) as exc:
        raise ValueError(f'Fresh audit exit={scan.returncode} status=ERROR npm_error=INVALID_JSON; no clean evidence published') from exc
    report = normalize(raw, scan.returncode)
    if report['status'] != 'PASS':
        error = raw.get('error') if isinstance(raw, dict) else None
        code = error.get('code') if isinstance(error, dict) else None
        # Never echo raw error messages, stderr, arbitrary codes, URLs or config.
        safe_codes = {'EAI_AGAIN', 'ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED',
                      'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH',
                      'E401', 'E403', 'E404', 'E429', 'E500', 'E502', 'E503',
                      'EAUDITNOLOCK', 'ENOLOCK', 'EUSAGE', 'EINVALIDPACKAGENAME',
                      'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN',
                      'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT'}
        safe_code = code if isinstance(code, str) and code in safe_codes else 'UNRECOGNIZED' if code is not None else 'NONE'
        # Show only schema presence, fixed validator messages and HTTP numbers.
        # Never copy arbitrary top-level keys, response bodies, URLs or stderr.
        recognized = ('auditReportVersion', 'vulnerabilities', 'metadata', 'error',
                      'message', 'statusCode', 'status', 'code')
        present = [key for key in recognized if isinstance(raw, dict) and key in raw]
        http_status = None
        for container in (raw, error):
            if not isinstance(container, dict):
                continue
            for key in ('statusCode', 'status'):
                value = container.get(key)
                if type(value) is int and 100 <= value <= 599:
                    http_status = value
            for key in ('message', 'summary'):
                value = container.get(key)
                if isinstance(value, str):
                    match = re.search(r'(?i)\b(?:HTTP(?:/[0-9.]+)?(?:\s+error)?|status(?:\s+code)?)\s*[:=]?\s*([1-5][0-9]{2})\b', value)
                    if match:
                        http_status = int(match[1])
        diagnostic = {'audit_errors': report['audit_errors'],
                      'recognized_keys_present': present, 'http_status': http_status}
        raise ValueError(f"Fresh audit exit={scan.returncode} status={report['status']} npm_error={safe_code} diagnostic={json.dumps(diagnostic, sort_keys=True)}; no clean evidence published")
    bundle = {
        'bundle_schema_version': 1,
        'provenance': {
            'origin': 'local_scan', 'github_attested': False,
            'scan_scope': 'isolated_exact_manifest_copies_empty_configs_fresh_cache_platform_transport_existing_tls_trust',
            **before, 'started_at': started,
            'completed_at': datetime.now(timezone.utc).isoformat(),
            'command': command, 'exit_code': scan.returncode,
            'raw_sha256': digest(encoded(raw)),
            'report_sha256': digest(encoded(report)),
        },
        'raw_audit': raw, 'report': report,
    }
    # Publish a complete single-file bundle without replacing existing evidence.
    # Hard-link creation is atomic and fails if another writer won the filename.
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=output.parent, prefix='.npm-evidence-', delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(encoded(bundle)); stream.flush(); os.fsync(stream.fileno())
        os.link(temporary, output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return bundle


def verify_bundle(bundle, expected_identity):
    """Verify local evidence integrity/binding, not external origin authenticity.

    Callers must obtain expected_identity from the target checkout, not from the
    bundle. This does not authenticate downloaded or caller-supplied attestations.
    """
    if not isinstance(bundle, dict) or type(bundle.get('bundle_schema_version')) is not int or bundle['bundle_schema_version'] != 1:
        raise ValueError('Unsupported evidence bundle')
    receipt = bundle.get('provenance')
    if not isinstance(receipt, dict) or receipt.get('origin') != 'local_scan' or receipt.get('github_attested') is not False:
        raise ValueError('Not locally generated scan evidence')
    if receipt.get('scan_scope') != 'isolated_exact_manifest_copies_empty_configs_fresh_cache_platform_transport_existing_tls_trust':
        raise ValueError('Audit configuration isolation is not verified')
    if receipt.get('source_sha') != expected_identity['source_sha'] or receipt.get('manifest_sha256') != expected_identity['manifest_sha256']:
        raise ValueError('Evidence is for different source or manifests')
    if type(receipt.get('exit_code')) is not int or receipt['exit_code'] != 0:
        raise ValueError('Audit did not complete cleanly')
    expected_command = ['npm', 'audit', '--package-lock-only', '--ignore-scripts',
                        '--audit-level=info', '--include=dev', '--include=optional',
                        '--include=peer', '--registry=https://registry.npmjs.org',
               '--fetch-retries=0', '--fetch-timeout=20000', '--json']
    if receipt.get('command') != expected_command:
        raise ValueError('Audit scope differs from required command')
    raw, report = bundle.get('raw_audit'), bundle.get('report')
    if receipt.get('raw_sha256') != digest(encoded(raw)) or receipt.get('report_sha256') != digest(encoded(report)):
        raise ValueError('Evidence digest mismatch')
    normalized = normalize(raw, receipt['exit_code'])
    if normalized['status'] != 'PASS' or report != normalized:
        raise ValueError('Raw evidence is not a consistent clean report')
    try:
        started = datetime.fromisoformat(receipt['started_at'])
        completed = datetime.fromisoformat(receipt['completed_at'])
        if started.tzinfo is None or completed.tzinfo is None or completed < started:
            raise ValueError('Invalid scan timestamps')
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError('Invalid scan timestamps') from exc
    return normalized


def verify_local_bundle(path, checkout, expected_sha, runner=subprocess.run):
    """Use only for a trusted locally generated bundle; not a GitHub importer."""
    current = identity(Path(checkout).resolve(), runner)
    if current['source_sha'] != expected_sha:
        raise ValueError('Target checkout differs from requested source')
    return verify_bundle(json.loads(Path(path).read_text()), current)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkout', required=True)
    parser.add_argument('--expected-sha', required=True)
    parser.add_argument('--output', required=True, help='New local evidence bundle; existing files are never replaced')
    args = parser.parse_args()
    try:
        refresh(args.checkout, args.expected_sha, args.output)
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        parser.exit(2, f'No clean evidence published: {exc}\n')
    print('Fresh local npm audit evidence saved. This is not a GitHub attestation.')


if __name__ == '__main__':
    main()
