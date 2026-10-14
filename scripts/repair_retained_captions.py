"""Regenerate only captions for the two recovered, hash-pinned candidates."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
try:
    from scripts.v2_captions import build_captions
except ModuleNotFoundError:
    from v2_captions import build_captions

HASHES = {'short': 'b67bf2cdb74026f39c62f6e187ffb3fd362fdc820d009f01f9401c5dd70a5884',
          'long': 'ae4b2332c2c616b5004dc58ff9e8fcdbd754107ac04fd478bba8eb26a950d324'}

def exposure(track):
    counts = collections.Counter()
    for cue, frames in zip(track['cues'], track['frame_visibility']['cue_frame_counts']):
        for index in cue['display_word_indices']:
            counts[index] += frames
    return dict(counts)

def prepare(root, out, kind):
    root, out = Path(root), Path(out)
    with (root / 'candidate.mp4').open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual != HASHES[kind]:
        raise ValueError('Recovered candidate hash mismatch')
    if out.exists():
        raise ValueError('Output must be new')
    composition = json.loads((root / 'composition.json').read_text())['composition']
    if composition != {'short': 'StudioAnimatic', 'long': 'StudioLong'}[kind]:
        raise ValueError('Unexpected retained composition')
    props = json.loads((root / 'props.json').read_text())
    ccsd = props['ccsd']
    old = ccsd['caption_track']
    transcript = 'transcription-repaired.json' if kind == 'long' else 'transcription.json'
    fixed = build_captions(ccsd, json.loads((root / transcript).read_text()), root / 'voice.wav')
    # Caption text/windowing only. Speech timing and attribution must be exact.
    fields = ['start', 'end', 'word', 'speaker', 'scene_id', 'source_word_indices']
    if [[c[k] for k in fields] for c in old['cues']] != [[c[k] for k in fields] for c in fixed['cues']]:
        raise ValueError('Repair unexpectedly changes speech timing or attribution')
    before, after = exposure(old), exposure(fixed)
    brief = [i for i, n in before.items() if n <= 2]
    if any(after[i] <= 2 for i in brief):
        raise ValueError('Confirmed brief-word defect remains')
    out.mkdir(parents=True)
    (out / 'composition.json').write_text(json.dumps({'composition': composition}))
    (out / 'ccsd.json').write_text(json.dumps(ccsd))
    ccsd['caption_track'] = fixed
    (out / 'props.json').write_text(json.dumps(props))
    (out / 'captions.json').write_text(json.dumps(fixed, indent=2))
    (out / 'repair-evidence.json').write_text(json.dumps({
        'source_candidate_sha256': actual, 'source_run_id': 38472504826,
        'renderer_source_commit': '89f02aaa10036df57283982fcf727b443dcc306e',
        'changed_scope': 'caption display phrase window only; original renderer and muxed audio reused',
        'confirmed_brief_words': [{'index': i, 'before_frames': before[i], 'after_frames': after[i]} for i in brief],
        'observed_timing_unchanged': True, 'status': 'RENDER_REQUIRED',
        'production_approved': False, 'publication_enabled': False}, indent=2))

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--input', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--format', choices=list(HASHES), required=True)
    a = p.parse_args()
    prepare(a.input, a.out, a.format)
