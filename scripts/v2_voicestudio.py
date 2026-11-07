"""Opt-in pinned VoiceStudio/Kitten CPU narration, without paid fallback."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile
import wave

VOICE_ASSIGNMENTS = {'narrator': 'expr-voice-2-m', 'dave': 'expr-voice-3-m', 'points_monk': 'expr-voice-4-m'}
MODEL = 'KittenML/kitten-tts-mini-0.8'
MODEL_REVISION = 'c02725660cea441db4c383af69f1f26f5cd00947'
UPSTREAM_REVISION = '4df5033e5a1a92e22936fb4d7d2d39e03cf10a91'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def validate_generation(request, raw, record):
    expected = {'status': 'PASS', 'tool': 'voicestudio', 'operation': 'synthesize',
                'engine': 'kittentts', 'model': MODEL, 'model_revision': MODEL_REVISION,
                'upstream_revision': UPSTREAM_REVISION, 'voice': request['voice'],
                'speed': request['speed'], 'language': 'en',
                'text_sha256': hashlib.sha256(request['text'].encode()).hexdigest(),
                'output_sha256': sha(raw), 'synthetic': True,
                'paid_generation_enabled': False, 'publication_enabled': False}
    if any(record.get(k) != v for k, v in expected.items()):
        raise ValueError('VoiceStudio generation provenance mismatch')
    with wave.open(str(raw), 'rb') as w:
        if (w.getnchannels(), w.getsampwidth(), w.getframerate()) != (1, 2, 24000):
            raise ValueError('VoiceStudio must emit 24 kHz mono PCM16')
        frames = w.getnframes()
        if not 0 < frames <= 24000 * 180 or len(w.readframes(frames)) != frames * 2:
            raise ValueError('Invalid or truncated VoiceStudio audio')
        return frames / 24000


def generate(ccsd, out_dir, money_factory, runtime, synth=None):
    if ccsd.get('publication_enabled') is not False:
        raise ValueError('Publication must remain disabled')
    root = Path(money_factory).resolve()
    runtime = Path(runtime).resolve()
    scenes = sorted(ccsd.get('scenes', []), key=lambda s: float(s['start']))
    if not scenes:
        raise ValueError('Scenes required')
    duration = max(float(s['end']) for s in scenes)
    if not math.isfinite(duration) or not 0 < duration <= 600:
        raise ValueError('Invalid timeline duration')
    dialogue = []
    ids = set()
    for scene in scenes:
        start, end = float(scene['start']), float(scene['end'])
        if not math.isfinite(start) or not 0 <= start < end <= duration or scene['id'] in ids:
            raise ValueError('Invalid scene timing or duplicate scene ID')
        ids.add(scene['id'])
        entries = [d for d in scene.get('audio', {}).get('dialogue', []) if d.get('text', '').strip()]
        if len(entries) > 1:
            raise ValueError('One timed dialogue per scene required')
        for d in entries:
            if d.get('speaker') not in VOICE_ASSIGNMENTS:
                raise ValueError('Speaker has no VoiceStudio preset; nonverbal roles stay silent')
            text = d['text'].strip()
            speed = d.get('performance', {}).get('synthesis_speed', 1.0)
            if not 1 <= len(text) <= 1200 or not any(c.isalpha() for c in text):
                raise ValueError('Provide 1..1200 characters of English dialogue')
            if type(speed) not in (int, float) or not math.isfinite(speed) or not 1 <= speed <= 1.45:
                raise ValueError('Invalid synthesis speed')
            dialogue.append((scene, d, text, speed))
    if not dialogue:
        raise ValueError('No dialogue to synthesize')
    out = Path(out_dir).resolve()
    # Dedicated output directory prevents replacing accepted/historical takes.
    if out.exists():
        raise FileExistsError('Use a new VoiceStudio output directory')
    out.parent.mkdir(parents=True, exist_ok=True)
    manifest = {'schema_version': 1, 'publication_enabled': False, 'paid_generation_enabled': False,
                'provider': 'voicestudio', 'engine': 'kittentts', 'model_id': 'kitten-tts-mini-0.8',
                'model_repository': MODEL, 'model_revision': MODEL_REVISION,
                'upstream_revision': UPSTREAM_REVISION, 'generator_sha256': sha(__file__),
                'voice_assignments': dict(VOICE_ASSIGNMENTS), 'device': 'cpu', 'provider_calls': 0,
                'status': 'GENERATED_PENDING_LISTENING_REVIEW', 'clips': [],
                'scope': 'Technical synthesis and timing only; listening and creative acceptance remain pending'}
    with tempfile.TemporaryDirectory(prefix='.voicestudio-', dir=out.parent) as temp:
        stage = Path(temp) / 'clips'
        stage.mkdir()
        for i, (scene, d, text, speed) in enumerate(dialogue):
            next_start = float(dialogue[i+1][0]['start']) if i+1 < len(dialogue) else duration
            window = next_start - float(scene['start'])
            if window <= .08:
                raise ValueError('Dialogue windows overlap or are too short')
            request = {'text': text, 'voice': VOICE_ASSIGNMENTS[d['speaker']], 'speed': speed,
                       'language': 'en', 'publication_enabled': False, 'paid_generation_enabled': False}
            raw = stage / f'{i:02d}-source.wav'
            request_path = stage / f'{i:02d}-request.json'
            request_path.write_text(json.dumps(request, indent=2) + '\n')
            if synth is None:
                subprocess.run([str(runtime/'bin/python'), str(root/'integrations/voicestudio/runner.py'),
                    '--upstream', str(root/'integrations/vendor/voicestudio'), '--runtime', str(runtime),
                    '--input', str(request_path), '--output', str(raw)], check=True, timeout=300)
                record = json.loads(Path(str(raw)+'.generation.json').read_text())
            else:
                record = synth(request, raw)
                Path(str(raw)+'.generation.json').write_text(json.dumps(record))
            seconds = validate_generation(request, raw, record)
            if seconds > window - .03:
                raise ValueError('Narration exceeds dialogue window; retake required, never truncate')
            target = stage / f'{i:02d}-{d["speaker"]}.wav'
            subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-n',
                '-i', str(raw), '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', str(target)],
                check=True, capture_output=True, timeout=60)
            with wave.open(str(target), 'rb') as w:
                converted = w.getnframes()/w.getframerate()
                if (w.getnchannels(), w.getsampwidth(), w.getframerate()) != (2,2,44100) or converted > window:
                    raise ValueError('Converted audio violates format or timeline')
            manifest['clips'].append({'scene_id': scene['id'], 'speaker': d['speaker'],
                'voice_id': request['voice'], 'file': target.name, 'text_sha256': record['text_sha256'],
                'audio_sha256': sha(target), 'duration': converted, 'window_seconds': window,
                'requested_speed': speed, 'speed': speed, 'attempts': 1, 'reused': False,
                'source_file': raw.name, 'source_audio_sha256': sha(raw), 'generation_file': raw.name+'.generation.json',
                'generation_sha256': sha(str(raw)+'.generation.json'), 'synthetic': True,
                'watermark_applied': record.get('watermark_applied') is True})
        (stage/'approved-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
        os.rename(stage, out)
    return manifest


def main():
    p = argparse.ArgumentParser()
    for name in ('ccsd', 'out-dir', 'money-factory', 'runtime'):
        p.add_argument('--'+name, required=True)
    a = p.parse_args()
    generate(json.loads(Path(a.ccsd).read_text()), a.out_dir, a.money_factory, a.runtime)


if __name__ == '__main__':
    main()
