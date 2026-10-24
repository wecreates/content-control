"""Measure actual stock-voice durations; never rewrite timing or grant approval."""
import argparse
import hashlib
import json
import math
from pathlib import Path
from timed_free_voice import prepare_timeline
from v2_free_voice import local_synthesizer, VOICE_ASSIGNMENTS, MAX_SPEED


def measure(source, output):
    timeline = prepare_timeline(source)
    path = Path(output)
    if path.exists():
        raise ValueError('Preserve existing measurement evidence')
    synth = local_synthesizer()
    rows = []
    for turn in timeline['scenes']:
        dialogue = turn['audio']['dialogue'][0]
        row = {'turn_id': turn['id'], 'source_scene_id': turn['source_scene_id'],
               'speaker': dialogue['speaker'], 'text': dialogue['text'],
               'text_sha256': hashlib.sha256(dialogue['text'].encode()).hexdigest(),
               'voice_id': VOICE_ASSIGNMENTS[dialogue['speaker']],
               'start': turn['start'], 'end': turn['end'], 'measurements': []}
        for speed in (1.0, MAX_SPEED):
            samples, rate = synth(dialogue['text'], row['voice_id'], speed)
            if not samples or rate <= 0 or not all(math.isfinite(x) for x in samples):
                raise ValueError('Invalid synthesis measurement')
            row['measurements'].append({'speed': speed, 'duration_seconds': len(samples)/rate,
                                        'sample_count': len(samples), 'sample_rate': rate})
        rows.append(row)
    receipt = {'status': 'MEASURED_NOT_APPROVED', 'publication_enabled': False,
               'production_approved': False, 'provider': 'kokoro', 'provider_calls': 0,
               'source_sha256': hashlib.sha256(json.dumps(source, sort_keys=True).encode()).hexdigest(),
               'measurements': rows, 'scope': 'Actual synthesis duration only; no listening/transcript approval or timing mutation'}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(receipt, indent=2)+'\n')
    return receipt


if __name__ == '__main__':
    p=argparse.ArgumentParser(); p.add_argument('--ccsd',required=True); p.add_argument('--out',required=True)
    args=p.parse_args(); print(json.dumps(measure(json.loads(Path(args.ccsd).read_text()),args.out)))
