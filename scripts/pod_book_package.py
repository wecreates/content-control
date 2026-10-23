"""Bind a rendered interior to a cover package before independent review."""
import argparse
import sys
import hashlib
import os
import stat
from pathlib import Path
from pod_common import (MAX_DIGEST_BYTES, MAX_JSON_BYTES, canonical, digest,
                        read_json, save_json, scoped_file, strict_json, verified)
from pod_book_interior import render_book


def _identity(value):
    return value.st_dev, value.st_ino


class _ManifestRollbackFailed(ValueError):
    preserve_installed = True


def _require_path_identity(path, expected):
    try:
        if _identity(path.lstat()) != expected:
            raise RuntimeError('PACKAGE_REPLACED')
    except FileNotFoundError:
        raise RuntimeError('PACKAGE_REPLACED') from None


def _descriptor_directory(directory_fd, expected, unavailable):
    # All supported worker environments are Linux, where /proc/self/fd is a
    # kernel-owned alias for an already-open descriptor.  Keep pathname-only
    # render and JSON helpers anchored to the directory we opened rather than
    # resolving the caller-visible package path again.
    path = Path('/proc/self/fd')/str(directory_fd)
    try:
        if _identity(path.stat()) == expected:
            return path
    except OSError:
        pass
    raise RuntimeError(unavailable)


def _snapshot_file(directory_fd, name):
    fd = os.open(name, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW,
                 dir_fd=directory_fd)
    try:
        value = os.fstat(fd)
        if not stat.S_ISREG(value.st_mode):
            raise ValueError('MANIFEST_CHANGED')
        data = bytearray()
        while len(data) <= MAX_JSON_BYTES:
            chunk = os.read(fd, min(1024 * 1024, MAX_JSON_BYTES + 1 - len(data)))
            if not chunk:
                break
            data.extend(chunk)
        if len(data) > MAX_JSON_BYTES:
            raise ValueError('JSON_TOO_LARGE')
        return _identity(value), bytes(data)
    finally:
        os.close(fd)


def _stage_bytes(directory_fd, name, data):
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW
    fd = os.open(name, flags, 0o600, dir_fd=directory_fd)
    try:
        view = memoryview(data)
        while view:
            written = os.write(fd, view)
            if written == 0:
                raise OSError('short write')
            view = view[written:]
        os.fsync(fd)
        return _identity(os.fstat(fd))
    finally:
        os.close(fd)


def _link_staged(stage_fd, root_fd, name):
    expected = _identity(os.stat(name, dir_fd=stage_fd, follow_symlinks=False))
    try:
        os.link(name, name, src_dir_fd=stage_fd, dst_dir_fd=root_fd,
                follow_symlinks=False)
    except FileExistsError:
        raise ValueError('OUTPUT_EXISTS') from None
    if _identity(os.stat(name, dir_fd=root_fd, follow_symlinks=False)) != expected:
        raise RuntimeError('BOOK_OUTPUT_INSTALL_FAILED')
    return expected


def _descriptor_digest(root_fd, relative):
    if (type(relative) is not str or not relative or relative.startswith('/')
            or any(part in ('', '.', '..') for part in relative.split('/'))):
        raise ValueError('ARTIFACT_PATH_INVALID')
    directory_fd = None
    file_fd = None
    try:
        directory_fd = os.dup(root_fd)
        parts = relative.split('/')
        for part in parts[:-1]:
            next_fd = os.open(
                part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                dir_fd=directory_fd)
            os.close(directory_fd)
            directory_fd = next_fd
        file_fd = os.open(
            parts[-1], os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW,
            dir_fd=directory_fd)
        if not stat.S_ISREG(os.fstat(file_fd).st_mode):
            raise ValueError('ARTIFACT_PATH_INVALID')
        hasher = hashlib.sha256()
        total = 0
        while True:
            chunk = os.read(file_fd,
                            min(1024 * 1024, MAX_DIGEST_BYTES - total + 1))
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_DIGEST_BYTES:
                raise ValueError('DIGEST_TOO_LARGE')
            hasher.update(chunk)
        return hasher.hexdigest()
    except OSError:
        raise ValueError('ARTIFACT_PATH_INVALID') from None
    finally:
        if file_fd is not None:
            os.close(file_fd)
        if directory_fd is not None:
            os.close(directory_fd)


def _verify_declared_files(package, root_fd, files):
    for name, sha in files.items():
        # Preserve the manifest-facing scope validation and then walk every
        # path component through the held package descriptor. A parent cannot
        # be swapped to a symlink between pathname validation and hashing.
        scoped_file(package, name)
        if _descriptor_digest(root_fd, name) != sha:
            raise ValueError('FILE_HASH_MISMATCH')


