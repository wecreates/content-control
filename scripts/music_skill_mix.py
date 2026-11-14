"""Local, explicit music-skill handoff to the existing sound mixer.

No downloads, synthesis, network or publishing. Numeric QA is not audition.
"""
import argparse
import hashlib
import json
import io
import wave
from pathlib import Path
import tempfile

try:
    from scripts.v2_audio_assemble import read_audio
    from scripts.v2_sound_mix import mix
except ModuleNotFoundError:
    from v2_audio_assemble import read_audio
    from v2_sound_mix import mix

MAX_FILE = 128 * 1024 * 1024
REQUIRED = ('finite', 'no_clipping', 'true_peak_ceiling', 'duration_exact',
            'stereo_48k_24bit', 'tail_quiet', 'dependency_hashes_verified')


def snapshot(path, expected, limit):
    if not isinstance(expected, str) or len(expected) != 64 or any(c not in '0123456789abcdef' for c in expected):
        raise ValueError('Explicit lowercase SHA-256 required')
    data = read_audio(path, limit)
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError('Source hash mismatch')
    return data


def validate_pcm(data):
    # Prevent playlist/protocol autodetection in ffmpeg. Only self-contained PCM.
    try:
        with wave.open(io.BytesIO(data), 'rb') as w:
            channels, width, rate, frames = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
            if w.getcomptype() != 'NONE' or channels not in (1, 2) or width not in (2, 3, 4) or rate not in (24000, 44100, 48000):
                raise ValueError('Bounded PCM WAV required')
            if not 0 < frames <= rate * 600 or len(w.readframes(frames)) != frames * channels * width:
                raise ValueError('Truncated or oversized WAV')
    except (wave.Error, EOFError) as exc:
        raise ValueError('Self-contained PCM WAV required') from exc


def handoff(*, music, music_sha256, report, report_sha256, project,
            project_sha256, voice, ccsd, sfx, out_dir):
    """Use declared local render evidence; does not authenticate authorship/rights."""
    out = Path(out_dir)
    # Never overwrite an existing production directory or source.
    if out.exists() or out.is_symlink():
        raise ValueError('Output must be a new directory')
    music_bytes = snapshot(music, music_sha256, MAX_FILE)
    report_bytes = snapshot(report, report_sha256, 2 * 1024 * 1024)
    project_bytes = snapshot(project, project_sha256, 2 * 1024 * 1024)
    record = json.loads(report_bytes)
    if not isinstance(record, dict) or record.get('status') != 'TECHNICAL_PASS_AUDITION_PENDING':
        raise ValueError('Expected technical-only music-skill receipt')
    project_object = json.loads(project_bytes)
    canonical_sha = hashlib.sha256(json.dumps(project_object, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()
    if record.get('project_sha256') != canonical_sha:
        raise ValueError('Project receipt mismatch')
    checks = record.get('checks')
    if not isinstance(checks, dict) or not all(checks.get(key) is True for key in REQUIRED):
        raise ValueError('Required music checks did not pass')
    if not isinstance(json.loads(project_bytes), dict):
        raise ValueError('Project must be an object')
    if len(sfx) != 2:
        raise ValueError('Two effects required')
    # Snapshot inputs before ffmpeg reads them. Special files/oversize inputs fail.
    voices = read_audio(voice, MAX_FILE)
    effects = [read_audio(p, MAX_FILE) for p in sfx]
    for data in [music_bytes, voices, *effects]:
        validate_pcm(data)
    # Atomic reservation: parallel jobs cannot overwrite one another.
    out.mkdir(mode=0o700, parents=False, exist_ok=False)
    with tempfile.TemporaryDirectory(prefix='music-skill-handoff-') as td:
        root = Path(td)
        files = [root / name for name in ('music.audio', 'voice.audio', 'fx1.audio', 'fx2.audio')]
        for path, data in zip(files, [music_bytes, voices, *effects]):
            path.write_bytes(data)
        result = mix(files[1], ccsd, files[0], files[2:], out)
    result.update(status='TECHNICAL_PASS_AUDITION_PENDING', production_approved=False,
                  creative_approved=False, direct_audio_listening_performed=False,
                  paid_generation_enabled=False, publication_enabled=False)
    result['music_skill'] = {'music_sha256': music_sha256, 'report_sha256': report_sha256,
                            'project_sha256': project_sha256,
                            'evidence_scope': 'Caller-pinned local bytes and declared technical report; not authentication or rights approval'}
    result['scope'] = 'Local music-skill handoff and mix integrity only; full listening, rights and video acceptance still required'
    (out / 'music-skill-mix-receipt.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    for key in ('music', 'music-sha256', 'report', 'report-sha256', 'project', 'project-sha256', 'voice', 'ccsd', 'out-dir'):
        p.add_argument('--' + key, required=True)
    p.add_argument('--sfx', nargs=2, required=True)
    a = vars(p.parse_args())
    try:
        a['ccsd'] = json.loads(read_audio(a['ccsd'], 2 * 1024 * 1024))
        result = handoff(**a)
    except (ValueError, OSError, KeyError, TypeError) as exc:
        print(json.dumps({'status': 'BLOCKED', 'reason': str(exc), 'publication_enabled': False}))
        return 2
    print(json.dumps(result))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
