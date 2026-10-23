"""Ownership-checked cleanup for a newly created POD output directory."""
from contextlib import contextmanager
import os
import shutil

@contextmanager
def output_attempt(output, cleanup_note='REVIEW_OUTPUT_CLEANUP_FAILED', *,
                   mode=0o777, parents=True):
    # Existing output is never a cleanup target. Hold the new directory open so
    # its inode cannot be recycled while checking for a concurrent replacement.
    output.mkdir(mode=mode, parents=parents, exist_ok=False)
    fd = os.open(output, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    owned = os.fstat(fd)
    try:
        yield
    except BaseException as failure:
        try:
            current = output.lstat()
            if (current.st_dev, current.st_ino) == (owned.st_dev, owned.st_ino):
                shutil.rmtree(output)
        except FileNotFoundError:
            pass
        except OSError:
            # Preserve the stage failure and partial files if cleanup is denied.
            failure.add_note(cleanup_note)
        raise
    finally:
        os.close(fd)

