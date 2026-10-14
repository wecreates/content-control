"""Short-lived evidence policy parity, using only synthetic signing keys."""
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from pod_common import sign, verified


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
