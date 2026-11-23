"""Free local review transport. No model calls and no creative certification."""
import argparse
from fractions import Fraction
import hashlib
import json
import shutil
import subprocess
import wave
from pathlib import Path


def sha(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def playback_audio(raw_path, playback_path, stream, media, frames):
    """Join decoded samples on the container playback clock, without resampling."""
    if not frames:
        raise ValueError('Decoded audio has no presentation timestamps')
    try:
        clock = Fraction(stream['time_base'])
        origin = Fraction(media.get('start_time', '0'))
        duration = Fraction(media['duration'])
        start_pts = int(stream['start_pts'])
        duration_ts = int(stream['duration_ts'])
        if clock <= 0 or duration <= 0 or duration_ts <= 0:
            raise ValueError('Invalid duration')
        rows = []
        for frame in frames:
            pts = int(frame['pts'])
            count = int(frame['nb_samples'])
            reported = frame.get('duration')
            if reported in (None, 'N/A'):
                reported = frame.get('pkt_duration')
            ticks = int(reported) if reported not in (None, 'N/A') else None
            if count <= 0 or (ticks is not None and ticks <= 0) or (rows and pts <= rows[-1][0]):
                raise ValueError('Invalid decoded frame range')
            rows.append((pts, count, ticks))
    except (KeyError, TypeError, ValueError, ZeroDivisionError) as error:
        raise ValueError('Invalid audio playback clock or frame metadata') from error

    with wave.open(str(raw_path), 'rb') as raw:
        rate = raw.getframerate()
        width = raw.getnchannels() * raw.getsampwidth()
        total = int(duration * rate)
        if not 0 < total * width < 2**32 - 128:
            raise ValueError('Playback clock exceeds the supported WAV size')
        if sum(count for _, count, _ in rows) != raw.getnframes():
            raise ValueError('Decoded sample count differs from audio frame metadata')

        def position(timestamp):
            return round((timestamp * clock - origin) * rate)

        terminal = min(total, position(start_pts + duration_ts))
        cursor = kept = 0
        silence = bytes(65536 * width)
        with wave.open(str(playback_path), 'wb') as aligned:
            aligned.setparams(raw.getparams())
            def fill(count):
                while count:
                    step = min(count, 65536)
                    aligned.writeframesraw(silence[:step * width])
                    count -= step

            for index, (pts, count, ticks) in enumerate(rows):
                data = raw.readframes(count)
                if len(data) != count * width:
                    raise ValueError('Truncated decoded samples')
                start = position(pts)
                next_start = position(rows[index + 1][0]) if index + 1 < len(rows) else terminal
                valid_end = position(pts + ticks) if ticks is not None else start + count
                end = min(start + count, next_start, valid_end, terminal)
                begin = max(start, cursor)
                if begin < end:
                    fill(begin - cursor)
                    aligned.writeframesraw(data[(begin - start) * width:(end - start) * width])
                    kept += end - begin
                    cursor = end
            if not kept:
                raise ValueError('No decoded samples inside the playback interval')
            fill(total - cursor)
        return {'method': 'decoded frame presentation timestamps', 'sample_rate': rate,
                'media_start_time': str(origin), 'duration_seconds': float(duration),
                'stream_time_base': str(clock), 'decoded_samples': raw.getnframes(),
                'playback_samples': total, 'presented_source_samples': kept,
                'trimmed_source_samples': raw.getnframes() - kept,
                'silence_fill_samples': total - kept}


def review_packets(output, source_hash, segment_seconds=10, *, audio_clock=None):
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
    audio_file = 'playback-mix.wav' if audio_clock is not None else 'final-mix.wav'
    with wave.open(str(output / audio_file), 'rb') as source:
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
        'audio_source': audio_file,
        'sample_rate': rate, 'audio_samples': total, 'packets': packets,
        'frame_scope': '1 FPS filter samples with nominal output times, not exact source-frame timestamps or continuous motion.',
        'prompt': 'Inspect the attached images and listen to the attached WAV. First identify actual visible details and transcribe actual speech without using filenames or supplied scripts. Report INACCESSIBLE for any unreadable modality. Record observations within this packet interval. Never certify continuous motion from sampled images or a whole video from one packet.',
        'full_video_review': False, 'full_audio_review': False,
        'production_approved': False, 'publication_enabled': False}
    if audio_clock is not None:
        result['audio_clock'] = audio_clock
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
    candidate = str(output / 'candidate.mp4')
    decode = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-xerror', '-err_detect', 'explode',
        '-i', candidate, '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'], capture_output=True, text=True, timeout=600)
    (output / 'decode.log').write_text(decode.stderr)
    if decode.returncode:
        raise ValueError('Full audiovisual decode failed; inspect decode.log')
    # Keep the legacy decoded PCM for consumers that bind its byte identity.
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', candidate, '-map', '0:a:0',
        '-c:a', 'pcm_s16le', str(output / 'final-mix.wav')], check=True, timeout=600)
    clock_probe = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_frames',
        '-show_entries', 'frame=pts,nb_samples,duration,pkt_duration',
        '-of', 'json', candidate], timeout=120))
    audio_stream = next(s for s in probe['streams'] if s.get('codec_type') == 'audio')
    clock = playback_audio(output / 'final-mix.wav', output / 'playback-mix.wav',
                           audio_stream, probe['format'], clock_probe.get('frames', []))
    (output / 'frames').mkdir()
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', candidate, '-map', '0:v:0', '-vf',
        'fps=1,scale=640:640:force_original_aspect_ratio=decrease', '-q:v', '3',
        str(output / 'frames' / '%06d.jpg')], check=True, timeout=600)
    audio = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-nostats', '-i', str(output / 'playback-mix.wav'),
        '-map', '0:a:0', '-af', 'ebur128=peak=true,silencedetect=noise=-45dB:d=1', '-f', 'null', '-'],
        capture_output=True, text=True, timeout=600)
    (output / 'audio-diagnostics.log').write_text(audio.stderr)
    if audio.returncode or sha(source) != source_hash or sha(candidate) != source_hash:
        raise ValueError('Audio analysis failed or source mutated')
    review_packets(output, source_hash, audio_clock=clock)
    receipt = {'schema_version': 1, 'candidate_sha256': source_hash,
        'duration_seconds': float(probe['format']['duration']), 'technical_decode': 'PASS',
        'status': 'REVIEW_PENDING', 'full_video_review': False, 'full_audio_review': False,
        'production_approved': False, 'publication_enabled': False,
        'audio_clock': clock,
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
<a href="evidence.json">Integrity and scope</a> · <a href="playback-mix.wav">Playback-aligned audio</a>''')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--video', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    result = build(args.video, args.out)
    print(json.dumps({k: result[k] for k in ['candidate_sha256', 'technical_decode', 'status', 'publication_enabled']}))

