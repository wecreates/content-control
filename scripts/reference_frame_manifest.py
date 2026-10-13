#!/usr/bin/env python3
"""Extract reproducible reference samples without inventing source attribution."""
import argparse
import hashlib
import json
import math
import os
import shutil
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit
import re

import cv2


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def canonical_source_url(value):
    """Retain source locator, never credentials, query tokens or fragments."""
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('source URL must be HTTPS without embedded credentials')
    if parsed.port not in (None, 443):
        raise ValueError('source URL uses unsupported port')
    query = ''
    if parsed.hostname.lower() in ('youtube.com', 'www.youtube.com', 'm.youtube.com') and parsed.path == '/watch':
        video_id = parse_qs(parsed.query).get('v', [])
        if len(video_id) != 1 or not re.fullmatch(r'[A-Za-z0-9_-]{11}', video_id[0]):
            raise ValueError('YouTube watch URL requires a valid video identifier')
        query = urlencode({'v': video_id[0]})
    return urlunsplit(('https', parsed.netloc, parsed.path or '/', query, ''))


def build_manifest(video, source_url, output_dir, count=10):
    if type(count) is not int or not 4 <= count <= 100:
        raise ValueError('sample count must be an integer from 4 to 100')
    url = canonical_source_url(source_url)
    video, target = Path(video).resolve(), Path(output_dir)
    if not video.is_file():
        raise ValueError('source video is unavailable')
    if target.exists():
        raise ValueError('output directory already exists; choose a fresh reference package')
    initial_hash = sha256(video)
    cap = cv2.VideoCapture(str(video))
    temporary = None
    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS))
        total = float(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if not math.isfinite(fps) or fps <= 0 or not math.isfinite(total) or not total.is_integer() or total < count:
            raise ValueError('source video metadata or distinct frame count is invalid')
        total = int(total)
        indices = [round((total - 1) * i / (count - 1)) for i in range(count)]
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = Path(tempfile.mkdtemp(prefix='.reference-intake-', dir=target.parent))
        frames, next_sample, decoded = [], 0, 0
        # Sequential decoding proves ordinal positions without trusting seek success.
        while True:
            ok, image = cap.read()
            if not ok:
                break
            if next_sample < count and decoded == indices[next_sample]:
                name = f'ref-{next_sample + 1:02d}.jpg'
                path = temporary / name
                if not cv2.imwrite(str(path), image, [cv2.IMWRITE_JPEG_QUALITY, 95]):
                    raise RuntimeError('reference image encoding failed')
                frames.append({'file': name, 'sha256': sha256(path), 'source_frame': decoded,
                               'source_seconds': decoded / fps, 'width': int(image.shape[1]),
                               'height': int(image.shape[0])})
                next_sample += 1
            decoded += 1
        if decoded != total or next_sample != count:
            raise ValueError('source does not decode completely or metadata frame count differs')
        if sha256(video) != initial_hash:
            raise ValueError('source video changed during extraction')
        report = {'schema_version': 1, 'status': 'EXTRACTED',
                  'source_url': url, 'source_url_attribution_verified': False,
                  'source_attribution_note': 'URL supplied by caller; local bytes and extraction verified, remote URL identity not independently verified.',
                  'source_video_sha256': initial_hash, 'source_frame_count': total,
                  'source_fps': fps, 'source_duration_seconds': total / fps,
                  'sampling_method': 'sequential_decode_uniform_frame_indices',
                  'decoded_frame_count': decoded, 'frames': frames,
                  'timestamps_scope': 'nominal frame index / FPS; not verified variable-frame-rate presentation timestamps',
                  'publication_enabled': False, 'production_approved': False}
        (temporary / 'reference-manifest.json').write_text(json.dumps(report, indent=2, sort_keys=True) + '\n')
        # Same-filesystem rename exposes only a complete image+manifest package.
        os.rename(temporary, target)
        temporary = None
        return report
    finally:
        cap.release()
        if temporary is not None:
            shutil.rmtree(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', required=True)
    parser.add_argument('--source-url', required=True)
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--count', type=int, default=10)
    args = parser.parse_args()
    result = build_manifest(args.video, args.source_url, args.output_dir, args.count)
    print(json.dumps({'status': result['status'], 'frames': len(result['frames']),
                      'source_video_sha256': result['source_video_sha256'],
                      'source_url_attribution_verified': False}, sort_keys=True))


if __name__ == '__main__':
    main()
