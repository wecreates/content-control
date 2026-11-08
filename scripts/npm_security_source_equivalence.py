"""Read-only source equivalence for previously authenticated npm scan evidence.

This does not authenticate a scan or validate any health report. Only the eight
literal output paths below may differ. All other tree/index/worktree entries
must match the audited source. Call again and compare the frozen snapshot before
promotion; callers must still exclude concurrent writers during the final write.
"""
from dataclasses import dataclass
import hashlib
import os
from pathlib import Path
import re
import stat
import subprocess

POLICY_VERSION = 1
CANONICAL_NPM = (
    'state/runtime-security-audit.json',
    'state/runtime-security-audit-hosted.json',
)
GENERATED_WATCHDOG = (
    'state/free-production-watchdog.json',
    'state/system-completion.json',
    'state/operations-snapshot.json',
    'state/workflow-control-health.json',
    'state/system-wiring-health.json',
    'state/deployment-health.json',
)
ALLOWED_EVIDENCE = frozenset((*CANONICAL_NPM, *GENERATED_WATCHDOG))
_SHA = re.compile(r'[0-9a-f]{40}\Z')


class SourceEquivalenceError(ValueError):
    """Fail-closed source or checkout mismatch, with no file contents disclosed."""


@dataclass(frozen=True)
class SourceEquivalenceSnapshot:
    root: str
    audited_sha: str
    head_sha: str
    source_tree_sha: str
    head_tree_sha: str
    index_sha256: str
    worktree_sha256: str
    policy_version: int = POLICY_VERSION


def _digest(entries):
    digest = hashlib.sha256()
    for path, value in sorted(entries.items()):
        for item in (path, *value):
            data = os.fsencode(item)
            digest.update(str(len(data)).encode() + b':' + data)
    return digest.hexdigest()


def _path(raw):
    path = os.fsdecode(raw)
    if not path or path.startswith('/') or any(p in ('', '.', '..', '.git') for p in path.split('/')):
        raise SourceEquivalenceError('Unsafe Git tree path')
    return path


def _check_allowed(entries):
    for path in ALLOWED_EVIDENCE & entries.keys():
        if entries[path][:2] != ('100644', 'blob'):
            raise SourceEquivalenceError('Evidence path must be a regular non-executable file: ' + path)


def _compare(source, target, label):
    _check_allowed(source)
    _check_allowed(target)
    # Evidence can be added or updated, never deleted/renamed after it exists.
    if (source.keys() & ALLOWED_EVIDENCE) - target.keys():
        raise SourceEquivalenceError(label + ' deletes an existing evidence file')
    protected = (source.keys() | target.keys()) - ALLOWED_EVIDENCE
    for path in protected:
        left, right = source.get(path), target.get(path)
        # Directory IDs include allowed child changes; directory paths/modes
        # are still compared. Leaf modes, types and blob IDs must match exactly.
        if left and left[1] == 'tree':
            left = left[:2]
        if right and right[1] == 'tree':
            right = right[:2]
        if left != right:
            raise SourceEquivalenceError(label + ' changes protected source: ' + path)


def _trees(git, revision):
    entries = {}
    for record in git('ls-tree', '-r', '-t', '-z', '--full-tree', revision).split(b'\0'):
        if not record:
            continue
        try:
            header, raw = record.split(b'\t', 1)
            mode, kind, oid = header.decode('ascii').split(' ')
        except (ValueError, UnicodeError) as error:
            raise SourceEquivalenceError('Malformed Git tree') from error
        path = _path(raw)
        if path in entries or not _SHA.fullmatch(oid):
            raise SourceEquivalenceError('Duplicate path or invalid Git object')
        if (mode, kind) not in (('040000', 'tree'), ('100644', 'blob'), ('100755', 'blob')):
            raise SourceEquivalenceError('Unsupported Git object type: ' + path)
        entries[path] = (mode, kind, oid)
    return entries


def _index(git):
    entries = {}
    for record in git('ls-files', '--stage', '-z').split(b'\0'):
        if not record:
            continue
        try:
            header, raw = record.split(b'\t', 1)
            mode, oid, stage = header.decode('ascii').split(' ')
        except (ValueError, UnicodeError) as error:
            raise SourceEquivalenceError('Malformed Git index') from error
        path = _path(raw)
        if stage != '0' or path in entries or not _SHA.fullmatch(oid):
            raise SourceEquivalenceError('Unmerged or invalid Git index')
        if mode not in ('100644', '100755'):
            raise SourceEquivalenceError('Unsupported Git index mode: ' + path)
        entries[path] = (mode, 'blob', oid)
    return entries


