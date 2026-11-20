import hashlib
import unittest

from scripts.verify_live_caption_response import verify


class LiveCaptionResponseTests(unittest.TestCase):
    body = b'WEBVTT\n\n00:00.000 --> 00:01.000\nHello\n'
    digest = hashlib.sha256(body).hexdigest()

    def headers(self, weak=False):
        return 'HTTP/2 200\r\nETag: ' + ('W/' if weak else '') + f'"{self.digest}"\r\n\r\n'

    def test_strong_and_edge_weakened_etags_require_matching_bytes(self):
        for weak in (False, True):
            with self.subTest(weak=weak):
                verify(self.headers(weak), self.body, self.digest)
                with self.assertRaisesRegex(ValueError, 'bytes'):
                    verify(self.headers(weak), self.body + b'changed', self.digest)

    def test_stale_tag_rejected_even_with_correct_bytes(self):
        with self.assertRaisesRegex(ValueError, 'ETag'):
            verify(self.headers().replace(self.digest, '0' * 64), self.body, self.digest)

    def test_final_response_tag_is_authoritative(self):
        verify('HTTP/1.1 302\r\nETag: "stale"\r\n\r\n' + self.headers(True), self.body, self.digest)
        with self.assertRaisesRegex(ValueError, 'ETag'):
            verify(self.headers() + 'HTTP/2 200\r\nETag: "stale"\r\n\r\n', self.body, self.digest)

    def test_missing_duplicate_or_malformed_tag_rejected(self):
        for headers in ('HTTP/2 200\r\n', self.headers().rstrip() + f'\r\nETag: "{self.digest}"', f'ETag: {self.digest}'):
            with self.subTest(headers=headers), self.assertRaisesRegex(ValueError, 'ETag'):
                verify(headers, self.body, self.digest)

    def test_hash_matching_non_vtt_rejected(self):
        body = b'error page'
        digest = hashlib.sha256(body).hexdigest()
        with self.assertRaisesRegex(ValueError, 'WebVTT'):
            verify(f'ETag: "{digest}"', body, digest)
