"""Bind a rendered interior to a cover package before independent review."""
import argparse
import sys
import hashlib
import os
import shutil
import stat
from pathlib import Path
from pod_common import (MAX_JSON_BYTES, canonical, digest, read_json, save_json,
                        scoped_file, strict_json, verified)
from pod_book_interior import render_book


def _identity(value):
    return value.st_dev, value.st_ino


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


def _commit_manifest(stage_fd, root_fd, original_identity, original_bytes):
    if _snapshot_file(root_fd, 'manifest.json') != (original_identity, original_bytes):
        raise ValueError('MANIFEST_CHANGED')
    expected = _identity(os.stat('manifest.json', dir_fd=stage_fd,
                                 follow_symlinks=False))
    try:
        os.replace('manifest.json', 'manifest.json',
                   src_dir_fd=stage_fd, dst_dir_fd=root_fd)
    except BaseException:
        # os.replace has no ordinary post-commit work. If an injected or
        # platform error is reported after the rename, recognize the exact
        # staged inode as committed rather than deleting files it references.
        try:
            if _identity(os.stat('manifest.json', dir_fd=root_fd,
                                 follow_symlinks=False)) == expected:
                return
        except OSError:
            pass
        raise


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


def assemble(root, spec, pages, font):
    root = Path(root)
    manifest = read_json(root/'manifest.json')
    previous = manifest.pop('package_sha256')
    if hashlib.sha256(canonical(manifest).encode()).hexdigest() != previous:
        raise ValueError('MANIFEST_HASH_MISMATCH')
    for name, sha in manifest['files'].items():
        if digest(scoped_file(root, name)) != sha:
            raise ValueError('FILE_HASH_MISMATCH')
    cover = manifest['template']
    if manifest['platform'] != 'kdp' or spec['platform'] != 'kdp':
        raise ValueError('PLATFORM_BLOCKED')
    kdp = cover['kdp']
    # The cover and interior templates are independently authenticated.
    # Bind their product-defining print choices before rendering: paper and ink
    # determine spine geometry, while binding determines the cover construction.
    if (spec.get('binding') != kdp.get('binding') or
        spec.get('ink_type') != kdp.get('ink_type') or
        spec.get('paper_type') != kdp.get('paper_type') or
        spec['page_count'] != kdp['page_count'] or
        abs(spec['trim_inches'][0]-kdp['trim_width_inches']) > 1e-6 or
        abs(spec['trim_inches'][1]+2*kdp['bleed_inches']-cover['size_inches'][1]) > 1e-6):
        raise ValueError('COVER_INTERIOR_MISMATCH')
    root_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        original_identity, original_bytes = _snapshot_file(root_fd, 'manifest.json')
        original_manifest = {**manifest, 'package_sha256': previous}
        if strict_json(original_bytes.decode('utf-8', errors='strict')) != original_manifest:
            raise ValueError('MANIFEST_CHANGED')
    except BaseException:
        os.close(root_fd)
        raise
    stage = root/('.pod-book-' + os.urandom(12).hex())
    stage_fd = None
    stage_identity = None
    installed = []
    committed = False
    failure = None
    try:
        stage.mkdir(mode=0o700)
        stage_fd = os.open(stage, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        stage_identity = _identity(os.fstat(stage_fd))
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
        _commit_manifest(stage_fd, root_fd, original_identity, original_bytes)
        committed = True
        return manifest
    except BaseException as exc:
        failure = exc
        if not committed:
            _cleanup_installed(root_fd, installed, exc)
        raise
    finally:
        try:
            if stage_identity is not None and _identity(stage.lstat()) == stage_identity:
                shutil.rmtree(stage)
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
