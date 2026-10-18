#!/usr/bin/env python3
"""Fail-closed canonical VTT text, timing and source-identity verification."""
import argparse
import json
from pathlib import Path
import re
import sys
try:
    from scripts.caption_contract import CONTRACT, NARRATION, HEALTH, MAX_AUDIO_BYTES, assert_destination, object_from, snapshot, sha, spoken, validate_sources, validated_cues, parse_vtt, write_atomic
except ModuleNotFoundError:
    from caption_contract import CONTRACT, NARRATION, HEALTH, MAX_AUDIO_BYTES, assert_destination, object_from, snapshot, sha, spoken, validate_sources, validated_cues, parse_vtt, write_atomic


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('vtt', nargs='?', default='public-review/episode1-v10-free.vtt')
    parser.add_argument('transcription', nargs='?', default='state/narration-transcription-health.json')
    parser.add_argument('output', nargs='?', default='state/caption-health.json')
    parser.add_argument('--upstream-failed', action='store_true')
    args = parser.parse_args()
    vtt, source, output = Path(args.vtt), Path(args.transcription), Path(args.output)
    report = {'schema_version': 1, 'status': 'FAIL', 'publication_enabled': False,
              'caption_path': str(vtt), 'checks': {}, 'failed_checks': []}
    # Never replace an input with the failure report itself.
    try:
        assert_destination(output, [vtt, source, CONTRACT, NARRATION, HEALTH])
    except (ValueError, OSError) as exc:
        report['reason'] = str(exc)
        print(json.dumps(report, sort_keys=True))
        return 2
    try:
        if args.upstream_failed:
            raise ValueError('Caption generation or upstream transcription failed')
        caption_bytes, transcription_bytes = snapshot(vtt), snapshot(source)
        contract_bytes = snapshot(CONTRACT)
        transcription, contract = object_from(transcription_bytes), object_from(contract_bytes)
        health = object_from(snapshot(HEALTH))
        approved, digest = validate_sources(contract, transcription, snapshot(NARRATION, MAX_AUDIO_BYTES))
        candidate = health.get('candidate_sha256')
        if health.get('status') != 'GREEN' or health.get('publication_enabled') is not False or not isinstance(candidate, str) or not re.fullmatch(r'[0-9a-f]{64}', candidate):
            raise ValueError('Current green candidate identity required')
        cues = validated_cues(parse_vtt(caption_bytes.decode('utf-8')), transcription['media_duration_seconds'])
        if len(cues) != len(approved):
            raise ValueError('VTT caption count differs from approved cues')
        for cue, expected in zip(cues, approved):
            if spoken(cue['text']) != spoken(expected['text']):
                raise ValueError('VTT words differ from approved narration')
            if any(round(cue[key] * 1000) != round(expected[key] * 1000) for key in ('start', 'end')):
                raise ValueError('VTT timing differs from approved observed cues')
        report.update(status='PASS', candidate_sha256=candidate, segment_count=len(cues),
                      caption_end_seconds=cues[-1]['end'], caption_sha256=sha(caption_bytes),
                      transcription_receipt_sha256=sha(transcription_bytes),
                      caption_contract_sha256=sha(contract_bytes), narration_sha256=digest,
                      checks={'source_identity_bound': True, 'approved_words_match': True,
                              'observed_timing_bound': True, 'candidate_health_green': True})
    except (ValueError, OSError, KeyError, TypeError, AttributeError, UnicodeError) as exc:
        report['reason'] = str(exc)
        report['checks']['caption_provenance_valid'] = False
        report['failed_checks'] = ['caption_provenance_valid']
    write_atomic(output, json.dumps(report, indent=2, sort_keys=True) + '\n')
    print(json.dumps(report, sort_keys=True))
    return 0 if report['status'] == 'PASS' else 2


if __name__ == '__main__':
    raise SystemExit(main())
