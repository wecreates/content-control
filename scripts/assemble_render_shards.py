#!/usr/bin/env python3
"""Assemble only the complete, ordered render plan using local FFmpeg."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import tempfile
from fractions import Fraction
try:
    from scripts.v2_audio_assemble import read_audio
except ModuleNotFoundError:
    from v2_audio_assemble import read_audio

FPS = 24


def shard_plan(manifest):
    if not isinstance(manifest, dict):
        raise ValueError('Shard plan object required')
    if manifest.get('publication_enabled') is not False:
        raise ValueError('Publication must remain disabled')
    rows = manifest.get('shards')
    if not isinstance(rows, list) or not 1 <= len(rows) <= 1024:
        raise ValueError('A nonempty bounded shard plan is required')
    result, ids, previous_end, previous_frame = [], set(), 0, 0
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError('Invalid shard entry')
        name = row.get('id')
        if not isinstance(name, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}', name) or name in ids:
            raise ValueError('Shard IDs must be unique safe names')
        start, end = row.get('start'), row.get('end')
        if any(isinstance(t, bool) or not isinstance(t, (int, float)) or not 0 <= t <= 3600 for t in (start, end)) or not 0 <= start < end <= 3600:
            raise ValueError('Invalid shard timing')
        first, stop = math.ceil(start * FPS), math.ceil(end * FPS)
        if abs(start - previous_end) > 1e-6 or first != previous_frame or stop <= first:
            raise ValueError('Shards must cover a contiguous, nonempty frame timeline from zero')
        result.append({'id': name, 'start': start, 'end': end,
                       'first_frame': first, 'last_frame': stop - 1,
                       'frame_count': stop - first})
        ids.add(name)
        previous_end, previous_frame = end, stop
    return result


def concat_line(path):
    # FFmpeg concat uses its own single-quote grammar, not a shell. Newlines
    # would create directives, so reject them instead of attempting escaping.
    text = str(Path(path).resolve())
    if any(c in text for c in ('\n', '\r', '\x00')):
        raise ValueError('Unsupported control character in shard path')
    return "file '" + text.replace("'", "'\\''") + "'\n"


def run(command):
    result = subprocess.run(command, capture_output=True, text=True, timeout=120)
    if result.returncode:
        raise ValueError('Media tool failed: ' + result.stderr[-1500:])
    return result.stdout


def video_info(path):
    keys = 'codec_type,codec_name,width,height,pix_fmt,r_frame_rate,time_base,sample_rate,channels,channel_layout'
    info = json.loads(run(['ffprobe', '-v', 'error', '-count_frames',
                          '-show_entries', 'stream=' + keys + ',nb_read_frames,duration',
                          '-of', 'json', str(path)]))
    streams = info.get('streams', [])
    video = [stream for stream in streams if stream.get('codec_type') == 'video']
    if len(video) != 1 or len(streams) > 2 or any(stream.get('codec_type') not in ('audio', 'video') for stream in streams):
        raise ValueError('One video and at most one audio stream required')
    try:
        frames = int(video[0]['nb_read_frames'])
        duration = float(video[0]['duration'])
        fps = Fraction(video[0]['r_frame_rate'])
    except (KeyError, TypeError, ValueError, ZeroDivisionError) as exc:
        raise ValueError('Decoded video timing unavailable') from exc
    if fps != FPS or not math.isfinite(duration) or abs(duration - frames / FPS) > 1 / FPS:
        raise ValueError('Shard video does not match the 24 fps timeline')
    signature = [{key: stream.get(key) for key in keys.split(',')} for stream in streams]
    return frames, signature


def assemble(manifest, shard_dir, output):
    plan = shard_plan(manifest)
    root, output = Path(shard_dir).resolve(), Path(output)
    expected = {row['id'] + '.mp4' for row in plan}
    actual = {path.name for path in root.glob('*.mp4')}
    if expected != actual:
        raise ValueError('Missing or unexpected shards: ' + json.dumps({'missing': sorted(expected - actual), 'unexpected': sorted(actual - expected)}))
    paths, signature = [], None
    for row in plan:
        source = root / (row['id'] + '.mp4')
        if source.is_symlink() or not source.is_file() or source.stat().st_size <= 0:
            raise ValueError('Shard must be a nonempty regular file')
        if output.resolve() == source or (output.exists() and output.samefile(source)):
            raise ValueError('Output would overwrite a source shard')
        concat_line(source)
        frames, stream_signature = video_info(source)
        if signature is not None and stream_signature != signature:
            raise ValueError('Shard stream formats differ; copy mux would be unsafe')
        signature = stream_signature
        if frames != row['frame_count']:
            raise ValueError('Shard decoded frame count differs from plan: ' + row['id'])
        paths.append(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.render-assemble-', dir=output.parent) as temporary:
        directory = Path(temporary)
        concat = directory / 'concat.txt'
        concat.write_text(''.join(concat_line(path) for path in paths), encoding='utf-8')
        staged = directory / 'assembled.mp4'
        run(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
             '-f', 'concat', '-safe', '0', '-i', str(concat), '-c', 'copy',
             '-movflags', '+faststart', str(staged)])
        frames, assembled_signature = video_info(staged)
        if assembled_signature != signature:
            raise ValueError('Assembled stream format differs from shards')
        if frames != sum(row['frame_count'] for row in plan):
            raise ValueError('Assembled decoded frame count differs from plan')
        digest = hashlib.sha256(staged.read_bytes()).hexdigest()
        os.replace(staged, output)
    return {'schema_version': 1, 'status': 'PASS', 'candidate_sha256': digest,
            'shard_count': len(plan), 'frame_count': frames, 'fps': FPS,
            'shard_ids': [row['id'] for row in plan], 'publication_enabled': False}


def same_file(left, right):
    left, right = Path(left), Path(right)
    return left.resolve() == right.resolve() or (left.exists() and right.exists() and left.samefile(right))


def check_destinations(manifest, shard_dir, output, receipt):
    root = Path(shard_dir).resolve()
    targets = [Path(output), Path(receipt)]
    sources = [Path(manifest), *root.glob('*.mp4')]
    if (same_file(output, receipt) or any(target.resolve().is_relative_to(root) for target in targets)
            or any(same_file(target, source) for target in targets for source in sources)):
        raise ValueError('Output or receipt would overwrite an input or each other')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--shard-dir', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--receipt', required=True)
    args = parser.parse_args()
    # An unsafe receipt cannot be used even to report the failure.
    try:
        check_destinations(args.manifest, args.shard_dir, args.out, args.receipt)
    except (ValueError, OSError) as exc:
        print(json.dumps({'status': 'BLOCKED', 'publication_enabled': False, 'reason': str(exc)}))
        return 2
    try:
        report = assemble(json.loads(read_audio(args.manifest, 2 * 1024 * 1024)), args.shard_dir, args.out)
    except (ValueError, OSError, KeyError, TypeError, RecursionError, subprocess.TimeoutExpired) as exc:
        report = {'status': 'BLOCKED', 'publication_enabled': False, 'reason': str(exc)}
    receipt = Path(args.receipt)
    receipt.parent.mkdir(parents=True, exist_ok=True)
    receipt.write_text(json.dumps(report, indent=2, sort_keys=True) + '\n')
    print(json.dumps(report))
    return 0 if report['status'] == 'PASS' else 2


if __name__ == '__main__':
    raise SystemExit(main())
