"""Short-lived evidence policy parity, using only synthetic signing keys."""
import os
import io
import json
import tempfile
from types import SimpleNamespace
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from pod_common import sign, verified, read_json


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
            def read(self, size=-1):
                if size != 4 * 1024 * 1024 + 1:
                    raise AssertionError('unbounded or unexpected read size')
                return super().read(size)
        stream = BoundedStream(b' ' * (4 * 1024 * 1024 + 2))
        with patch.object(Path, 'stat', return_value=SimpleNamespace(st_size=0)), \
             patch.object(Path, 'open', return_value=stream):
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
        stream = io.BytesIO(b'{broken')
        with patch.object(Path, 'stat', return_value=SimpleNamespace(st_size=7)), \
             patch.object(Path, 'open', return_value=stream):
            with self.assertRaises(json.JSONDecodeError):
                read_json(self.path)
        self.assertTrue(stream.closed)


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
