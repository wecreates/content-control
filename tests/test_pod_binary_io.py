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
from pod_original_art import create_art
from pod_book_interior import render_book


class OriginalArtOutputTests(unittest.TestCase):
    spec = {'concept_id': 'output-fixture', 'size_px': [300, 300],
            'palette': [[0, 0, 0, 255], [80, 90, 120, 255]]}

    def test_collision_after_initial_check_preserves_concurrent_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / 'art.png'
            target.write_bytes(b'concurrent-original')
            with patch.object(Path, 'exists', return_value=False):
                with self.assertRaises((ValueError, FileExistsError)):
                    create_art(self.spec, target)
            self.assertEqual(target.read_bytes(), b'concurrent-original')
            self.assertEqual(list(Path(tmp).iterdir()), [target])

    def test_dangling_symlink_never_creates_its_destination(self):
        with tempfile.TemporaryDirectory() as tmp:
            target, destination = Path(tmp) / 'art.png', Path(tmp) / 'other.png'
            target.symlink_to(destination)
            with self.assertRaises((ValueError, OSError)):
                create_art(self.spec, target)
            self.assertTrue(target.is_symlink())
            self.assertFalse(destination.exists())
            self.assertEqual(list(Path(tmp).iterdir()), [target])

    def test_success_is_private_deterministic_and_hash_bound(self):
        with tempfile.TemporaryDirectory() as tmp:
            outputs = [Path(tmp) / name for name in ('one.png', 'two.png')]
            receipts = [create_art(self.spec, target) for target in outputs]
            self.assertEqual(receipts[0], receipts[1])
            for target, receipt in zip(outputs, receipts):
                self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o600)
                self.assertEqual(receipt['source_sha256'], common.digest(target))
                self.assertFalse(receipt['publication_enabled'])
                self.assertEqual(receipt['rights_status'], 'UNASSESSED')
            self.assertEqual(set(Path(tmp).iterdir()), set(outputs))

    def test_failed_encoder_leaves_no_output_or_temporary_file(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / 'art.png'
            def fail(_image, stream, *args, **kwargs):
                if hasattr(stream, 'write'):
                    stream.write(b'partial-fixture')
                else:
                    Path(stream).write_bytes(b'partial-fixture')
                raise OSError('encoder fixture')
            with patch.object(Image.Image, 'save', autospec=True, side_effect=fail):
                with self.assertRaisesRegex(OSError, '^encoder fixture$'):
                    create_art(self.spec, target)
            self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_failed_file_sync_does_not_publish_partial_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / 'art.png'
            with patch('pod_original_art.os.fsync', side_effect=OSError('sync fixture')):
                with self.assertRaisesRegex(OSError, '^sync fixture$'):
                    create_art(self.spec, target)
            self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_failed_directory_sync_preserves_complete_output_without_receipt(self):
        real_sync = os.fsync
        def sync(fd):
            if stat.S_ISDIR(os.fstat(fd).st_mode):
                raise OSError('directory fixture')
            real_sync(fd)
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / 'art.png'
            with patch('pod_original_art.os.fsync', side_effect=sync):
                with self.assertRaisesRegex(OSError, '^directory fixture$'):
                    create_art(self.spec, target)
            from PIL import Image
            with Image.open(target) as image:
                self.assertEqual(image.size, (300, 300))
                image.verify()
            self.assertEqual(list(Path(tmp).iterdir()), [target])


class BookOutputTests(unittest.TestCase):
    def setUp(self):
        self.font = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
        self.spec = {'platform': 'kdp', 'interior_type': 'text_no_bleed', 'page_count': 1,
                     'trim_inches': [2, 2], 'margins_inches': dict(inside=.25, outside=.25, top=.25, bottom=.25),
                     'font_sha256': common.digest(self.font), 'font_size_pt': 10, 'leading_pt': 12}
        self.pages = [{'lines': ['Fixture text']}]

    def render(self, target):
        return render_book(self.spec, self.pages, self.font, target)

    def test_collision_after_initial_check_preserves_concurrent_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp)/'interior.pdf'
            target.write_bytes(b'concurrent-original')
            with patch.object(Path, 'exists', return_value=False):
                with self.assertRaisesRegex(ValueError, '^OUTPUT_EXISTS$'):
                    self.render(target)
            self.assertEqual(target.read_bytes(), b'concurrent-original')
            self.assertEqual(list(Path(tmp).iterdir()), [target])

    def test_dangling_symlink_never_creates_its_destination(self):
        with tempfile.TemporaryDirectory() as tmp:
            target, destination = Path(tmp)/'interior.pdf', Path(tmp)/'other.pdf'
            target.symlink_to(destination)
            with self.assertRaises((ValueError, OSError)):
                self.render(target)
            self.assertTrue(target.is_symlink())
            self.assertFalse(destination.exists())
            self.assertEqual(list(Path(tmp).iterdir()), [target])

    def test_success_is_private_deterministic_verified_and_hash_bound(self):
        import fitz
        with tempfile.TemporaryDirectory() as tmp:
            targets = [Path(tmp)/name for name in ('one.pdf', 'two.pdf')]
            receipts = [self.render(target) for target in targets]
            self.assertEqual(receipts[0], receipts[1])
            for target, receipt in zip(targets, receipts):
                self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o600)
                self.assertEqual(receipt['interior_sha256'], common.digest(target))
                self.assertTrue(receipt['technical_checks_passed'])
                self.assertFalse(receipt['production_ready'])
                self.assertFalse(receipt['publication_enabled'])
                self.assertEqual(receipt['editorial_review'], 'UNASSESSED')
                with fitz.open(target) as book:
                    self.assertEqual(book[0].get_text().splitlines(), self.pages[0]['lines'])
            self.assertEqual(set(Path(tmp).iterdir()), set(targets))

    def test_failed_encoder_cleans_partial_output(self):
        def fail(pdf):
            stream = pdf._filename
            if hasattr(stream, 'write'):
                stream.write(b'partial-fixture')
            else:
                Path(stream).write_bytes(b'partial-fixture')
            raise OSError('encoder fixture')
        with tempfile.TemporaryDirectory() as tmp:
            with patch('pod_book_interior.canvas.Canvas.save', autospec=True, side_effect=fail):
                with self.assertRaisesRegex(OSError, '^encoder fixture$'):
                    self.render(Path(tmp)/'interior.pdf')
            self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_failed_pdf_inspection_cleans_encoded_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch('fitz.open', side_effect=ValueError('inspection fixture')):
                with self.assertRaisesRegex(ValueError, '^inspection fixture$'):
                    self.render(Path(tmp)/'interior.pdf')
            self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_failed_file_sync_does_not_expose_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch('os.fsync', side_effect=OSError('sync fixture')):
                with self.assertRaisesRegex(OSError, '^sync fixture$'):
                    self.render(Path(tmp)/'interior.pdf')
            self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_oversized_pdf_fails_before_inspection_or_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch('pod_book_interior.MAX_DIGEST_BYTES', 8), \
                 patch('fitz.open', side_effect=AssertionError('inspection reached')):
                with self.assertRaisesRegex(ValueError, '^DIGEST_TOO_LARGE$'):
                    self.render(Path(tmp)/'interior.pdf')
            self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_failed_directory_sync_retains_complete_output_without_receipt(self):
        import fitz
        real_sync = os.fsync
        def sync(fd):
            if stat.S_ISDIR(os.fstat(fd).st_mode):
                raise OSError('directory fixture')
            real_sync(fd)
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp)/'interior.pdf'
            with patch('os.fsync', side_effect=sync):
                with self.assertRaisesRegex(OSError, '^directory fixture$'):
                    self.render(target)
            with fitz.open(target) as book:
                self.assertEqual(book[0].get_text().splitlines(), self.pages[0]['lines'])
            self.assertEqual(list(Path(tmp).iterdir()), [target])


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

