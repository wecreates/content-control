"""Bound and bind technical QA to one captured set of package/reference bytes."""
from contextlib import contextmanager
import hashlib
import os
from pathlib import Path
import re
import stat
import tempfile
from pod_common import scoped_file, open_regular_binary

MAX_OBJECT_BYTES = 16 * 1024 * 1024
MAX_PACKAGE_BYTES = 64 * 1024 * 1024


def bounded_bytes(path, limit):
    # Do not block on a replaced pipe or follow a replaced final symlink.
    with open_regular_binary(path) as source:
        info = os.fstat(source.fileno())
        if not stat.S_ISREG(info.st_mode) or not 0 < info.st_size <= limit:
            raise ValueError('ARTIFACT_INVALID')
        data = source.read(limit + 1)
    if not 0 < len(data) <= limit:
        raise ValueError('ARTIFACT_INVALID')
    return data


@contextmanager
def capture_qa_inputs(root, reference, files):
    if not isinstance(files, dict) or not 1 <= len(files) <= 32:
        raise ValueError('ARTIFACT_BATCH_INVALID')
    # Production packages use flat generated filenames. Validate all entries
    # before opening any artifact; a manifest cannot select snapshot destinations.
    for name, sha in files.items():
        if (not isinstance(name, str) or not re.fullmatch(r'[-a-zA-Z0-9_.]{1,100}', name)
                or name in ('.', '..')):
            raise ValueError('ARTIFACT_PATH_INVALID')
        if not isinstance(sha, str) or not re.fullmatch(r'[a-f0-9]{64}', sha):
            raise ValueError('FILE_HASH_MISMATCH')
    with tempfile.TemporaryDirectory(prefix='pod-qa-snapshot-') as tmp:
        package = Path(tmp) / 'package'
        package.mkdir()
        total = 0
        for name, sha in files.items():
            data = bounded_bytes(scoped_file(root, name), MAX_OBJECT_BYTES)
            total += len(data)
            if total > MAX_PACKAGE_BYTES:
                raise ValueError('ARTIFACT_BATCH_TOO_LARGE')
            if hashlib.sha256(data).hexdigest() != sha:
                raise ValueError('FILE_HASH_MISMATCH')
            (package / name).write_bytes(data)
        # Reference identity and optional model inspection use the same copy.
        captured_reference = Path(tmp) / 'reference'
        captured_reference.write_bytes(bounded_bytes(Path(reference).resolve(strict=True), MAX_OBJECT_BYTES))
        yield package, captured_reference
