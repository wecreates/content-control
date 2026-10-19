"""Read-only byte/receipt preflight. Observed hashes never create approval."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import os
import stat


def observed_hash(path, limit):
    fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NONBLOCK', 0))
    try:
        before = os.fstat(fd)
        identity = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
        if not stat.S_ISREG(before.st_mode) or not 0 < before.st_size <= limit:
            raise ValueError('Bounded regular file required')
        h, size = hashlib.sha256(), 0
        with os.fdopen(fd, 'rb') as stream:
            fd = None
            for chunk in iter(lambda: stream.read(65536), b''):
                size += len(chunk)
                if size > limit:
                    raise ValueError('Input exceeded limit')
                h.update(chunk)
            if size != before.st_size or identity(os.fstat(stream.fileno())) != identity(before):
                raise ValueError('Input changed')
        if identity(path.stat()) != identity(before):
            raise ValueError('Input replaced')
        return h.hexdigest()
    finally:
        if fd is not None:
            os.close(fd)


def inspect(root):
    root = Path(root)
    result = {'status': 'BLOCKED', 'publication_enabled': False,
              'production_approved': False, 'reasons': [], 'observed': {}}
    def load(name):
        try:
            value = json.loads((root / name).read_text(encoding='utf-8'))
            if not isinstance(value, dict):
                raise ValueError('object required')
            return value
        except (OSError, ValueError):
            result['reasons'].append(name + ': unavailable_or_invalid')
            return {}
    health = load('state/content-control-health.json')
    caption = load('state/caption-health.json')
    hashes = {}
    for kind, name in [('candidate', 'public-review/episode1-v10-free.mp4'),
                       ('caption', 'public-review/episode1-v10-free.vtt')]:
        try:
            hashes[kind] = observed_hash(root / name, (512 if kind == 'candidate' else 2) * 1024 * 1024)
        except (OSError, ValueError):
            result['reasons'].append(kind + '_bytes_missing_or_invalid')
    result['observed'] = hashes
    if health.get('status') != 'GREEN' or health.get('publication_enabled') is not False:
        result['reasons'].append('candidate_receipt_not_green')
    if caption.get('status') != 'PASS' or caption.get('publication_enabled') is not False:
        result['reasons'].append('caption_receipt_not_pass')
    for label, claim, actual in [
        ('candidate', health.get('candidate_sha256'), hashes.get('candidate')),
        ('caption', caption.get('caption_sha256'), hashes.get('caption')),
        ('caption_candidate', caption.get('candidate_sha256'), hashes.get('candidate')),
    ]:
        if not isinstance(claim, str) or not re.fullmatch('[0-9a-f]{64}', claim) or claim != actual:
            result['reasons'].append(label + '_binding_missing_or_mismatched')
    if not result['reasons']:
        result['status'] = 'INPUTS_BOUND'
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default='.')
    args = parser.parse_args()
    report = inspect(args.root)
    print(json.dumps(report, sort_keys=True))
    raise SystemExit(0 if report['status'] == 'INPUTS_BOUND' else 2)
