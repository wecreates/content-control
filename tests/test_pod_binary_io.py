"""Bounded regular-file hashing and production snapshots; no live inputs."""
import hashlib
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import pod_common as common
from pod_asset_generator import input_snapshot


class BinaryInputTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'input'

    def test_fifo_hasher_rejects_without_waiting_for_writer(self):
        self.check_fifo('from pod_common import digest; digest(path)')

    def test_fifo_art_snapshot_rejects_without_waiting_for_writer(self):
        self.check_fifo('from pod_asset_generator import input_snapshot; input_snapshot(path)')

    def test_fifo_book_font_rejects_before_parser_or_output(self):
        self.check_fifo("from pod_book_interior import render_book; render_book("
            "{'platform':'kdp','interior_type':'text_no_bleed','page_count':1,"
            "'trim_inches':[2,2],'margins_inches':dict(inside=.25,outside=.25,top=.25,bottom=.25)},"
            "[{'lines':['fixture']}],path,path+'.pdf')")
        self.assertFalse(Path(str(self.path)+'.pdf').exists())

    def check_fifo(self, action):
        os.mkfifo(self.path)
        script = ("import sys\npath=sys.argv[1]\ntry:\n " + action +
                  "\nexcept ValueError as e:\n assert str(e)=='BINARY_FILE_INVALID'\n"
                  "else: raise AssertionError('FIFO accepted')\n")
        result = subprocess.run([sys.executable, '-c', script, str(self.path)],
            env={**os.environ, 'PYTHONPATH': str(Path(__file__).resolve().parents[1]/'scripts')},
            capture_output=True, text=True, timeout=2)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_device_cannot_be_hashed_as_empty_file(self):
        with self.assertRaisesRegex(ValueError, '^BINARY_FILE_INVALID$'):
            common.digest('/dev/null')

    def test_device_cannot_become_an_input_snapshot(self):
        with self.assertRaisesRegex(ValueError, '^BINARY_FILE_INVALID$'):
            input_snapshot('/dev/null')

    def test_final_symlink_rejected_by_both_paths(self):
        target = self.path.with_name('target')
        target.write_bytes(b'fixture')
        self.path.symlink_to(target)
        for read in (common.digest, input_snapshot):
            with self.subTest(read=read.__name__), self.assertRaises(OSError):
                read(self.path)
        self.assertEqual(target.read_bytes(), b'fixture')

    def test_hash_ceiling_and_empty_file_preserve_exact_sha256(self):
        for body in (b'', b'a'*8):
            self.path.write_bytes(body)
            with patch.object(common, 'MAX_DIGEST_BYTES', 8, create=True):
                self.assertEqual(common.digest(self.path), hashlib.sha256(body).hexdigest())

    def test_oversized_file_rejected(self):
        self.path.write_bytes(b'a'*9)
        with patch.object(common, 'MAX_DIGEST_BYTES', 8, create=True):
            with self.assertRaisesRegex(ValueError, '^DIGEST_TOO_LARGE$'):
                common.digest(self.path)

    def test_real_object_ceiling_spans_chunks_without_truncation(self):
        body = b'a' * (16 * 1024 * 1024)
        self.path.write_bytes(body)
        self.assertEqual(common.digest(self.path), hashlib.sha256(body).hexdigest())
        with self.path.open('ab') as target: target.write(b'b')
        with self.assertRaisesRegex(ValueError, '^DIGEST_TOO_LARGE$'):
            common.digest(self.path)

    def test_growth_after_descriptor_stat_still_rejected(self):
        self.path.write_bytes(b'a'*9)
        with patch.object(common, 'MAX_DIGEST_BYTES', 8, create=True), \
             patch.object(common.os, 'fstat', return_value=SimpleNamespace(st_mode=stat.S_IFREG, st_size=1)):
            with self.assertRaisesRegex(ValueError, '^DIGEST_TOO_LARGE$'):
                common.digest(self.path)

    def test_hash_reads_at_most_limit_plus_one_and_closes_on_rejection(self):
        self.path.write_bytes(b'a'*100)
        real_fdopen = os.fdopen
        reads, sources = [], []
        class Stream:
            def __init__(self, source): self.source = source
            def __enter__(self): return self
            def __exit__(self, *args): self.source.close()
            def read(self, size):
                reads.append(size)
                return self.source.read(size)
        def wrap(fd, mode):
            source = real_fdopen(fd, mode); sources.append(source); return Stream(source)
        with patch.object(common, 'MAX_DIGEST_BYTES', 8, create=True), \
             patch.object(common.os, 'fstat', return_value=SimpleNamespace(st_mode=stat.S_IFREG, st_size=1)), \
             patch.object(common.os, 'fdopen', side_effect=wrap):
            with self.assertRaisesRegex(ValueError, '^DIGEST_TOO_LARGE$'):
                common.digest(self.path)
        self.assertEqual(reads, [9]); self.assertTrue(sources[0].closed)

    def test_hash_descriptor_closes_on_invalid_file(self):
        fd = os.open('/dev/null', os.O_RDONLY)
        with patch.object(common.os, 'open', return_value=fd):
            with self.assertRaisesRegex(ValueError, '^BINARY_FILE_INVALID$'):
                common.digest(self.path)
        with self.assertRaises(OSError): os.fstat(fd)

    def test_hash_descriptor_closes_on_wrapper_failure(self):
        self.path.write_bytes(b'fixture')
        fd = os.open(self.path, os.O_RDONLY)
        with patch.object(common.os, 'open', return_value=fd), \
             patch.object(common.os, 'fdopen', side_effect=OSError('fixture')):
            with self.assertRaisesRegex(OSError, '^fixture$'): common.digest(self.path)
        with self.assertRaises(OSError): os.fstat(fd)

    def test_hash_read_failure_closes_owned_stream(self):
        self.path.write_bytes(b'fixture')
        fd = os.open(self.path, os.O_RDONLY)
        source = os.fdopen(fd, 'rb')
        with patch.object(common.os, 'open', return_value=fd), \
             patch.object(common.os, 'fdopen', return_value=source), \
             patch.object(source, 'read', side_effect=OSError('fixture read')):
            with self.assertRaisesRegex(OSError, '^fixture read$'): common.digest(self.path)
        self.assertTrue(source.closed)


if __name__ == '__main__':
    unittest.main()
