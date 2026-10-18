"""Short-lived evidence policy parity, using only synthetic signing keys."""
import os
import hashlib
import io
import json
import tempfile
import subprocess
import stat
from types import SimpleNamespace
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from pod_common import sign, verified, read_json
import pod_qa_snapshot as snapshots


class QASnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'package'
        self.root.mkdir()
        self.source = self.root / 'print.png'
        self.source.write_bytes(b'original')
        self.reference = Path(self.temp.name) / 'reference.png'
        self.reference.write_bytes(b'reference')
        self.files = {'print.png': hashlib.sha256(b'original').hexdigest()}

    def capture(self, files=None):
        return snapshots.capture_qa_inputs(self.root, self.reference, self.files if files is None else files)

    def test_copies_and_hashes_one_version_and_removes_workspace(self):
        with self.capture() as (root, reference):
            self.source.write_bytes(b'replaced')
            self.reference.unlink()
            self.assertEqual((root / 'print.png').read_bytes(), b'original')
            self.assertEqual(reference.read_bytes(), b'reference')
            self.assertEqual(hashlib.sha256((root / 'print.png').read_bytes()).hexdigest(), self.files['print.png'])
        self.assertFalse(root.parent.exists())

    def test_rejects_wrong_hash_before_inspection(self):
        self.source.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, '^FILE_HASH_MISMATCH$'):
            with self.capture():
                self.fail('inspection reached')

    def test_validates_all_names_and_hash_types_before_reads(self):
        for files in ({'../print.png': 'a' * 64}, {'/print.png': 'a' * 64},
                      {'nested/print.png': 'a' * 64}, {'print.png': ['a' * 64]}):
            with self.subTest(files=files), patch.object(snapshots, 'bounded_bytes', side_effect=AssertionError('read reached')):
                with self.assertRaises(ValueError):
                    with self.capture(files):
                        self.fail('inspection reached')

    def test_empty_or_excessive_file_lists_are_rejected(self):
        for files in ({}, [], {str(i): 'a' * 64 for i in range(33)}):
            with self.assertRaisesRegex(ValueError, '^ARTIFACT_BATCH_INVALID$'):
                with self.capture(files):
                    self.fail('inspection reached')

    def test_object_and_package_limits_and_exact_ceilings(self):
        with patch.object(snapshots, 'MAX_OBJECT_BYTES', 9), patch.object(snapshots, 'MAX_PACKAGE_BYTES', 8):
            with self.capture():
                pass
        for name, limit in (('MAX_OBJECT_BYTES', 7), ('MAX_PACKAGE_BYTES', 7)):
            with patch.object(snapshots, name, limit), self.assertRaises(ValueError):
                with self.capture():
                    self.fail('inspection reached')
        self.reference.write_bytes(b'0123456789')
        with patch.object(snapshots, 'MAX_OBJECT_BYTES', 9), self.assertRaisesRegex(ValueError, '^ARTIFACT_INVALID$'):
            with self.capture():
                self.fail('inspection reached')

    def test_growth_after_stat_remains_bounded(self):
        self.source.write_bytes(b'x' * 100)
        mode = self.source.stat().st_mode
        with patch.object(snapshots.os, 'fstat', return_value=SimpleNamespace(st_mode=mode, st_size=1)):
            with self.assertRaisesRegex(ValueError, '^ARTIFACT_INVALID$'):
                snapshots.bounded_bytes(self.source, 8)

    def test_escaped_symlink_is_rejected(self):
        self.source.unlink()
        self.source.symlink_to(self.reference)
        with self.assertRaisesRegex(ValueError, '^ARTIFACT_PATH_INVALID$'):
            with self.capture():
                self.fail('inspection reached')

    def test_snapshot_removed_after_inspection_failure(self):
        with self.assertRaisesRegex(RuntimeError, '^fixture$'):
            with self.capture() as (root, reference):
                raise RuntimeError('fixture')
        self.assertFalse(root.parent.exists())


class BoundedEvidenceReadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'evidence.json'

    def test_growth_after_size_observation_does_not_bypass_limit(self):
        self.path.write_bytes(b'{}' + b' ' * (4 * 1024 * 1024 - 1))
        with patch.object(Path, 'stat', return_value=SimpleNamespace(st_size=2)):
            with self.assertRaisesRegex(ValueError, '^JSON_TOO_LARGE$'):
                read_json(self.path)

    def test_reads_at_most_limit_plus_one_and_closes_on_rejection(self):
        class BoundedStream(io.BytesIO):
            def fileno(self):
                return 123
            def read(self, size=-1):
                if size != 4 * 1024 * 1024 + 1:
                    raise AssertionError('unbounded or unexpected read size')
                return super().read(size)
        stream = BoundedStream(b' ' * (4 * 1024 * 1024 + 2))
        with patch.object(Path, 'stat', return_value=SimpleNamespace(st_size=0)), \
             patch('pod_common.os.open', return_value=123), \
             patch('pod_common.os.fdopen', return_value=stream), \
             patch('pod_common.os.fstat', return_value=SimpleNamespace(st_mode=stat.S_IFREG)):
            with self.assertRaisesRegex(ValueError, '^JSON_TOO_LARGE$'):
                read_json(self.path)
        self.assertTrue(stream.closed)

    def test_exact_byte_ceiling_is_accepted(self):
        self.path.write_bytes(b'{}' + b' ' * (4 * 1024 * 1024 - 2))
        self.assertEqual(read_json(self.path), {})

    def test_utf8_roundtrip_and_invalid_encoding(self):
        expected = {'text': 'Étoile 日本語'}
        self.path.write_bytes(json.dumps(expected, ensure_ascii=False).encode('utf-8'))
        self.assertEqual(read_json(self.path), expected)
        self.path.write_bytes(b'{"text":"\xff"}')
        with self.assertRaises(UnicodeDecodeError):
            read_json(self.path)

    def test_multibyte_input_is_limited_by_bytes_not_characters(self):
        body = ('"' + 'é' * (2 * 1024 * 1024) + '"').encode('utf-8')
        self.path.write_bytes(body)
        with self.assertRaisesRegex(ValueError, '^JSON_TOO_LARGE$'):
            read_json(self.path)

    def test_invalid_json_still_fails_and_closes_stream(self):
        class Stream(io.BytesIO):
            def fileno(self):
                return 123
        stream = Stream(b'{broken')
        with patch.object(Path, 'stat', return_value=SimpleNamespace(st_size=7)), \
             patch('pod_common.os.open', return_value=123), \
             patch('pod_common.os.fdopen', return_value=stream), \
             patch('pod_common.os.fstat', return_value=SimpleNamespace(st_mode=stat.S_IFREG)):
            with self.assertRaises(json.JSONDecodeError):
                read_json(self.path)
        self.assertTrue(stream.closed)

    def test_fifo_without_writer_is_rejected_without_waiting(self):
        os.mkfifo(self.path)
        script = ("from pod_common import read_json\n"
                  "try: read_json(__import__('sys').argv[1])\n"
                  "except ValueError as e:\n"
                  " assert str(e) == 'JSON_FILE_INVALID'\n"
                  "else: raise AssertionError('FIFO accepted')\n")
        result = subprocess.run([sys.executable, '-c', script, str(self.path)],
            env={**os.environ, 'PYTHONPATH': str(Path(__file__).resolve().parents[1] / 'scripts')},
            capture_output=True, text=True, timeout=2)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_final_symlink_is_rejected_before_reading_target(self):
        target = self.path.with_name('target.json')
        target.write_text('{"fixture":true}')
        self.path.symlink_to(target)
        with self.assertRaises(OSError):
            read_json(self.path)
        self.assertEqual(target.read_text(), '{"fixture":true}')

    def test_device_is_rejected_before_read(self):
        with self.assertRaisesRegex(ValueError, '^JSON_FILE_INVALID$'):
            read_json('/dev/null')

    def test_descriptor_closes_when_file_type_check_fails(self):
        fd = os.open('/dev/null', os.O_RDONLY)
        with patch('pod_common.os.open', return_value=fd):
            with self.assertRaisesRegex(ValueError, '^JSON_FILE_INVALID$'):
                read_json(self.path)
        with self.assertRaises(OSError):
            os.fstat(fd)

    def test_directory_descriptor_is_rejected_and_closed(self):
        fd = os.open(self.path.parent, os.O_RDONLY)
        with patch('pod_common.os.open', return_value=fd):
            with self.assertRaisesRegex(ValueError, '^JSON_FILE_INVALID$'):
                read_json(self.path)
        with self.assertRaises(OSError):
            os.fstat(fd)

    def test_descriptor_closes_when_stream_wrapper_fails(self):
        self.path.write_text('{}')
        fd = os.open(self.path, os.O_RDONLY)
        with patch('pod_common.os.open', return_value=fd), \
             patch('pod_common.os.fdopen', side_effect=OSError('fixture')):
            with self.assertRaisesRegex(OSError, '^fixture$'):
                read_json(self.path)
        with self.assertRaises(OSError):
            os.fstat(fd)


class EvidenceLifetimeTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'POD_TEST_EVIDENCE_KEY': 't' * 48})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.clock = patch('pod_common.time.time', return_value=2000)
        self.clock.start()
        self.addCleanup(self.clock.stop)
        self.payload = {'schema_version': 1, 'audience': 'pod:test',
                        'issued_at_ms': 2000000, 'expires_at_ms': 2900000}

    def verify(self, **overrides):
        return verified(sign({**self.payload, **overrides}, 'POD_TEST_EVIDENCE_KEY'),
                        'POD_TEST_EVIDENCE_KEY', 'pod:test')

    def test_exact_fifteen_minute_lifetime_is_valid(self):
        self.assertEqual(self.verify(), self.payload)

    def test_long_lived_signed_evidence_is_rejected(self):
        for issued, expires in ((1999999, 2900000), (0, 9999999999999)):
            with self.subTest(issued=issued, expires=expires):
                with self.assertRaisesRegex(ValueError, 'EVIDENCE_TIME_INVALID'):
                    self.verify(issued_at_ms=issued, expires_at_ms=expires)

    def test_boolean_time_is_not_an_integer_timestamp(self):
        with self.assertRaisesRegex(ValueError, 'EVIDENCE_TIME_INVALID'):
            self.verify(issued_at_ms=True)

    def test_boolean_schema_version_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'EVIDENCE_SCOPE_INVALID'):
            self.verify(schema_version=True)

    def test_expired_and_future_evidence_is_rejected(self):
        for issued, expires in ((1999999, 2000000), (2000001, 2000010)):
            with self.subTest(issued=issued, expires=expires):
                with self.assertRaisesRegex(ValueError, 'EVIDENCE_EXPIRED'):
                    self.verify(issued_at_ms=issued, expires_at_ms=expires)

    def test_wrong_audience_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'EVIDENCE_SCOPE_INVALID'):
            self.verify(audience='pod:other')


if __name__ == '__main__':
    unittest.main()
