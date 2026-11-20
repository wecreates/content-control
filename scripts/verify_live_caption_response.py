"""Verify decoded caption bytes and their strong or weak HTTP entity tag."""
import hashlib
from pathlib import Path
import re
import sys


def verify(headers: str, body: bytes, expected_sha256: str) -> None:
    if not re.fullmatch(r'[0-9a-f]{64}', expected_sha256):
        raise ValueError('invalid expected caption hash')
    # curl -L can retain redirect headers. Only the final response is authoritative.
    blocks = re.split(r'\r?\n\r?\n', headers.strip())
    final = blocks[-1]
    tags = re.findall(r'^etag:\s*(.*?)\s*$', final, re.I | re.M)
    if len(tags) != 1 or tags[0] not in (f'"{expected_sha256}"', f'W/"{expected_sha256}"'):
        raise ValueError('caption ETag does not match expected hash')
    # Edge compression may weaken ETags. It never substitutes for checking bytes.
    if hashlib.sha256(body).hexdigest() != expected_sha256:
        raise ValueError('caption bytes do not match expected hash')
    if not body.startswith(b'WEBVTT'):
        raise ValueError('caption response is not WebVTT')


if __name__ == '__main__':
    verify(Path(sys.argv[1]).read_text(), Path(sys.argv[2]).read_bytes(), sys.argv[3])