def _signature(info):
    return (info.st_dev, info.st_ino, info.st_mode, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def _blob(path, expected):
    flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
    descriptor = os.open(path, flags)
    try:
        before = os.fstat(descriptor)
        if not stat.S_ISREG(before.st_mode) or _signature(before) != _signature(expected):
            raise SourceEquivalenceError('Working file changed while opening')
        digest = hashlib.sha1(b'blob ' + str(before.st_size).encode() + b'\0')
        length = 0
        while True:
            block = os.read(descriptor, 1024 * 1024)
            if not block:
                break
            length += len(block)
            digest.update(block)
        if length != before.st_size or _signature(before) != _signature(os.fstat(descriptor)):
            raise SourceEquivalenceError('Working file changed while hashing')
        if _signature(before) != _signature(os.lstat(path)):
            raise SourceEquivalenceError('Working file changed after hashing')
        return digest.hexdigest()
    finally:
        os.close(descriptor)


def _worktree(root, source):
    entries = {}
    # Enumerate independently of Git ignore, assume-unchanged and skip-worktree.
    # This intentionally also rejects ignored untracked files such as caches.
    def visit(directory, prefix=''):
        before = os.lstat(directory)
        if not stat.S_ISDIR(before.st_mode):
            raise SourceEquivalenceError('Working directory is not a real directory')
        with os.scandir(directory) as scan:
            children = sorted(scan, key=lambda entry: entry.name)
        for child in children:
            if not prefix and child.name == '.git':
                continue
            relative = prefix + child.name
            info = child.stat(follow_symlinks=False)
            expected = source.get(relative)
            if relative in ALLOWED_EVIDENCE:
                if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o111:
                    raise SourceEquivalenceError('Unsafe working evidence mode: ' + relative)
            elif expected is None:
                if stat.S_ISDIR(info.st_mode):
                    # Untracked empty directories are not Git tree paths. Still
                    # traverse them so ignored/untracked children cannot hide.
                    visit(child.path, relative + '/')
                    continue
                raise SourceEquivalenceError('Untracked source is not audited: ' + relative)
            if stat.S_ISDIR(info.st_mode):
                entries[relative] = ('040000', 'tree', '')
                visit(child.path, relative + '/')
            elif stat.S_ISREG(info.st_mode):
                mode = '100755' if info.st_mode & 0o111 else '100644'
                entries[relative] = (mode, 'blob', _blob(child.path, info))
            else:
                raise SourceEquivalenceError('Non-regular working source: ' + relative)
        if _signature(before) != _signature(os.lstat(directory)):
            raise SourceEquivalenceError('Working directory changed during verification')
    visit(root)
    return entries


def assert_source_equivalent(root, audited_sha, runner=subprocess.run, *, expected_head=None):
    """Return a frozen snapshot or raise SourceEquivalenceError.

    Requires a complete SHA-1 Git checkout. Unchanged executable source files
    are compared exactly; *evidence* must always be mode 100644. All symlinks and
    submodules are rejected because external/nested targets are not verified.
    runner has subprocess.run's bytes/capture_output/timeout/env interface.
    """
    if not isinstance(audited_sha, str) or not _SHA.fullmatch(audited_sha):
        raise SourceEquivalenceError('Audited source must be a full lowercase SHA')
    if expected_head is not None and (not isinstance(expected_head, str) or not _SHA.fullmatch(expected_head)):
        raise SourceEquivalenceError('Expected HEAD must be a full lowercase SHA')
    root = Path(root).resolve()
    # No credential values are needed. Ignore inherited Git redirections, global
    # configuration, replace refs, optional locks and fsmonitor executables.
    env = {key: os.environ[key] for key in ('PATH', 'SYSTEMROOT', 'WINDIR') if key in os.environ}
    env.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull,
               GIT_OPTIONAL_LOCKS='0', GIT_NO_REPLACE_OBJECTS='1', LC_ALL='C')
    def git(*args):
        result = runner(['git', '--no-replace-objects', '-c', 'core.fsmonitor=false', *args],
                        cwd=root, capture_output=True, timeout=60, env=env)
        if result.returncode or not isinstance(result.stdout, bytes):
            raise SourceEquivalenceError('Cannot verify Git source equivalence')
        return result.stdout
    try:
        top = Path(os.fsdecode(git('rev-parse', '--show-toplevel').strip())).resolve()
        if top != root:
            raise SourceEquivalenceError('Checkout must be the repository root')
        grafts = Path(os.fsdecode(git('rev-parse', '--git-path', 'info/grafts').strip()))
        if not grafts.is_absolute():
            grafts = root / grafts
        if grafts.exists() or grafts.is_symlink():
            raise SourceEquivalenceError('Git graft ancestry is not accepted')
        head = git('rev-parse', '--verify', 'HEAD').strip().decode('ascii')
        if not _SHA.fullmatch(head) or (expected_head is not None and head != expected_head):
            raise SourceEquivalenceError('Current HEAD does not match requested target')
        if git('cat-file', '-t', audited_sha).strip() != b'commit':
            raise SourceEquivalenceError('Audited source is not a commit')
        git('merge-base', '--is-ancestor', audited_sha, head)
        source = _trees(git, audited_sha)
        current = _trees(git, head)
        _compare(source, current, 'Committed tree')
        index = _index(git)
        current_files = {path: value for path, value in current.items() if value[1] != 'tree'}
        _compare(current_files, index, 'Index')
        working = _worktree(root, current)
        _compare(current, working, 'Working tree')
        # An indexed addition must exist safely in the working tree too.
        _compare(index, {p: v for p, v in working.items() if v[1] != 'tree'}, 'Working index')
        if git('rev-parse', '--verify', 'HEAD').strip().decode('ascii') != head or _index(git) != index:
            raise SourceEquivalenceError('HEAD or index changed during verification')
        return SourceEquivalenceSnapshot(
            str(root), audited_sha, head,
            git('rev-parse', audited_sha + '^{tree}').strip().decode('ascii'),
            git('rev-parse', head + '^{tree}').strip().decode('ascii'),
            _digest(index), _digest(working))
    except SourceEquivalenceError:
        raise
    except (OSError, ValueError, UnicodeError, subprocess.SubprocessError) as error:
        raise SourceEquivalenceError('Source equivalence could not be established') from error
