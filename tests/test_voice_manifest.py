"""Exercise the current extraction and free voice-generation contracts together."""
import copy
import json
import math
from pathlib import Path
import shutil
import tempfile
import unittest

from scripts.ccsd_voice_manifest import build_manifest
from scripts.v2_free_voice import generate


class VoiceManifestTests(unittest.TestCase):
    def setUp(self):
        self.lock = json.loads((Path(__file__).resolve().parents[1] /
                                'control/voice-lock-v1.json').read_text())
        self.ccsd = {
            'publication_enabled': False,
            'scenes': [
                {'id': speaker, 'start': index, 'end': index + 1,
                 'audio': {'dialogue': [{'speaker': speaker, 'text': 'Hello.'}]}}
                for index, speaker in enumerate(['narrator', 'dave', 'points_monk'])
            ],
        }

    def test_extracts_speakers_without_claiming_provider_readiness(self):
        before = copy.deepcopy(self.ccsd)
        result = build_manifest(self.ccsd)
        self.assertEqual([s['speaker'] for s in result['segments']],
                         ['narrator', 'dave', 'points_monk'])
        self.assertFalse(result['publication_enabled'])
        self.assertNotIn('provider', result)
        self.assertEqual(self.ccsd, before)

    @unittest.skipUnless(shutil.which('ffmpeg'), 'ffmpeg required for PCM conversion')
    def test_maps_speakers_to_locked_free_provider_and_voice_ids(self):
        calls = []

        def synth(text, voice, speed):
            calls.append(voice)
            return [math.sin(i * .1) * .1 for i in range(2400)], 24000

        with tempfile.TemporaryDirectory() as out:
            result = generate(self.ccsd, out, synth=synth)
        self.assertEqual(result['provider'], 'kokoro')
        self.assertEqual(result['model_id'], 'Kokoro-82M')
        self.assertEqual(result['provider_calls'], 0)
        self.assertFalse(result['publication_enabled'])
        self.assertEqual(result['status'], 'GENERATED_PENDING_LISTENING_REVIEW')
        for clip in result['clips']:
            role = (self.lock['narrator'] if clip['speaker'] == 'narrator'
                    else self.lock['characters'][clip['speaker']])
            self.assertEqual(clip['voice_id'], role['voice_id'])
            self.assertEqual(result['provider'], role['provider'])
            self.assertEqual(result['model_id'], role['model_id'])
        self.assertEqual(calls, [clip['voice_id'] for clip in result['clips']])
        self.assertEqual(len(set(calls)), 3)

    def test_unknown_and_nonverbal_speakers_fail_before_synthesis(self):
        for speaker in ['unknown', 'cashback_goblin']:
            with self.subTest(speaker=speaker), tempfile.TemporaryDirectory() as out:
                ccsd = copy.deepcopy(self.ccsd)
                ccsd['scenes'][0]['audio']['dialogue'][0]['speaker'] = speaker
                with self.assertRaisesRegex(ValueError, 'approved free voice assignment'):
                    generate(ccsd, out, synth=lambda *args: self.fail('Synthesis called'))
                self.assertFalse((Path(out) / 'approved-manifest.json').exists())


if __name__ == '__main__':
    unittest.main()
