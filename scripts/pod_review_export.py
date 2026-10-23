"""Restore an exact stored package for independent QA. Never signs approval."""
import argparse
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import sys
import threading
import time
import urllib.parse
import urllib.request
from pod_common import strict_json
from pod_output_attempt import output_attempt

HASH = re.compile(r'^[a-f0-9]{64}$')
PLATFORMS = ('kdp','redbubble','teepublic','zazzle','spreadshirt')
BASE_FILES = frozenset(('art-mask.png','print.png','text-mask.png'))
KDP_FILES = frozenset((*BASE_FILES,'cover.pdf','interior.pdf','interior.receipt.json'))
PACKAGE_MEDIA_TYPES = {
    'art-mask.png': 'image/png', 'print.png': 'image/png',
    'text-mask.png': 'image/png', 'cover.pdf': 'application/pdf',
    'interior.pdf': 'application/pdf',
    'interior.receipt.json': 'application/json',
}
PNG_SIGNATURE = bytes.fromhex('89504e470d0a1a0a')
REQUEST_TIMEOUT_SECONDS = 20


@contextmanager
def request_deadline():
    # Socket timeouts limit idle reads, not a response that keeps trickling.
    # This CLI uses the main-thread POSIX timer to cover open/headers/body/close.
    if (threading.current_thread() is not threading.main_thread() or
            not all(hasattr(signal, name) for name in ('SIGALRM','ITIMER_REAL','getitimer','setitimer'))):
        raise ValueError('RESPONSE_DEADLINE_UNAVAILABLE')
    if signal.getitimer(signal.ITIMER_REAL) != (0.0,0.0):
        raise ValueError('RESPONSE_DEADLINE_TIMER_IN_USE')
    previous = signal.getsignal(signal.SIGALRM)
    if previous not in (signal.SIG_DFL,signal.SIG_IGN) and not callable(previous):
        raise ValueError('RESPONSE_DEADLINE_UNAVAILABLE')
    deadline = time.monotonic() + REQUEST_TIMEOUT_SECONDS
    def expired(_signum, _frame):
        raise ValueError('RESPONSE_DEADLINE_EXCEEDED')
    signal.signal(signal.SIGALRM,expired)
    try:
        signal.setitimer(signal.ITIMER_REAL,REQUEST_TIMEOUT_SECONDS)
        yield
        if time.monotonic() >= deadline:
            raise ValueError('RESPONSE_DEADLINE_EXCEEDED')
    finally:
        signal.setitimer(signal.ITIMER_REAL,0)
        signal.signal(signal.SIGALRM,previous)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('REDIRECT_BLOCKED')

def assert_json_bounds(value, state=None, depth=0):
    state = {'nodes': 0} if state is None else state
    state['nodes'] += 1
    if depth > 64 or state['nodes'] > 10000:
        raise ValueError('ARTIFACT_INVALID')
    if ((type(value) is int and not -(2**53 - 1) <= value <= 2**53 - 1) or
            (type(value) is float and value.is_integer() and
             not -(2**53 - 1) <= value <= 2**53 - 1)):
        raise ValueError('ARTIFACT_INVALID')
    if isinstance(value, list):
        if len(value) > 10000:
            raise ValueError('ARTIFACT_INVALID')
        for item in value:
            assert_json_bounds(item, state, depth + 1)
    elif isinstance(value, dict):
        if len(value) > 10000:
            raise ValueError('ARTIFACT_INVALID')
        for item in value.values():
            assert_json_bounds(item, state, depth + 1)

def assert_artifact_format(name, body):
    media_type = PACKAGE_MEDIA_TYPES.get(name)
    if media_type == 'image/png':
        end = len(body) - 12
        if (len(body) < 45 or body[:8] != PNG_SIGNATURE or
                int.from_bytes(body[8:12], 'big') != 13 or body[12:16] != b'IHDR' or
                end < 33 or int.from_bytes(body[end:end + 4], 'big') != 0 or
                body[end + 4:end + 8] != b'IEND'):
            raise ValueError('ARTIFACT_INVALID')
        return
    if media_type == 'application/pdf':
        trimmed = body.rstrip(b'\x00\x09\x0a\x0c\x0d\x20')
        if (re.fullmatch(rb'%PDF-(?:1\.[0-7]|2\.0)', body[:8]) is None or
                not trimmed.endswith(b'%%EOF')):
            raise ValueError('ARTIFACT_INVALID')
        return
    if media_type != 'application/json':
        raise ValueError('ARTIFACT_INVALID')
    try:
        value = strict_json(body.decode('utf-8', errors='strict'))
        if not isinstance(value, dict):
            raise ValueError('ARTIFACT_INVALID')
        assert_json_bounds(value)
    except (UnicodeError, ValueError, RecursionError):
        raise ValueError('ARTIFACT_INVALID') from None

