"""Free local review transport. No model calls and no creative certification."""
import argparse
import hashlib
import json
import shutil
import subprocess
import wave
from pathlib import Path


def sha(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def review_packets(output, source_hash, segment_seconds=10):
    """Separate existing sampled frames and exact PCM intervals for media ingestion.

    This is a transport workaround, not a claim of continuous motion review.
    Audio chunks partition the decoded final mix without gaps or resampling.
    """
    output = Path(output)
    if not isinstance(segment_seconds, int) or not 1 <= segment_seconds <= 60:
        raise ValueError('Packet duration must be 1..60 integer seconds')
    directory = output / 'packets'
    directory.mkdir()
    frames = sorted((output / 'frames').glob('*.jpg'))
    packets = []
    with wave.open(str(output / 'final-mix.wav'), 'rb') as source:
        params = source.getparams()
        rate, total = source.getframerate(), source.getnframes()
        if total <= 0:
            raise ValueError('Empty decoded audio')
        for start in range(0, total, rate * segment_seconds):
            end = min(total, start + rate * segment_seconds)
            name = f'packets/{len(packets):04d}.wav'
            data = source.readframes(end - start)
            if len(data) != (end - start) * params.nchannels * params.sampwidth:
                raise ValueError('Truncated decoded audio')
            with wave.open(str(output / name), 'wb') as target:
                target.setparams(params)
                target.writeframes(data)
            packets.append({'audio': name, 'audio_sha256': sha(output / name),
                'start_sample': start, 'end_sample_exclusive': end,
                'start_sec': start / rate, 'end_sec': end / rate,
                'frames': [{'path': str(p.relative_to(output)), 'sha256': sha(p),
                    'nominal_filter_time_sec': i}
                    for i, p in enumerate(frames) if start / rate <= i < end / rate],
                'status': 'NOT_REVIEWED'})
    result = {'schema_version': 1, 'candidate_sha256': source_hash,
        'sample_rate': rate, 'audio_samples': total, 'packets': packets,
        'frame_scope': '1 FPS filter samples with nominal output times, not exact source-frame timestamps or continuous motion.',
        'prompt': 'Inspect the attached images and listen to the attached WAV. First identify actual visible details and transcribe actual speech without using filenames or supplied scripts. Report INACCESSIBLE for any unreadable modality. Record observations within this packet interval. Never certify continuous motion from sampled images or a whole video from one packet.',
        'full_video_review': False, 'full_audio_review': False,
        'production_approved': False, 'publication_enabled': False}
    (output / 'review-packets.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def build(video, output):
    source = Path(video).resolve(strict=True)
    output = Path(output).resolve()
    # Never overwrite originals, previous evidence, or aliases.
    if output.exists():
        raise ValueError('Output must be a new directory')
    source_hash = sha(source)
    probe = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(source)], timeout=30))
    if sha(source) != source_hash:
        raise ValueError('Source mutated during media probe')
    if not all(any(s.get('codec_type') == kind for s in probe['streams']) for kind in ['video', 'audio']):
        raise ValueError('Both video and audio are required')
    output.mkdir(parents=True)
    shutil.copyfile(source, output / 'candidate.mp4')
    if sha(output / 'candidate.mp4') != source_hash:
        raise ValueError('Copy integrity failure')
    decode = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-xerror', '-err_detect', 'explode',
        '-i', str(source), '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'], capture_output=True, text=True, timeout=600)
    (output / 'decode.log').write_text(decode.stderr)
    if decode.returncode:
        raise ValueError('Full audiovisual decode failed; inspect decode.log')
    # Preserve original timing and aspect ratio. Audio is decoded from the final mux.
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(source), '-map', '0:a:0',
        '-c:a', 'pcm_s16le', str(output / 'final-mix.wav')], check=True, timeout=600)
    (output / 'frames').mkdir()
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(source), '-vf',
        'fps=1,scale=640:640:force_original_aspect_ratio=decrease', '-q:v', '3',
        str(output / 'frames' / '%06d.jpg')], check=True, timeout=600)
    audio = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-nostats', '-i', str(source),
        '-map', '0:a:0', '-af', 'ebur128=peak=true,silencedetect=noise=-45dB:d=1', '-f', 'null', '-'],
        capture_output=True, text=True, timeout=600)
    (output / 'audio-diagnostics.log').write_text(audio.stderr)
    if audio.returncode or sha(source) != source_hash:
        raise ValueError('Audio analysis failed or source mutated')
    review_packets(output, source_hash)
    receipt = {'schema_version': 1, 'candidate_sha256': source_hash,
        'duration_seconds': float(probe['format']['duration']), 'technical_decode': 'PASS',
        'status': 'REVIEW_PENDING', 'full_video_review': False, 'full_audio_review': False,
        'production_approved': False, 'publication_enabled': False,
        'frame_sampling': '1 FPS; sample n represents the fps filter output, not complete motion coverage',
        'scope': 'Local access package and decode diagnostics only; listening, motion judgment, synchronization, character identity and competitor comparison require actual review.',
        'files': {str(p.relative_to(output)): sha(p) for p in output.rglob('*') if p.is_file()}}
    (output / 'evidence.json').write_text(json.dumps(receipt, indent=2) + '\n')
    (output / 'index.html').write_text('''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Unapproved candidate — local audiovisual review</title>
<style>body{font:18px system-ui;max-width:960px;margin:24px auto;padding:12px}video{width:100%;max-height:75vh}button{padding:12px;margin:4px}</style>
<h1>Review pending · publication disabled</h1>
<p>Original candidate, unchanged. Watch and listen end to end. Sampled images and successful decoding do not constitute creative approval.</p>
<video id="v" controls playsinline preload="metadata" src="candidate.mp4"></video>
<p><button onclick="v.currentTime=Math.max(0,v.currentTime-5)">Back 5 seconds</button><button onclick="v.currentTime+=5">Forward 5 seconds</button>
<button onclick="v.playbackRate=.5">Half speed</button><button onclick="v.playbackRate=1">Normal speed</button></p>
<p id="t"></p><script>const v=document.querySelector('video');v.ontimeupdate=()=>document.querySelector('#t').textContent=v.currentTime.toFixed(3)+' seconds';</script>
<p>Log observed intervals and timestamped defects for hook, escalation, visual storytelling, character consistency, voice, sound mix, pacing, phone readability, payoff and factual accuracy. Review two distinct references with audio before claiming parity. Use exact_av_review.mjs to validate the resulting review; this page never approves or publishes.</p>
<a href="evidence.json">Integrity and scope</a> · <a href="final-mix.wav">Final mixed audio</a>''')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--video', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    result = build(args.video, args.out)
    print(json.dumps({k: result[k] for k in ['candidate_sha256', 'technical_decode', 'status', 'publication_enabled']}))

