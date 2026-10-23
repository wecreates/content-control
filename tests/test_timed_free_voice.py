"""Contract/audio-format tests use synthetic tones, never claimed as speech."""
import copy
import math
import json
from pathlib import Path
import shutil
import tempfile
import unittest
import wave
from unittest.mock import patch

from scripts.timed_free_voice import prepare_timeline, build
from scripts.v2_free_voice import VOICE_ASSIGNMENTS


def fixture():
    return {'publication_enabled': False, 'scenes': [
        {'id': 'narration', 'start': 0, 'end': 1, 'audio': {'dialogue': [
            {'speaker': 'narrator', 'text': 'Opening.'}]}},
        {'id': 'exchange', 'start': 1, 'end': 4, 'audio': {'dialogue': [
            {'speaker': 'dave', 'text': 'A question?', 'start': 1, 'end': 2.2},
            {'speaker': 'points_monk', 'text': 'A response.', 'start': 2.5, 'end': 3.8}]}},
        {'id': 'goblin', 'start': 4, 'end': 6, 'audio': {'dialogue': []},
         'visual': {'text_events': [{'type': 'nonverbal_text', 'character_id': 'cashback_goblin',
                    'text': 'Instant credit repair. Totally legitimate.', 'start': 4, 'end': 6}]}}
    ]}


class TimelineTests(unittest.TestCase):
    def test_explicit_turns_keep_speakers_text_timing_and_source_unchanged(self):
        source = fixture(); before = copy.deepcopy(source)
        result = prepare_timeline(source)
        self.assertEqual(source, before)
        self.assertTrue(result['speech_timeline_only'])
        self.assertEqual(result['source_duration_seconds'], 6)
        self.assertEqual([(s['start'], s['end']) for s in result['scenes']], [(0, 1), (1, 2.2), (2.5, 3.8)])
        self.assertEqual([s['source_scene_id'] for s in result['scenes']], ['narration', 'exchange', 'exchange'])
        self.assertEqual([s['source_dialogue_index'] for s in result['scenes']], [0, 0, 1])
        self.assertEqual([s['audio']['dialogue'][0]['speaker'] for s in result['scenes']], ['narrator', 'dave', 'points_monk'])
        self.assertEqual(source['scenes'][2]['visual']['text_events'][0]['text'], 'Instant credit repair. Totally legitimate.')

    def test_boss_fight_source_maps_only_approved_voices_and_keeps_exact_goblin_text(self):
        source = json.loads(Path('projects/shorts/credit-score-boss-fight/ccsd.json').read_text())
        prepared = prepare_timeline(source)
        self.assertEqual(len(prepared['scenes']), 18)
        self.assertEqual(prepared['source_duration_seconds'], 54)
        self.assertEqual({s['audio']['dialogue'][0]['speaker'] for s in prepared['scenes']}, set(VOICE_ASSIGNMENTS))
        goblin = next(s for s in source['scenes'] if s['id'] == 'goblin-offer')
        self.assertEqual(goblin['audio']['dialogue'], [])
        self.assertEqual(goblin['visual']['text_events'][0]['text'], 'Instant credit repair. Totally legitimate.')
        self.assertFalse(any(s['start'] < goblin['end'] and s['end'] > goblin['start'] for s in prepared['scenes']))

    def test_untimed_multi_turn_never_invents_speech_positions(self):
        source = fixture(); del source['scenes'][1]['audio']['dialogue'][0]['start']; del source['scenes'][1]['audio']['dialogue'][0]['end']
        with self.assertRaisesRegex(ValueError, 'explicit'): prepare_timeline(source)

    def test_overlap_outside_incomplete_boolean_and_nonfinite_windows_rejected(self):
        for change in [{'start': 2, 'end': 3}, {'start': 2.5, 'end': 5}, {'start': True}, {'end': float('nan')}, {'end': None}, {'end': 2.51}]:
            with self.subTest(change=change):
                source = fixture(); source['scenes'][1]['audio']['dialogue'][1].update(change)
                with self.assertRaises(ValueError): prepare_timeline(source)

    def test_unknown_or_nonverbal_speaker_rejected_before_model_initialization(self):
        for speaker in ['cashback_goblin', 'unknown']:
            source = fixture(); source['scenes'][0]['audio']['dialogue'][0]['speaker'] = speaker
            with tempfile.TemporaryDirectory() as directory, patch('scripts.timed_free_voice.local_synthesizer') as model:
                with self.assertRaisesRegex(ValueError, 'approved speaking voice'): build(source, Path(directory)/'new')
                model.assert_not_called()

    def test_scene_overlap_duplicate_and_publication_enable_rejected(self):
        for mutation in [lambda x: x.update(publication_enabled=True), lambda x: x['scenes'][1].update(start=.5), lambda x: x['scenes'][1].update(id='narration')]:
            source = fixture(); mutation(source)
            with self.assertRaises(ValueError): prepare_timeline(source)


@unittest.skipUnless(shutil.which('ffmpeg'), 'ffmpeg required')
class AudioIntegrationTests(unittest.TestCase):
    @staticmethod
    def tone(text, voice, speed):
        return [math.sin(i*.1)*.1 for i in range(6000)], 24000

    def test_real_pcm_assembly_retains_three_locked_voices_and_nonverbal_silence(self):
        calls = []
        def synth(text, voice, speed):
            calls.append((text, voice)); return self.tone(text, voice, speed)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)/'new'
            result = build(fixture(), root, synth)
            self.assertEqual([v for _, v in calls], ['am_adam', 'am_fenrir', 'am_michael'])
            self.assertEqual(len(calls), 3)
            self.assertEqual(result['voice_assignments'], VOICE_ASSIGNMENTS)
            self.assertEqual(result['status'], 'GENERATED_PENDING_LISTENING_REVIEW')
            self.assertFalse(result['publication_enabled']); self.assertFalse(result['production_approved']); self.assertFalse(result['full_av_review'])
            self.assertEqual(result['provider_calls'], 0)
            self.assertEqual([x['start'] for x in result['audio']['dialogue']], [0, 1, 2.5])
            with wave.open(str(root/'voice.wav'), 'rb') as audio:
                self.assertEqual((audio.getnchannels(), audio.getsampwidth(), audio.getframerate()), (2,2,44100))
                self.assertEqual(audio.getnframes(), 6*44100)
                audio.setpos(4*44100)
                self.assertEqual(set(audio.readframes(2*44100)), {0})

    def test_local_model_initialized_once_for_all_turns(self):
        with tempfile.TemporaryDirectory() as directory, patch('scripts.timed_free_voice.local_synthesizer', return_value=self.tone) as model:
            build(fixture(), Path(directory)/'new')
            model.assert_called_once_with()

    def test_overlong_turn_cannot_borrow_next_turn_gap(self):
        def too_long(*args): return [.1]*24000*2, 24000
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)/'new'
            with self.assertRaisesRegex(ValueError, 'cannot fit'): build(fixture(), root, too_long)
            self.assertFalse((root/'timed-voice.json').exists())
            self.assertFalse((root/'voice.wav').exists())

    def test_existing_output_is_preserved_without_synthesis(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root/'timed-voice.json').write_text('preserve')
            with patch('scripts.timed_free_voice.local_synthesizer') as model:
                with self.assertRaisesRegex(ValueError, 'new output'): build(fixture(), root)
                model.assert_not_called()
            self.assertEqual((root/'timed-voice.json').read_text(), 'preserve')


if __name__ == '__main__': unittest.main()
