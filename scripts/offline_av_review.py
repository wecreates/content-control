#!/usr/bin/env python3
"""Offline exact-media inspection pack. Preparation/metrics NEVER grant approval.

Uses only Python stdlib plus ffmpeg/ffprobe. No uploads, credentials or inference.
"""
import argparse
import hashlib
import html
import json
import math
from pathlib import Path
import shutil
import subprocess


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=900)


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def prepare(source, destination, expected_hash, every=1.0):
    source = Path(source).resolve(strict=True)
    destination = Path(destination).resolve()
    if not math.isfinite(every) or every <= 0:
        raise ValueError('Positive finite sampling interval required')
    digest = sha(source)
    if digest != expected_hash:
        raise ValueError('Candidate hash mismatch')
    # Exclusive output avoids overwriting media, previous evidence or symlink targets.
    destination.mkdir(parents=True, exist_ok=False)
    candidate = destination / 'candidate.mp4'
    shutil.copyfile(source, candidate)
    if sha(candidate) != digest:
        raise ValueError('Copied candidate hash mismatch')
    probe = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(candidate)]).stdout)
    duration = float(probe['format']['duration'])
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError('Invalid duration')
    run(['ffmpeg', '-nostdin', '-v', 'error', '-xerror', '-err_detect', 'explode', '-i', str(candidate), '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'])
    # Decode timestamps rather than assuming constant frame rate or fps filter offsets.
    frames = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'json', str(candidate)]).stdout)['frames']
    selected, next_time = [], 0.0
    for n, frame in enumerate(frames):
        t = float(frame['best_effort_timestamp_time'])
        if t >= next_time:
            selected.append((n, t))
            next_time = t + every
    if not selected:
        raise ValueError('No decoded frame timestamps')
    (destination / 'frames').mkdir()
    expression = '+'.join(f'eq(n\\,{n})' for n, _ in selected)
    run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(candidate), '-vf', f'select={expression},scale=640:-2', '-fps_mode', 'vfr', str(destination / 'frames/%05d.jpg')])
    if len(list((destination / 'frames').glob('*.jpg'))) != len(selected):
        raise ValueError('Extracted frame count mismatch')
    audio = run(['ffmpeg', '-nostdin', '-hide_banner', '-i', str(candidate), '-map', '0:a:0', '-af', 'ebur128=peak=true,silencedetect=noise=-45dB:d=0.5', '-f', 'null', '-'])
    (destination / 'audio-diagnostics.txt').write_text(audio.stderr)
    run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(candidate), '-map', '0:a:0', '-c:a', 'pcm_s16le', str(destination / 'audio.wav')])
    if sha(source) != digest or sha(candidate) != digest:
        raise ValueError('Media changed during inspection')
    samples = [{'frame_index': n, 'time_seconds': t, 'file': f'frames/{i:05d}.jpg'} for i, (n, t) in enumerate(selected, 1)]
    receipt = {'schema_version': 1, 'candidate_sha256': digest, 'duration_seconds': duration,
               'technical_decode': 'PASS', 'status': 'REVIEW_REQUIRED', 'full_video_review': False,
               'full_audio_review': False, 'publication_enabled': False, 'production_approved': False,
               'scope': 'Decoded original plus timestamped samples and audio diagnostics. No creative or listening certification.',
               'samples': samples, 'comparisons': [], 'reviewed_intervals': []}
    (destination / 'manifest.json').write_text(json.dumps(receipt, indent=2) + '\n')
    (destination / 'probe.json').write_text(json.dumps(probe, indent=2) + '\n')
    cards = ''.join(f'<button data-time="{s["time_seconds"]}"><img loading="lazy" src="{s["file"]}"><span>{s["time_seconds"]:.3f}s · frame {s["frame_index"]}</span></button>' for s in samples)
    page = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unapproved exact-media review</title>'
    page += '<style>body{font:16px system-ui;max-width:1100px;margin:auto;padding:20px;background:#eee}video{width:100%;max-height:65vh;background:#111}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}button{cursor:pointer}img{width:100%}span{display:block}</style>'
    page += '<h1>Unapproved exact-media review</h1><p>Publication disabled. Samples and audio statistics do not certify creative quality. Play the original with sound to assess motion, voices, effects and synchronization. Seeking or playback does not automatically record review or approval.</p>'
    page += f'<p>SHA-256: <code>{html.escape(digest)}</code></p><video id="video" controls playsinline preload="metadata" src="candidate.mp4"></video><p><a href="audio.wav">Isolated original mixed audio</a> · <a href="manifest.json">Evidence scope and exact timestamps</a> · <a href="audio-diagnostics.txt">Audio diagnostics (not listening)</a></p><section>{cards}</section>'
    page += '<script>document.querySelectorAll("button[data-time]").forEach(b=>b.onclick=()=>{document.getElementById("video").currentTime=Number(b.dataset.time);document.getElementById("video").scrollIntoView();});</script>'
    (destination / 'index.html').write_text(page)
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--every', type=float, default=1.0)
    args = parser.parse_args()
    result = prepare(args.video, args.out, args.sha256, args.every)
    print(json.dumps({k: result[k] for k in ['status', 'technical_decode', 'candidate_sha256', 'publication_enabled']}))
