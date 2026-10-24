"""Render bounded storyboard repairs against hash-verified retained Long audio.

Preview audio is sample-accurately extracted and AAC encoded; the original full
candidate remains intact. A future full-length visual replacement can copy its
original AAC stream without this preview-only extraction.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess

SOURCE_SHA = '873dbe0a3ee19db6c7a1eb7441b20dfa35ae9e78b92dc90015ca6858f0718bcc'
CAPTION_SHA = '380ac054c17bbe8d5709a313cbe51817918452f84658aad5feb4f27403546c02'
SEGMENTS = (
    ('fee-consequence', 0, 688),
    ('store-shelves', 2162, 2696),
    ('audit-cart', 4071, 4304),
    ('trophy-invoice', 6896, 7425),
    ('ladder-deletions', 8830, 9089),
    ('four-rules', 11439, 11969),
    ('horror-teaser', 12340, 12463),
)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    retained, output = Path('retained'), Path('storyboard-preview')
    source = retained / 'candidate.mp4'
    assert sha(source) == SOURCE_SHA, 'Retained audio/video source changed'
    assert sha(retained / 'captions.json') == CAPTION_SHA, 'Observed captions changed'
    assert sha(retained / 'ccsd.json') == sha(Path('projects/long/credit-card-dlc/ccsd.json')), 'Storyboard changed'
    ccsd = json.loads((retained / 'ccsd.json').read_text())
    ccsd['caption_track'] = json.loads((retained / 'captions.json').read_text())
    output.mkdir(exist_ok=False)
    props = output / 'props.json'
    props.write_text(json.dumps({'ccsd': ccsd}))
    bin_dir = Path('node_modules/@remotion/compositor-linux-x64-gnu')
    ffmpeg, ffprobe = bin_dir / 'ffmpeg', bin_dir / 'ffprobe'
    assert all(p.is_file() and os.access(p, os.X_OK) for p in (ffmpeg, ffprobe)), 'Pinned media binaries missing'
    from production_reality_media_qa import probe, audio_covers_video
    receipts = []
    for name, first, last in SEGMENTS:
        silent, candidate = output / (name + '-silent.mp4'), output / (name + '.mp4')
        duration = (last - first + 1) / 24
        subprocess.run(['node_modules/.bin/remotion', 'render', 'remotion/studio-animatic-index.jsx', 'StudioLong', str(silent), '--props=' + str(props), f'--frames={first}-{last}', '--concurrency=2', '--pixel-format=yuv420p', '--color-space=bt709'], check=True, timeout=240)
        subprocess.run([str(ffmpeg), '-v', 'error', '-i', str(silent), '-ss', str(first / 24), '-i', str(source), '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', str(duration), str(candidate)], check=True, timeout=60)
        subprocess.run([str(ffmpeg), '-v', 'error', '-i', str(candidate), '-c:v', 'rawvideo', '-c:a', 'pcm_s16le', '-f', 'null', '-'], check=True, timeout=60)
        stream_probe = json.loads(subprocess.check_output([str(ffprobe), '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(candidate)]))
        video = next(s for s in stream_probe['streams'] if s['codec_type'] == 'video')
        audio = next(s for s in stream_probe['streams'] if s['codec_type'] == 'audio')
        assert int(video['nb_frames']) == last - first + 1
        assert (video['width'], video['height'], video['r_frame_rate']) == (1280, 720, '24/1')
        assert abs(float(video['duration']) - duration) < 1/24
        assert abs(float(audio['duration']) - duration) < .05
        metrics = probe(candidate)
        global_metrics = probe(candidate, sample_offset_frames=(-first) % 3) if first % 3 else metrics
        metrics['global_sampling_max_duplicate_run_seconds'] = global_metrics['max_duplicate_run_seconds']
        checks = {'complete_video_decode': metrics['complete_video_decode'], 'complete_av_decode': metrics['complete_av_decode'], 'audio_audible': metrics['audio_audible'], 'audio_covers_video': audio_covers_video(metrics, duration), 'no_black': metrics['black_samples'] == 0, 'no_duplicate_run': metrics['max_duplicate_run_seconds'] < .75, 'safe_border': metrics['max_border'] < .18, 'no_duplicate_run_global_alignment': global_metrics['max_duplicate_run_seconds'] < .75}
        receipts.append({'name': name, 'frames': [first, last], 'source_start_seconds': first/24, 'duration_seconds': duration, 'sha256': sha(candidate), 'full_av_decode': 'PASS', 'video_frames': int(video['nb_frames']), 'checks': checks, 'metrics': metrics})
        print(json.dumps(receipts[-1]), flush=True)
    assert sha(source) == SOURCE_SHA
    receipt = {'status': 'PREVIEWS_PENDING_CREATIVE_REVIEW', 'publication_enabled': False, 'production_approved': False, 'source_commit': os.environ.get('GITHUB_SHA'), 'source_candidate_sha256': SOURCE_SHA, 'source_captions_sha256': CAPTION_SHA, 'audio': 'Existing source audio extracted at exact segment start and AAC encoded for preview only; no voice generation', 'segments': receipts}
    passed = all(all(segment['checks'].values()) for segment in receipts)
    if not passed: receipt['status'] = 'BLOCKED_PREVIEW_MEDIA_CHECKS'
    (output / 'preview-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    assert passed, 'Preview media checks failed; inspect the preserved receipt and clips'

if __name__ == '__main__':
    main()
