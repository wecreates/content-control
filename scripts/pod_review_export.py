"""Restore an exact stored package for independent QA. Never signs approval."""
import argparse
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import sys
import threading
import time
import urllib.parse
import urllib.request

HASH = re.compile(r'^[a-f0-9]{64}$')
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
    record = json.loads(fetch('/jobs/' + job_id + '/package', 262144))
    manifest = record.get('manifest')
    if record.get('id') != job_id or not isinstance(manifest, dict) or manifest.get('schema_version') != 1 or manifest.get('publication_enabled') is not False:
        raise ValueError('MANIFEST_INVALID')
    files = manifest.get('files')
    if not isinstance(files, dict) or not 1 <= len(files) <= 64:
        raise ValueError('FILES_INVALID')
    for name, sha in files.items():
        if not re.fullmatch(r'[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,99}', name) or name in ('manifest.json',) or not isinstance(sha, str) or not HASH.fullmatch(sha):
            raise ValueError('FILE_INVALID')
    expected = manifest.get('package_sha256')
    unsigned = {k: v for k, v in manifest.items() if k != 'package_sha256'}
    canonical = json.dumps(unsigned, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()
    if not isinstance(expected, str) or hashlib.sha256(canonical).hexdigest() != expected:
        raise ValueError('MANIFEST_HASH_MISMATCH')
    root = Path(output)
    root.mkdir(mode=0o700, parents=False, exist_ok=False)
    try:
        total = 0
        for name, sha in files.items():
            body = fetch('/artifacts/' + sha, 16 * 1024 * 1024)
            total += len(body)
            if len(body) > 16 * 1024 * 1024 or total > 64 * 1024 * 1024 or hashlib.sha256(body).hexdigest() != sha:
                raise ValueError('ARTIFACT_INVALID')
            with (root / name).open('xb') as target:
                target.write(body)
        with (root / 'manifest.json').open('x', encoding='utf-8') as target:
            json.dump(manifest, target, ensure_ascii=False, allow_nan=False)
    except BaseException:
        shutil.rmtree(root)
        raise
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
