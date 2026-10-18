#!/usr/bin/env python3
"""Build canonical VTT only from current, approved, observed narration evidence."""
import json
from pathlib import Path
import sys
try:
    from scripts.caption_contract import CONTRACT, NARRATION, HEALTH, MAX_AUDIO_BYTES, assert_destination, object_from, snapshot, validate_sources, render_vtt, write_atomic
except ModuleNotFoundError:
    from caption_contract import CONTRACT, NARRATION, HEALTH, MAX_AUDIO_BYTES, assert_destination, object_from, snapshot, validate_sources, render_vtt, write_atomic


def main():
    source = Path(sys.argv[1] if len(sys.argv) > 1 else 'state/narration-transcription-health.json')
    output = Path(sys.argv[2] if len(sys.argv) > 2 else 'public-review/episode1-v10-free.vtt')
    try:
        assert_destination(output, [source, CONTRACT, NARRATION, HEALTH])
        transcription = object_from(snapshot(source))
        contract = object_from(snapshot(CONTRACT))
        cues, _ = validate_sources(contract, transcription, snapshot(NARRATION, MAX_AUDIO_BYTES))
        write_atomic(output, render_vtt(cues))
    except (ValueError, OSError, KeyError, TypeError, AttributeError) as exc:
        print(json.dumps({'status': 'BLOCKED', 'reason': str(exc), 'publication_enabled': False}))
        return 2
    print(json.dumps({'status': 'PASS', 'segments': len(cues), 'end_seconds': cues[-1]['end'], 'output': str(output)}, sort_keys=True))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
