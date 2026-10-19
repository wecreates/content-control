"""Shared validation for canonical captions and their local source provenance."""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import tempfile
try:
    from scripts.free_transcription_qa import norm
except ModuleNotFoundError:
    from free_transcription_qa import norm

MAX_JSON_BYTES = 2 * 1024 * 1024
MAX_AUDIO_BYTES = 128 * 1024 * 1024
TIMING_TOLERANCE = .05
CONTRACT = Path('state/episode1-factual-contract.json')
NARRATION = Path('public/audio/episode1-narration.mp3')
HEALTH = Path('state/content-control-health.json')


def snapshot(path, limit=MAX_JSON_BYTES):
    fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NONBLOCK', 0))
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or not 0 < info.st_size <= limit:
            raise ValueError('Input must be a bounded nonempty regular file')
        with os.fdopen(fd, 'rb') as stream:
            fd = None
            data = stream.read(limit + 1)
        if not data or len(data) > limit:
            raise ValueError('Input exceeds size bound')
        return data
    finally:
        if fd is not None:
            os.close(fd)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def object_from(data):
    try:
        value = json.loads(data)
    except RecursionError as exc:
        raise ValueError('JSON nesting exceeds parser limit') from exc
    if not isinstance(value, dict):
        raise ValueError('JSON object required')
    return value


def assert_destination(destination, inputs):
    target = Path(destination)
    for source in map(Path, inputs):
        if target.resolve() == source.resolve() or (target.exists() and source.exists() and target.samefile(source)):
            raise ValueError('Output would overwrite an input')


def write_atomic(path, text):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.caption-write-', dir=path.parent) as temporary:
        staged = Path(temporary) / 'output'
        staged.write_text(text, encoding='utf-8')
        os.replace(staged, path)


def spoken(text):
    if not isinstance(text, str) or not text.strip():
        raise ValueError('Nonempty caption/transcription text required')
    value = norm(text)
    if not value:
        raise ValueError('Text has no normalized speech')
    return value


def number(value, label):
    # Range comparison before float conversion also rejects huge JSON integers.
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= 600:
        raise ValueError('Invalid ' + label)
    return float(value)


def validated_cues(items, duration):
    if not isinstance(items, list) or not 1 <= len(items) <= 10000:
        raise ValueError('Nonempty bounded caption/segment list required')
    result, previous = [], 0
    for item in items:
        if not isinstance(item, dict):
            raise ValueError('Invalid caption/segment')
        start, end = number(item.get('start'), 'start'), number(item.get('end'), 'end')
        if start < previous - TIMING_TOLERANCE or end <= start or end > duration + .25:
            raise ValueError('Caption/segment timing is outside media bounds')
        if round(start * 1000) >= round(end * 1000):
            raise ValueError('Caption/segment disappears at VTT millisecond precision')
        spoken(item.get('text'))
        result.append({'start': start, 'end': end, 'text': ' '.join(item['text'].split())})
        previous = end
    return result


def validate_sources(contract, transcription, audio):
    if contract.get('publication_enabled') is not False or transcription.get('publication_enabled') is not False:
        raise ValueError('Publication must remain disabled')
    if transcription.get('status') != 'PASS':
        raise ValueError('Passing transcription required')
    digest = sha(audio)
    if transcription.get('audio_sha256') != digest or contract.get('narration_sha256') != digest:
        raise ValueError('Current narration hash must match transcription and approved contract')
    expected = spoken(contract.get('narration_text'))
    if spoken(transcription.get('expected_text')) != expected or spoken(transcription.get('actual_transcript')) != expected:
        raise ValueError('Transcription words differ from approved narration')
    duration = number(transcription.get('media_duration_seconds'), 'media duration')
    transcribed = number(transcription.get('transcribed_duration_seconds'), 'transcribed duration')
    if not duration or not transcribed or transcribed > duration + .25:
        raise ValueError('Invalid narration duration')
    cues = validated_cues(contract.get('caption_cues'), duration)
    segments = validated_cues(transcription.get('segments'), duration)
    if len(cues) != len(segments):
        raise ValueError('Caption count differs from observed transcription segments')
    if spoken(' '.join(cue['text'] for cue in cues)) != expected or spoken(' '.join(segment['text'] for segment in segments)) != expected:
        raise ValueError('Caption/segment words differ from approved narration')
    for cue, segment in zip(cues, segments):
        if spoken(cue['text']) != spoken(segment['text']):
            raise ValueError('Caption words differ from their observed segment')
        if any(abs(cue[key] - segment[key]) > TIMING_TOLERANCE + 1e-9 for key in ('start', 'end')):
            raise ValueError('Caption timing differs from its observed segment')
    if cues[0]['start'] > .5 or cues[-1]['end'] < transcribed - .25 or abs(segments[-1]['end'] - transcribed) > TIMING_TOLERANCE + 1e-9:
        raise ValueError('Captions do not cover the observed narration')
    return cues, digest


def timestamp(value):
    ms = round(value * 1000)
    hours, ms = divmod(ms, 3600000)
    minutes, ms = divmod(ms, 60000)
    seconds, ms = divmod(ms, 1000)
    return f'{hours:02d}:{minutes:02d}:{seconds:02d}.{ms:03d}'


def render_vtt(cues):
    lines = ['WEBVTT', '']
    for index, cue in enumerate(cues, 1):
        lines += [str(index), timestamp(cue['start']) + ' --> ' + timestamp(cue['end']), cue['text'], '']
    return '\n'.join(lines)


def parse_vtt(text):
    blocks = re.split(r'\n\s*\n', text.replace('\r\n', '\n').strip())
    if not blocks or blocks[0] != 'WEBVTT':
        raise ValueError('Invalid WEBVTT header')
    cues = []
    def seconds(value):
        hours, minutes, tail = value.split(':')
        whole, ms = tail.split('.')
        if int(minutes) >= 60 or int(whole) >= 60:
            raise ValueError('Invalid VTT timestamp')
        return int(hours) * 3600 + int(minutes) * 60 + int(whole) + int(ms) / 1000
    pattern = r'(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})'
    for index, block in enumerate(blocks[1:], 1):
        lines = block.splitlines()
        if len(lines) < 3 or lines[0] != str(index):
            raise ValueError('Invalid canonical VTT cue')
        match = re.fullmatch(pattern, lines[1])
        if not match:
            raise ValueError('Invalid canonical VTT timing')
        cues.append({'start': seconds(match[1]), 'end': seconds(match[2]), 'text': ' '.join(lines[2:])})
    return cues