def _replace_staged(stage_fd, root_fd, name, expected, expected_bytes):
    try:
        os.replace(name, 'manifest.json',
                   src_dir_fd=stage_fd, dst_dir_fd=root_fd)
    except BaseException:
        # An injected or platform error can be reported after rename. Recognize
        # only the exact staged inode as installed before deciding to recover.
        try:
            if _snapshot_file(root_fd, 'manifest.json') == \
                    (expected, expected_bytes):
                return
        except BaseException:
            pass
        raise
    # A successful rename does not prove that the destination still names the
    # installed inode or retains its staged bytes when another same-user writer
    # can replace or modify it immediately afterwards. Confirm the complete
    # namespace result before treating the commit (or rollback) as complete.
    try:
        current = _snapshot_file(root_fd, 'manifest.json')
    except (OSError, ValueError):
        raise ValueError('MANIFEST_CHANGED') from None
    if current != (expected, expected_bytes):
        raise ValueError('MANIFEST_CHANGED')


def _commit_manifest(stage_fd, root_fd, original_identity, original_bytes,
                     rollback_identity, package, expected_files):
    if _snapshot_file(root_fd, 'manifest.json') != (original_identity, original_bytes):
        raise ValueError('MANIFEST_CHANGED')
    # Rendering and installation can take long enough for a package member to
    # be replaced after its digest is recorded. Bind the final manifest commit
    # to every current byte through the already-verified package descriptor.
    _verify_declared_files(package, root_fd, expected_files)
    expected, expected_bytes = _snapshot_file(stage_fd, 'manifest.json')
    try:
        _replace_staged(stage_fd, root_fd, 'manifest.json', expected,
                        expected_bytes)
        _verify_declared_files(package, root_fd, expected_files)
    except BaseException as verification_failure:
        try:
            _replace_staged(stage_fd, root_fd, 'manifest.rollback.json',
                            rollback_identity, original_bytes)
            os.fsync(root_fd)
        except BaseException as rollback_failure:
            failure = _ManifestRollbackFailed('BOOK_MANIFEST_ROLLBACK_FAILED')
            failure.add_note(type(verification_failure).__name__)
            raise failure from rollback_failure
        raise
    return expected, expected_bytes


def _cleanup_installed(root_fd, installed, failure):
    cleanup_failed = False
    for name, expected in reversed(installed):
        try:
            current = os.stat(name, dir_fd=root_fd, follow_symlinks=False)
            if _identity(current) == expected:
                os.unlink(name, dir_fd=root_fd)
        except FileNotFoundError:
            pass
        except OSError:
            cleanup_failed = True
    if cleanup_failed:
        failure.add_note('BOOK_PACKAGE_CLEANUP_FAILED')


def _clear_staging(stage_fd):
    """Remove only non-directory entries from the staging dir we opened."""
    for name in os.listdir(stage_fd):
        current = os.stat(name, dir_fd=stage_fd, follow_symlinks=False)
        if stat.S_ISDIR(current.st_mode):
            raise OSError('unexpected staging directory')
        os.unlink(name, dir_fd=stage_fd)


