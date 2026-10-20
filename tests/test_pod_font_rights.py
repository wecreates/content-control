import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from pod_common import digest, sign
from pod_font_rights import inspect_font_rights


class FontRightsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.license = self.root / 'license.txt'
        self.license.write_bytes(b'retained synthetic license evidence')
        self.font_sha = 'a' * 64
        self.env = patch.dict(os.environ, {'POD_RIGHTS_KEY': 'r' * 48})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def envelope(self, **patches):
        import time
        now = int(time.time() * 1000)
        return sign({'schema_version': 1, 'audience': 'pod:font-rights',
                     'issued_at_ms': now - 1, 'expires_at_ms': now + 60000,
                     'status': 'PASS', 'font_sha256': self.font_sha,
                     'license_sha256': digest(self.license), 'country': 'US',
                     'product': 'fixture-book', 'commercial_use': True,
                     'print_on_demand': True, 'font_embedding': True,
                     'revoked': False, 'license_id': 'fixture-license',
                     'licensor': 'fixture-authority', **patches}, 'POD_RIGHTS_KEY')

    def test_valid_current_grant_is_bound_to_retained_bytes(self):
        rights = inspect_font_rights(self.envelope(), self.license,
                                     self.font_sha, 'US', 'fixture-book')
        self.assertEqual(rights['license_sha256'], digest(self.license))

    def test_missing_inputs_fail_closed(self):
        with self.assertRaisesRegex(ValueError, '^FONT_RIGHTS_REQUIRED$'):
            inspect_font_rights(None, self.license, self.font_sha, 'US', 'fixture-book')
        with self.assertRaisesRegex(ValueError, '^FONT_LICENSE_EVIDENCE_REQUIRED$'):
            inspect_font_rights(self.envelope(), None, self.font_sha, 'US', 'fixture-book')

    def test_changed_or_empty_license_evidence_fails_closed(self):
        envelope = self.envelope()
        self.license.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, '^FONT_RIGHTS_INVALID$'):
            inspect_font_rights(envelope, self.license, self.font_sha, 'US', 'fixture-book')
        self.license.write_bytes(b'')
        with self.assertRaisesRegex(ValueError, '^FONT_LICENSE_EVIDENCE_INVALID$'):
            inspect_font_rights(envelope, self.license, self.font_sha, 'US', 'fixture-book')

    def test_nonregular_and_oversized_evidence_fail_before_acceptance(self):
        envelope = self.envelope()
        link = self.root / 'link'; link.symlink_to(self.license)
        pipe = self.root / 'pipe'; os.mkfifo(pipe)
        for path in (link, pipe):
            with self.assertRaisesRegex(ValueError, '^FONT_LICENSE_EVIDENCE_INVALID$'):
                inspect_font_rights(envelope, path, self.font_sha, 'US', 'fixture-book')
        with patch('pod_font_rights.MAX_LICENSE_BYTES', self.license.stat().st_size - 1):
            with self.assertRaisesRegex(ValueError, '^FONT_LICENSE_EVIDENCE_INVALID$'):
                inspect_font_rights(envelope, self.license, self.font_sha, 'US', 'fixture-book')

    def test_bad_signature_expiry_audience_and_scope_are_rejected(self):
        import time
        now = int(time.time() * 1000)
        bad = self.envelope(); bad['signature'] = '0' * 64
        cases = [bad, self.envelope(expires_at_ms=now - 1),
                 self.envelope(audience='pod:package-rights'), self.envelope(country='CA'),
                 self.envelope(product='other'), self.envelope(font_sha256='b' * 64),
                 self.envelope(revoked=True), self.envelope(commercial_use=False),
                 self.envelope(print_on_demand=False), self.envelope(font_embedding=False)]
        for envelope in cases:
            with self.subTest(envelope=envelope):
                with self.assertRaisesRegex(ValueError, '^FONT_RIGHTS_INVALID$'):
                    inspect_font_rights(envelope, self.license, self.font_sha, 'US', 'fixture-book')


if __name__ == '__main__':
    unittest.main()
