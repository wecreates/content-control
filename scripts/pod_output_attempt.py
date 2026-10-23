"""Ownership-checked cleanup for a newly created POD output directory."""
from contextlib import contextmanager
import errno
import os


def _identity(value):
    return value.st_dev, value.st_ino


def _clear_directory(directory_fd):
    """Recursively clear only directories reached through held descriptors."""
    for name in os.listdir(directory_fd):
        try:
            child_fd = os.open(
                name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                dir_fd=directory_fd)
        except OSError as exc:
            if exc.errno not in (errno.ELOOP, errno.ENOTDIR):
                raise
            os.unlink(name, dir_fd=directory_fd)
            continue
        try:
            child_identity = _identity(os.fstat(child_fd))
            _clear_directory(child_fd)
        finally:
            os.close(child_fd)
        try:
            current = os.stat(name, dir_fd=directory_fd,
                              follow_symlinks=False)
            if _identity(current) == child_identity:
                # Non-recursive removal cannot traverse a directory swapped in
                # after the identity check.
                os.rmdir(name, dir_fd=directory_fd)
        except FileNotFoundError:
            pass

@contextmanager
def output_attempt(output, cleanup_note='REVIEW_OUTPUT_CLEANUP_FAILED', *,
                   mode=0o700, parents=True):
    # Existing output is never a cleanup target. Hold the new directory open so
    # its inode cannot be recycled while checking for a concurrent replacement.
    output.mkdir(mode=mode, parents=parents, exist_ok=False)
    created = output.lstat()
    fd = os.open(output, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    owned = os.fstat(fd)
    owned_identity = _identity(owned)
    if _identity(created) != owned_identity:
        os.close(fd)
        raise RuntimeError('OUTPUT_REPLACED')
    try:
        yield
        current = output.lstat()
        if _identity(current) != owned_identity:
            raise RuntimeError('OUTPUT_REPLACED')
    except BaseException as failure:
        try:
            current = output.lstat()
            if _identity(current) == owned_identity:
                _clear_directory(fd)
                current = output.lstat()
                if _identity(current) == owned_identity:
                    # Keep the final pathname operation non-recursive. A
                    # nonempty replacement is preserved even if installed
                    # immediately after the second identity check.
                    output.rmdir()
        except FileNotFoundError:
            pass
        except OSError:
            # Preserve the stage failure and partial files if cleanup is denied.
            failure.add_note(cleanup_note)
        raise
    finally:
        os.close(fd)

