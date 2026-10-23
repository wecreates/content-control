"""Explicit multi-turn timing adapter for the existing local CPU Kokoro backend.

This does not assign voices, invent timing, or grant listening/creative approval.
The normalized CCSD is speech-only; retain the original for visual rendering.
"""
import argparse
import copy
import json
import math
from pathlib import Path

try:
    from scripts.v2_free_voice import generate, VOICE_ASSIGNMENTS, local_synthesizer
    from scripts.v2_audio_assemble import assemble
except ModuleNotFoundError:
    from v2_free_voice import generate, VOICE_ASSIGNMENTS, local_synthesizer
    from v2_audio_assemble import assemble


def seconds(value):
    if type(value) not in (int, float) or not 0 <= value <= 600 or not math.isfinite(value):
        raise ValueError('Finite timing in 0..600 seconds required')
    return float(value)


def prepare_timeline(ccsd):
    """Split explicit dialogue windows without changing text or voice assignments."""
    if not isinstance(ccsd, dict) or ccsd.get('publication_enabled') is not False:
        raise ValueError('Publication must remain disabled')
    scenes = ccsd.get('scenes')
    if not isinstance(scenes, list) or not scenes:
        raise ValueError('Scenes required')
    ordered = []
    ids = set()
    for scene in scenes:
        if not isinstance(scene, dict) or not isinstance(scene.get('id'), str) or not scene['id'].strip():
            raise ValueError('Scene identity required')
        if scene['id'] in ids:
            raise ValueError('Duplicate scene identity')
        ids.add(scene['id'])
        start, end = seconds(scene.get('start')), seconds(scene.get('end'))
        if start >= end:
            raise ValueError('Scene start must precede end')
        ordered.append((start, end, scene))
    ordered.sort(key=lambda row: row[0])
    turns = []
    previous_end = 0.0
    for start, end, scene in ordered:
        if start < previous_end:
            raise ValueError('Overlapping scene timing')
        previous_end = end
        audio = scene.get('audio', {})
        if not isinstance(audio, dict) or not isinstance(audio.get('dialogue', []), list):
            raise ValueError('Dialogue list required')
        dialogue = audio.get('dialogue', [])
        active = []
        for index, entry in enumerate(dialogue):
            if not isinstance(entry, dict) or not isinstance(entry.get('text'), str):
                raise ValueError('Dialogue text required')
            if not entry['text'].strip():
                continue
            if entry.get('speaker') not in VOICE_ASSIGNMENTS:
                raise ValueError('Speaker has no approved speaking voice; nonverbal roles remain unvoiced')
            active.append((index, entry))
        turn_end = start
        for index, entry in active:
            explicit = 'start' in entry or 'end' in entry
            if len(active) > 1 and not explicit:
                raise ValueError('Multiple dialogue turns require explicit start and end times')
            a, b = (seconds(entry.get('start')), seconds(entry.get('end'))) if explicit else (start, end)
            if not start <= a < b <= end or a < turn_end or b-a <= .08:
                raise ValueError('Dialogue windows overlap, are too short, or exceed their scene')
            turn_end = b
            turns.append({'id': f'turn-{len(turns):04d}', 'source_scene_id': scene['id'],
                          'source_dialogue_index': index, 'start': a, 'end': b,
                          'audio': {'dialogue': [copy.deepcopy(entry)]}})
    if not turns:
        raise ValueError('No spoken dialogue')
    # Speech-only normalized scenes retain the source identity for traceability.
    result = copy.deepcopy(ccsd)
    result['scenes'] = turns
    result['speech_timeline_only'] = True
    result['source_duration_seconds'] = max(end for _, end, _ in ordered)
    return result


def build(ccsd, out_dir, synth=None):
    timeline = prepare_timeline(ccsd)
    # Generate each explicit turn independently: the backend's final window is
    # exactly the turn's end, so it cannot borrow a later character's silence.
    root = Path(out_dir)
    if root.exists() or root.is_symlink():
        raise ValueError('Use a new output directory; existing evidence must not be overwritten')
    if synth is None:
        synth = local_synthesizer()
    root.mkdir(parents=True, exist_ok=False)
    clips = []
    generator_sha = None
    for turn in timeline['scenes']:
        isolated = {'publication_enabled': False, 'scenes': [copy.deepcopy(turn)]}
        generated = generate(isolated, root / turn['id'], synth)
        generator_sha = generated['generator_sha256']
        clip = dict(generated['clips'][0])
        clip['file'] = turn['id'] + '/' + clip['file']
        clips.append(clip)
    # Include the original end so trailing nonverbal beats retain their silence.
    assemble_timeline = copy.deepcopy(timeline)
    duration = timeline['source_duration_seconds']
    if assemble_timeline['scenes'][-1]['end'] < duration:
        assemble_timeline['scenes'].append({'id': 'silent-tail', 'start': assemble_timeline['scenes'][-1]['end'],
                                          'end': duration, 'audio': {'dialogue': []}})
    manifest = {'provider': 'kokoro', 'model_id': 'Kokoro-82M', 'publication_enabled': False,
                'voice_assignments': dict(VOICE_ASSIGNMENTS), 'clips': clips,
                'generator_sha256': generator_sha, 'status': 'GENERATED_PENDING_LISTENING_REVIEW'}
    technical = assemble(assemble_timeline, manifest, root, root / 'voice.wav')
    result = {'status': 'GENERATED_PENDING_LISTENING_REVIEW', 'provider': 'kokoro',
              'publication_enabled': False, 'production_approved': False, 'full_av_review': False,
              'provider_calls': 0, 'voice_assignments': dict(VOICE_ASSIGNMENTS),
              'timeline': timeline, 'manifest': manifest, 'audio': technical,
              'scope': 'Explicit timed local stock voices; requires transcript and listening review'}
    (root / 'timed-voice.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--ccsd', required=True)
    p.add_argument('--out-dir', required=True)
    a = p.parse_args()
    try:
        result = build(json.loads(Path(a.ccsd).read_text()), a.out_dir)
    except (ValueError, OSError, KeyError, TypeError, ImportError, RuntimeError) as error:
        print(json.dumps({'status': 'BLOCKED', 'reason': str(error), 'publication_enabled': False}))
        return 2
    print(json.dumps({'status': result['status'], 'publication_enabled': False, 'production_approved': False}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
