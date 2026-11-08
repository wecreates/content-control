"""Staged read-only Python evidence loader. No consumer activation or persistence.

Requires official live run/artifact authentication, exact raw-scan reproduction,
plus reviewed source equivalence. No fallback to local or older clean reports.
"""
from pathlib import Path
import re
import subprocess
import sys
import zipfile
import zlib
sys.dont_write_bytecode = True
from npm_security_source_equivalence import assert_source_equivalent
from verify_hosted_python_security_evidence import GitHubAPI, SCOPES, _retrieve_verified


def _equivalent_snapshot(checkout, audited_sha):
    root = Path(checkout).resolve()
    before = assert_source_equivalent(root, audited_sha)
    manifests = {}
    for name in SCOPES.values():
        path = root / name
        if path.is_symlink() or not path.is_file():
            raise ValueError('Requirement manifests must be regular files')
        manifests[name] = path.read_bytes()
    if assert_source_equivalent(root, audited_sha) != before:
        raise ValueError('Source changed while reading manifests')
    return audited_sha, manifests, before


def retrieve_verified_equivalent(checkout, expected_sha, repository, run_id, api=None):
    """Same authenticated payload checks as exact verifier; no global patching."""
    return _retrieve_verified(checkout, expected_sha, repository, run_id, api,
                              lambda root: _equivalent_snapshot(root, expected_sha))


def load_live_python_report(checkout, repository, api=None):
    """Newest equivalent run is decisive, including failure or pending status."""
    try:
        if not isinstance(repository, str) or not re.fullmatch('[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
            raise ValueError('Invalid repository')
        api = api or GitHubAPI()
        listing = api.get(f'repos/{repository}/actions/workflows/python-security-audit.yml/runs?branch=main&per_page=10')
        runs = listing.get('workflow_runs')
        if not isinstance(runs, list) or len(runs) > 10:
            raise ValueError('Invalid bounded run listing')
        if any(not isinstance(r, dict) or type(r.get('run_number')) is not int or r['run_number'] <= 0 for r in runs):
            raise ValueError('Missing run ordering')
        if len({r['run_number'] for r in runs}) != len(runs):
            raise ValueError('Duplicate run ordering')
        for run in sorted(runs, key=lambda r: r['run_number'], reverse=True):
            source, run_id = run.get('head_sha'), run.get('id')
            if not isinstance(source, str) or not re.fullmatch('[0-9a-f]{40}', source) or type(run_id) is not int or run_id <= 0:
                raise ValueError('Malformed run identity')
            try:
                assert_source_equivalent(checkout, source)
            except (OSError, ValueError, TypeError, AttributeError, subprocess.SubprocessError):
                continue
            # A validation-only success without raw audit evidence also fails
            # closed here; it cannot stand in for a completed advisory scan.
            return retrieve_verified_equivalent(checkout, source, repository, run_id, api)['report']
        return {'schema_version': 2, 'status': 'ERROR', 'audit_errors': ['No eligible authenticated Python evidence; migration or fresh scan required']}
    except (OSError, ValueError, TypeError, AttributeError, KeyError, EOFError, RuntimeError,
            NotImplementedError, zipfile.BadZipFile, zlib.error, subprocess.SubprocessError):
        return {'schema_version': 2, 'status': 'ERROR', 'audit_errors': ['Hosted Python evidence verification unavailable']}