def assemble(root, spec, pages, font):
    root = Path(root)
    root_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        root_identity = _identity(os.fstat(root_fd))
        _require_path_identity(root, root_identity)
        package = _descriptor_directory(root_fd, root_identity,
                                        'BOOK_PACKAGE_PATH_UNAVAILABLE')
        original_identity, original_bytes = _snapshot_file(root_fd, 'manifest.json')
        manifest = strict_json(original_bytes.decode('utf-8', errors='strict'))
        previous = manifest.pop('package_sha256')
        if hashlib.sha256(canonical(manifest).encode()).hexdigest() != previous:
            raise ValueError('MANIFEST_HASH_MISMATCH')
        declared_files = dict(manifest['files'])
        _verify_declared_files(package, root_fd, declared_files)
        cover = manifest['template']
        if manifest['platform'] != 'kdp' or spec['platform'] != 'kdp':
            raise ValueError('PLATFORM_BLOCKED')
        kdp = cover['kdp']
        # The cover and interior templates are independently authenticated.
        # Bind their product-defining print choices before rendering: paper and
        # ink determine spine geometry, while binding determines construction.
        if (spec.get('binding') != kdp.get('binding') or
            spec.get('ink_type') != kdp.get('ink_type') or
            spec.get('paper_type') != kdp.get('paper_type') or
            spec['page_count'] != kdp['page_count'] or
            abs(spec['trim_inches'][0]-kdp['trim_width_inches']) > 1e-6 or
            abs(spec['trim_inches'][1]+2*kdp['bleed_inches']-
                cover['size_inches'][1]) > 1e-6):
            raise ValueError('COVER_INTERIOR_MISMATCH')
    except BaseException:
        os.close(root_fd)
        raise
    stage_name = '.pod-book-' + os.urandom(12).hex()
    stage_fd = None
    stage_identity = None
    installed = []
    committed = False
    failure = None
    try:
        _require_path_identity(root, root_identity)
        os.mkdir(stage_name, mode=0o700, dir_fd=root_fd)
        stage_fd = os.open(stage_name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                           dir_fd=root_fd)
        stage_identity = _identity(os.fstat(stage_fd))
        stage = _descriptor_directory(stage_fd, stage_identity,
                                      'BOOK_STAGING_PATH_UNAVAILABLE')
        rollback_identity = _stage_bytes(stage_fd, 'manifest.rollback.json',
                                         original_bytes)
        receipt = render_book(spec, pages, font, stage/'interior.pdf')
        save_json(stage/'interior.receipt.json', receipt)
        manifest['interior'] = {'template': spec, 'receipt': receipt}
        for name in ('interior.pdf', 'interior.receipt.json'):
            manifest['files'][name] = digest(stage/name)
        manifest['package_sha256'] = hashlib.sha256(canonical(manifest).encode()).hexdigest()
        save_json(stage/'manifest.json', manifest)
        for name in ('interior.pdf', 'interior.receipt.json'):
            installed.append((name, _link_staged(stage_fd, root_fd, name)))
        os.fsync(root_fd)
        expected_files = dict(manifest['files'])
        committed_manifest = _commit_manifest(
            stage_fd, root_fd, original_identity, original_bytes,
            rollback_identity, package, expected_files)
        # The files and their links were synchronized before the manifest
        # rename. Persist that final directory-entry change before reporting a
        # durable package. Treat a sync failure as post-commit: leaving the
        # complete manifest and its referenced files together is safer than
        # deleting files from a manifest that may already survive a crash.
        committed = True
        try:
            os.fsync(root_fd)
        except OSError as exc:
            raise ValueError('BOOK_PACKAGE_DURABILITY_UNCERTAIN') from exc
        # A same-user writer can still modify the installed manifest or one of
        # its members while the final directory sync is in progress. Recheck
        # the exact committed manifest and every declared byte after that
        # durability boundary. The manifest may already be durable, so a
        # mismatch is preserved for recovery rather than partially cleaned.
        try:
            if _snapshot_file(root_fd, 'manifest.json') != committed_manifest:
                raise ValueError('MANIFEST_CHANGED')
            _verify_declared_files(package, root_fd, expected_files)
        except (OSError, ValueError):
            raise ValueError('BOOK_PACKAGE_CHANGED_AFTER_COMMIT') from None
        _require_path_identity(root, root_identity)
        return manifest
    except BaseException as exc:
        failure = exc
        if not committed and not getattr(exc, 'preserve_installed', False):
            _cleanup_installed(root_fd, installed, exc)
        raise
    finally:
        try:
            if stage_identity is not None:
                # Empty the directory through its held descriptor first.  A
                # same-user writer can replace the caller-visible stage name
                # after the identity check below; a final non-recursive rmdir
                # cannot traverse and delete that replacement's contents.
                _clear_staging(stage_fd)
            if (stage_identity is not None and
                    _identity(os.stat(stage_name, dir_fd=root_fd,
                                      follow_symlinks=False)) == stage_identity):
                os.rmdir(stage_name, dir_fd=root_fd)
        except FileNotFoundError:
            pass
        except OSError:
            if failure is not None:
                failure.add_note('BOOK_STAGING_CLEANUP_FAILED')
        if stage_fd is not None:
            os.close(stage_fd)
        os.close(root_fd)


def main():
    parser = argparse.ArgumentParser()
    for name in ('package-dir', 'template', 'pages', 'font'):
        parser.add_argument('--'+name, required=True)
    args = parser.parse_args()
    try:
        template_envelope = read_json(args.template)
        spec = verified(template_envelope, 'POD_TEMPLATE_KEY', 'pod:interior-template')['template']
        result = assemble(args.package_dir, spec, read_json(args.pages), args.font)
        verified(template_envelope, 'POD_TEMPLATE_KEY', 'pod:interior-template')
        print(canonical(result))
        return 0
    except Exception as exc:
        print(canonical({'status':'BLOCKED','reason_code':str(exc) if isinstance(exc,ValueError) else type(exc).__name__,'publication_enabled':False}))
        return 2


if __name__ == '__main__':
    sys.exit(main())
