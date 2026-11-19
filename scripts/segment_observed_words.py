"""Derive sentence cues from independent ASR word timestamps, never a script.

The source receipt remains unchanged. The output explicitly records this
segmentation derivation and binds its parent receipt and actual audio bytes.
"""
import argparse
import json
import re
from pathlib import Path
try:
    from scripts.caption_contract import (MAX_AUDIO_BYTES, assert_destination, number,
        object_from, sha, snapshot, spoken, validated_cues, write_atomic)
except ModuleNotFoundError:
    from caption_contract import (MAX_AUDIO_BYTES, assert_destination, number,
        object_from, sha, snapshot, spoken, validated_cues, write_atomic)


def derive(receipt_bytes, audio):
    receipt = object_from(receipt_bytes)
    if receipt.get('status') != 'PASS' or receipt.get('publication_enabled') is not False:
        raise ValueError('Publication-disabled passing ASR receipt required')
    if receipt.get('audio_sha256') != sha(audio):
        raise ValueError('Observed receipt does not identify actual audio')
    duration = number(receipt.get('media_duration_seconds'), 'media duration')
    end = number(receipt.get('transcribed_duration_seconds'), 'transcribed duration')
    if not duration or not end or end > duration + .25:
        raise ValueError('Invalid positive narration duration')
    observed = validated_cues(receipt.get('segments'), duration)
    if abs(observed[-1]['end'] - end) > .05 + 1e-9:
        raise ValueError('Source segments do not cover recognized duration')
    actual = spoken(receipt.get('actual_transcript'))
    if spoken(' '.join(s['text'] for s in observed)) != actual:
        raise ValueError('Source segments differ from recognized transcript')
    words = receipt.get('words')
    if not isinstance(words, list) or not 1 <= len(words) <= 10000:
        raise ValueError('Bounded observed word timestamps required')
    groups, group, previous = [], [], 0
    for word in words:
        if not isinstance(word, dict):
            raise ValueError('Invalid word record')
        start, stop = number(word.get('start'), 'word start'), number(word.get('end'), 'word end')
        if stop < start or start < previous - .05 or stop > duration + .25:
            raise ValueError('Invalid observed word timing')
        spoken(word.get('word'))
        group.append({'start': start, 'end': stop, 'text': word['word'].strip()})
        previous = stop
        if re.search(r'[.!?][\"\u201d\u2019]*$', word['word'].strip()):
            groups.append(group)
            group = []
    if group:
        groups.append(group)
    cues = [{'start': g[0]['start'], 'end': g[-1]['end'],
             'text': ' '.join(w['text'] for w in g)} for g in groups]
    cues = validated_cues(cues, duration)
    if spoken(' '.join(c['text'] for c in cues)) != actual:
        raise ValueError('Word timestamps differ from recognized transcript')
    if abs(cues[-1]['end'] - end) > .05 + 1e-9:
        raise ValueError('Word timestamps do not cover recognized duration')
    # The parsed receipt is private to this call. Only replace segments and add
    # metadata; recursive copying of unrelated JSON provides no isolation benefit.
    result = receipt
    result['segments'] = cues
    result['segmentation_derivation'] = {
        'method': 'observed_word_terminal_punctuation',
        'source_receipt_sha256': sha(receipt_bytes),
        'source_segment_count': len(observed),
        'derived_segment_count': len(cues),
        'script_used_for_alignment': False,
        'words_or_word_timestamps_changed': False,
        'review_required': True,
    }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--receipt', required=True)
    parser.add_argument('--audio', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--verify', action='store_true', help='Check existing derived output without writing')
    args = parser.parse_args()
    try:
        assert_destination(args.output, [args.receipt, args.audio])
        result = derive(snapshot(args.receipt), snapshot(args.audio, MAX_AUDIO_BYTES))
        if args.verify:
            if object_from(snapshot(args.output)) != result:
                raise ValueError('Existing transcription differs from retained raw observations')
        else:
            write_atomic(args.output, json.dumps(result, indent=2, sort_keys=True) + '\n')
    except (OSError, ValueError) as error:
        print(json.dumps({'status': 'BLOCKED', 'reason': str(error)}))
        return 2
    print(json.dumps(result['segmentation_derivation']))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
