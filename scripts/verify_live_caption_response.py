"""Verify a live media ETag or verify both the ETag and decoded caption bytes."""
import argparse
import hashlib
from pathlib import Path
import re


def verify_etag(headers: str, expected_sha256: str) -> None:
    if not re.fullmatch(r'[0-9a-f]{64}', expected_sha256):
        raise ValueError('invalid expected response hash')
    # curl -L can retain redirect headers. Only the final response is authoritative.
    blocks = re.split(r'\r?\n\r?\n', headers.strip())
    final = blocks[-1]
    tags = re.findall(r'^etag:\s*(.*?)\s*$', final, re.I | re.M)
    if len(tags) != 1 or tags[0] not in (f'"{expected_sha256}"', f'W/"{expected_sha256}"'):
        raise ValueError('ETag does not match expected hash')


def verify(headers: str, body: bytes, expected_sha256: str) -> None:
    verify_etag(headers, expected_sha256)
    # Edge compression may weaken ETags. It never substitutes for checking bytes.
    if hashlib.sha256(body).hexdigest() != expected_sha256:
        raise ValueError('caption bytes do not match expected hash')
    if not body.startswith(b'WEBVTT'):
        raise ValueError('caption response is not WebVTT')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('headers', type=Path)
    parser.add_argument('caption', type=Path, nargs='?')
    parser.add_argument('expected_sha256')
    args = parser.parse_args()
    headers = args.headers.read_text()
    if args.caption is None:
        verify_etag(headers, args.expected_sha256)
    else:
        verify(headers, args.caption.read_bytes(), args.expected_sha256)
