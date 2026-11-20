#!/usr/bin/env python3
"""Check authored picture timing separately from the unchanged retention budget.

This inspects source and audio identity; it does not inspect an encoded video.
"""
from datetime import datetime, timezone
import hashlib
import html
import json
import math
from pathlib import Path
import subprocess


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_timeline(root):
    path = (root / 'remotion/episode1-picture-timeline.mjs').resolve()
    command = 'const m=await import(process.argv[1]);console.log(JSON.stringify({timeline:m.pictureTimeline,narration_sha256:m.narrationSha256}));'
    return json.loads(subprocess.check_output(
        ['node', '--input-type=module', '-e', command, path.as_uri()], text=True, timeout=15))


def ordered_positions(text, phrases):
    positions, previous = [], -1
    for phrase in phrases:
        position = text.find(phrase, previous + 1)
        positions.append({'phrase': phrase, 'position': position})
        if position < 0:
            break
        previous = position
    return positions, len(positions) == len(phrases) and all(p['position'] >= 0 for p in positions)


def verify(root=Path('.')):
    contract_path = root / 'state/episode1-sync-contract.json'
    factual_path = root / 'state/episode1-factual-contract.json'
    source_path = root / 'remotion/V9ArticulatedVisual.jsx'
    timeline_path = root / 'remotion/episode1-picture-timeline.mjs'
    contract = json.loads(contract_path.read_text())
    factual = json.loads(factual_path.read_text())
    source = html.unescape(source_path.read_text())
    loaded = load_timeline(root)
    timeline = loaded['timeline']
    starts = [entry['start'] for entry in timeline]
    if not starts or any(type(x) not in (int, float) or not math.isfinite(x) for x in starts):
        raise ValueError('Timeline must have finite numeric starts')
    cuts = starts + [contract['duration_seconds']]
    fps = contract['fps']
    frames = [math.ceil(x * fps) for x in cuts]
    durations = [(b-a)/fps for a,b in zip(frames,frames[1:])]
    order = [entry['scene'] for entry in timeline]
    positions, headlines_ok = ordered_positions(source, contract['ordered_scene_headlines'])
    narration_positions, narration_ok = ordered_positions(factual['narration_text'].lower(),
        [p.lower() for p in contract['narration_semantic_order']])
    audio = root / factual['narration_path']
    audio_sha = sha(audio)
    cue_indices = contract['caption_cue_scene_indices']
    cues = factual['caption_cues']
    anchors = []
    for index, cue in zip(cue_indices, cues):
        matches = [entry for entry in timeline if entry['scene'] == index]
        start = matches[0]['start'] if len(matches) == 1 else None
        anchors.append({'scene': index, 'cue_start_seconds': cue['start'],
                        'scene_start_seconds': start, 'matches': start == cue['start']})
    checks = {
        'renderer_uses_imported_timeline': 'import {pictureSceneAtFrame} from "./episode1-picture-timeline.mjs";' in source
            and 'pictureSceneAtFrame(frame)' in source,
        'cuts_match_contract': cuts == contract['cuts'],
        'starts_at_zero': starts[0] == 0,
        'scene_count_matches': len(timeline) == contract['expected_scene_count'],
        'playback_scene_order_matches': order == contract['playback_scene_order'],
        'positive_scene_durations': all(x > 0 for x in durations),
        'source_scene_headlines_present_and_ordered': headlines_ok,
        'required_visual_tokens_present': all(tok in source for tok in contract['required_visual_tokens']),
        'narration_semantics_present_and_ordered': narration_ok,
        'narration_hash_matches': audio_sha == factual['narration_sha256'] == loaded['narration_sha256'],
        'caption_cue_scene_anchors_match': len(cue_indices) == len(cues) and all(x['matches'] for x in anchors),
        'no_fullscreen_slide_marker': all(x not in source.lower() for x in ['fullscreen slide','lecture slide','slide deck']),
        'finance_math_visible': '$80 − $20' in source and '$60' in source,
        'final_rule_visible': 'REAL VALUE > FEE' in source,
        'publication_disabled': contract.get('publication_enabled') is False and factual.get('publication_enabled') is False,
    }
    source_status = 'PASS' if all(checks.values()) else 'FAIL'
    budget = contract['max_scene_duration_seconds']
    violations = [{'scene': entry['scene'], 'beat': entry['beat'], 'start_frame': frames[i],
                   'end_frame': frames[i+1], 'duration_seconds': round(durations[i],6)}
                  for i,entry in enumerate(timeline) if durations[i] > budget + 1e-9]
    checks['max_scene_duration_ok'] = not violations
    return {
        'schema_version': 2, 'status': 'PASS' if all(checks.values()) else 'FAIL',
        'verified_at': datetime.now(timezone.utc).isoformat(),
        'source_sync_status': source_status, 'retention_status': 'FAIL' if violations else 'PASS',
        'scope': 'Source timeline and narration identity only; encoded-video synchronization and visual retention not verified',
        'scene_count': len(timeline), 'cuts_seconds': cuts, 'cut_frames': frames,
        'scene_durations_seconds': [round(x,6) for x in durations],
        'max_scene_duration_seconds': round(max(durations),6),
        'retention_budget_seconds': budget, 'retention_violations': violations,
        'checks': checks, 'scene_positions': positions, 'narration_positions': narration_positions,
        'caption_scene_anchors': anchors,
        'source_sha256': {str(p.relative_to(root)): sha(p) for p in [source_path,timeline_path,contract_path,factual_path,audio]},
        'failed_checks': [k for k,v in checks.items() if not v], 'publication_enabled': False,
    }


def main():
    try:
        report = verify()
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as exc:
        report = {'schema_version': 2, 'status': 'FAIL', 'source_sync_status': 'FAIL',
                  'retention_status': 'UNAVAILABLE', 'failed_checks': ['source_inputs_invalid'],
                  'error': str(exc), 'publication_enabled': False}
    Path('state/sync-retention-health.json').write_text(json.dumps(report,indent=2,sort_keys=True)+'\n')
    print(json.dumps(report,sort_keys=True))
    return 0 if report['status'] == 'PASS' else 2


if __name__ == '__main__':
    raise SystemExit(main())