def write_private_file(path, body):
    """Create one review file exclusively without granting group/other access."""
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, 'O_NOFOLLOW'):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(path, flags, 0o600)
    try:
        remaining = memoryview(body)
        while remaining:
            written = os.write(descriptor, remaining)
            if written <= 0:
                raise OSError('private review file write made no progress')
            remaining = remaining[written:]
    finally:
        os.close(descriptor)

def export_package(base_url, job_id, output, key, fetch=None):
    url = urllib.parse.urlsplit(base_url)
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise ValueError('ENDPOINT_INVALID')
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,100}', job_id) or not isinstance(key, str) or len(key.encode()) < 32:
        raise ValueError('AUTH_OR_JOB_INVALID')
    if fetch is None:
        opener = urllib.request.build_opener(NoRedirect)
        def fetch(route, limit):
            req = urllib.request.Request(base_url.rstrip('/') + route, headers={'Authorization': 'Bearer ' + key})
            with request_deadline():
                with opener.open(req, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                    body = response.read(limit + 1)
                    if len(body) > limit:
                        raise ValueError('RESPONSE_TOO_LARGE')
            return body
    record = strict_json(fetch('/jobs/' + job_id + '/package', 262144).decode('utf-8', errors='strict'))
    if record.get('state') != 'qa_failed' or record.get('reason_code') != 'REVIEW_REQUIRED':
        raise ValueError('REVIEW_STATE_INVALID')
    manifest = record.get('manifest')
    if (record.get('id') != job_id or record.get('platform') not in PLATFORMS or
            not isinstance(manifest, dict) or manifest.get('platform') != record.get('platform') or
            manifest.get('schema_version') != 1 or manifest.get('publication_enabled') is not False):
        raise ValueError('MANIFEST_INVALID')
    files = manifest.get('files')
    expected_files = KDP_FILES if record.get('platform') == 'kdp' else BASE_FILES
    if not isinstance(files, dict) or set(files) != expected_files:
        raise ValueError('FILES_INVALID')
    for name, sha in files.items():
        if not re.fullmatch(r'[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,99}', name) or name in ('manifest.json',) or not isinstance(sha, str) or not HASH.fullmatch(sha):
            raise ValueError('FILE_INVALID')
    expected = manifest.get('package_sha256')
    stored_identity = record.get('manifest_sha256')
    canonical = json.dumps(manifest, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()
    if (not isinstance(expected, str) or not HASH.fullmatch(expected) or
            not isinstance(stored_identity, str) or not HASH.fullmatch(stored_identity) or
            hashlib.sha256(canonical).hexdigest() != stored_identity):
        raise ValueError('MANIFEST_IDENTITY_MISMATCH')
    root = Path(output)
    with output_attempt(
            root, 'REVIEW_EXPORT_OUTPUT_CLEANUP_FAILED', mode=0o700,
            parents=False):
        total = 0
        for name, sha in files.items():
            body = fetch('/jobs/' + job_id + '/artifacts/' + sha, 16 * 1024 * 1024)
            total += len(body)
            if len(body) > 16 * 1024 * 1024 or total > 64 * 1024 * 1024 or hashlib.sha256(body).hexdigest() != sha:
                raise ValueError('ARTIFACT_INVALID')
            assert_artifact_format(name, body)
            write_private_file(root / name, body)
        encoded_manifest = json.dumps(
            manifest, ensure_ascii=False, allow_nan=False).encode('utf-8')
        write_private_file(root / 'manifest.json', encoded_manifest)
    return {'status': 'REVIEW_REQUIRED', 'job_id': job_id, 'package_sha256': expected, 'publication_enabled': False}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', required=True, help='HTTPS API root ending /api/print')
    parser.add_argument('--job-id', required=True)
    parser.add_argument('--output', required=True, help='New directory only')
    args = parser.parse_args()
    try:
        print(json.dumps(export_package(args.base_url, args.job_id, args.output, os.environ.get('INTERNAL_OPERATIONS_KEY', ''))))
        return 0
    except Exception:
        print(json.dumps({'status': 'BLOCKED', 'reason_code': 'REVIEW_EXPORT_FAILED', 'publication_enabled': False}))
        return 1

if __name__ == '__main__':
    sys.exit(main())
