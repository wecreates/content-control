"""Captions must stay inside the dialogue windows used by the audio assembler."""
import copy
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
import tempfile
import unittest

from scripts.v2_captions import build_captions


class CaptionTimingIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.audio = Path(self.tmp.name) / 'audio.wav'
        self.audio.write_bytes(b'Local hash-only fixture; no ASR or providers are invoked.')
        self.ccsd = {'publication_enabled': False, 'fps': 24, 'scenes': [
            {'id': 'a', 'start': 0, 'end': 1,
             'audio': {'dialogue': [{'speaker': 'dave', 'text': 'Hello friend.'}]}},
            {'id': 'a-reaction', 'start': 1, 'end': 2},
            {'id': 'b', 'start': 2, 'end': 4,
             'audio': {'dialogue': [{'speaker': 'points_monk', 'text': 'Goodbye.'}]}},
        ]}
        self.report = {'publication_enabled': False, 'status': 'PASS', 'word_timestamps': True,
                       'audio_sha256': hashlib.sha256(self.audio.read_bytes()).hexdigest(),
                       'words': [{'word': 'Hello', 'start': .1, 'end': .6},
                                 {'word': 'friend.', 'start': 1.1, 'end': 1.7},
                                 {'word': 'Goodbye.', 'start': 2.1, 'end': 2.6}]}

    def tearDown(self):
        self.tmp.cleanup()

    def build(self):
        return build_captions(self.ccsd, self.report, self.audio)

    def test_dialogue_can_continue_across_its_nondialogue_subshot(self):
        before = copy.deepcopy(self.report)
        track = self.build()
        self.assertEqual(track['status'], 'PASS')
        self.assertEqual(self.report, before)
        self.assertEqual(track['cues'][1]['start'], 1.1)
        self.assertEqual(track['cues'][1]['end'], 1.7)

    def test_caption_cannot_arrive_before_its_speaker_window(self):
        self.report['words'][2].update(start=1.8, end=1.9)
        with self.assertRaisesRegex(ValueError, 'dialogue window'):
            self.build()

    def test_caption_cannot_extend_into_next_speaker_window(self):
        self.report['words'][1].update(start=1.8, end=2.05)
        with self.assertRaisesRegex(ValueError, 'dialogue window'):
            self.build()

    def test_all_observed_subwords_must_fit_even_when_final_subword_fits(self):
        self.ccsd['scenes'][2]['audio']['dialogue'][0]['text'] = 'autopay'
        self.report['words'][2:] = [{'word': 'auto', 'start': 1.8, 'end': 1.9},
                                    {'word': 'pay', 'start': 2.1, 'end': 2.6}]
        with self.assertRaisesRegex(ValueError, 'dialogue window'):
            self.build()

    def test_invalid_nondialogue_bounds_never_produce_pass(self):
        for mutation in ({'end': float('nan')}, {'start': -1}, {'start': True},
                         {'start': 3, 'end': 2}, {'end': '2'}, {'end': 10**400}):
            with self.subTest(mutation=mutation):
                saved = copy.deepcopy(self.ccsd)
                self.ccsd['scenes'][1].update(mutation)
                with self.assertRaises(ValueError):
                    self.build()
                self.ccsd = saved

    def test_cli_output_aliases_never_overwrite_source_inputs(self):
        root = Path(self.tmp.name)
        ccsd, transcript, output = root / 'ccsd.json', root / 'transcript.json', root / 'captions.json'
        ccsd.write_text(json.dumps(self.ccsd)); transcript.write_text(json.dumps(self.report))
        before = {path: path.read_bytes() for path in (ccsd, transcript, self.audio)}
        for source in before:
            for mode in ('same', 'symlink', 'hardlink'):
                with self.subTest(source=source.name, mode=mode):
                    if output.exists() or output.is_symlink():
                        output.unlink()
                    if mode == 'symlink':
                        output.symlink_to(source)
                    elif mode == 'hardlink':
                        os.link(source, output)
                    result = subprocess.run([sys.executable, 'scripts/v2_captions.py',
                                             '--ccsd', str(ccsd), '--transcription', str(transcript),
                                             '--audio', str(self.audio), '--out', str(source if mode == 'same' else output)],
                                            capture_output=True, text=True, timeout=3)
                    self.assertEqual(result.returncode, 2)
                    for path, data in before.items():
                        self.assertEqual(path.read_bytes(), data)

    def test_cli_fifo_inputs_replace_safe_stale_pass_without_hanging(self):
        root = Path(self.tmp.name)
        ccsd, transcript, output = root / 'ccsd.json', root / 'transcript.json', root / 'captions.json'
        ccsd.write_text(json.dumps(self.ccsd)); transcript.write_text(json.dumps(self.report))
        for source in (ccsd, transcript, self.audio):
            with self.subTest(source=source.name):
                original = source.read_bytes(); source.unlink(); os.mkfifo(source)
                output.write_text('{"status":"PASS"}')
                try:
                    result = subprocess.run([sys.executable, 'scripts/v2_captions.py',
                                             '--ccsd', str(ccsd), '--transcription', str(transcript),
                                             '--audio', str(self.audio), '--out', str(output)],
                                            capture_output=True, text=True, timeout=3)
                    self.assertEqual(result.returncode, 2)
                    self.assertEqual(json.loads(output.read_text())['status'], 'BLOCKED')
                finally:
                    source.unlink(); source.write_bytes(original)

    def test_cli_deep_json_replaces_safe_stale_pass(self):
        root = Path(self.tmp.name)
        ccsd, transcript, output = root / 'ccsd.json', root / 'transcript.json', root / 'captions.json'
        ccsd.write_text('{"nested":' + '[' * 50000 + '0' + ']' * 50000 + '}')
        transcript.write_text(json.dumps(self.report)); output.write_text('{"status":"PASS"}')
        result = subprocess.run([sys.executable, 'scripts/v2_captions.py',
                                 '--ccsd', str(ccsd), '--transcription', str(transcript),
                                 '--audio', str(self.audio), '--out', str(output)],
                                capture_output=True, text=True, timeout=3)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(json.loads(output.read_text())['status'], 'BLOCKED')

    def test_timeline_bound_prevents_unbounded_frame_audit(self):
        self.ccsd['scenes'][2]['end'] = 601
        with self.assertRaises(ValueError):
            self.build()


if __name__ == '__main__':
    unittest.main()
