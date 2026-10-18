"""Offline regressions for approved-clip assembly integrity."""
import copy
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
import wave

from scripts.v2_audio_assemble import assemble, sha


class AudioIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.clip = self.root / 'voice.wav'
        self.output = self.root / 'assembled.wav'
        self.ccsd = {'publication_enabled': False, 'scenes': [
            {'id': 'speech', 'start': 0, 'end': 1,
             'audio': {'dialogue': [{'speaker': 'dave', 'text': 'Hello'}]}},
            {'id': 'reaction', 'start': 1, 'end': 2},
        ]}
        with wave.open(str(self.clip), 'wb') as stream:
            stream.setparams((2, 2, 44100, 0, 'NONE', 'not compressed'))
            stream.writeframes(struct.pack('<hh', 1000, -1000) * 22050)
        self.manifest = {'publication_enabled': False, 'provider': 'kokoro',
                         'model_id': 'Kokoro-82M', 'voice_assignments': {'dave': 'am_fenrir'},
                         'clips': [{'scene_id': 'speech', 'speaker': 'dave',
                                    'voice_id': 'am_fenrir', 'file': self.clip.name,
                                    'text_sha256': hashlib.sha256(b'Hello').hexdigest(),
                                    'audio_sha256': sha(self.clip)}]}

    def tearDown(self):
        self.tmp.cleanup()

    def run_assembly(self):
        return assemble(self.ccsd, self.manifest, self.root, self.output)

    def test_truncated_pcm_cannot_report_the_header_duration(self):
        self.clip.write_bytes(self.clip.read_bytes()[:44 + 400])
        self.manifest['clips'][0]['audio_sha256'] = sha(self.clip)
        self.output.write_bytes(b'existing good artifact')
        with self.assertRaisesRegex(ValueError, 'Truncated'):
            self.run_assembly()
        self.assertEqual(self.output.read_bytes(), b'existing good artifact')

    def test_partial_pcm_frame_rejected_cleanly(self):
        self.clip.write_bytes(self.clip.read_bytes()[:-1])
        self.manifest['clips'][0]['audio_sha256'] = sha(self.clip)
        with self.assertRaisesRegex(ValueError, 'Truncated'):
            self.run_assembly()

    def test_output_cannot_alias_a_source_by_name_symlink_or_hardlink(self):
        original = self.clip.read_bytes()
        for kind in ('same', 'symlink', 'hardlink'):
            with self.subTest(kind=kind):
                if self.output.exists() or self.output.is_symlink():
                    self.output.unlink()
                self.clip.write_bytes(original)
                target = self.clip if kind == 'same' else self.output
                if kind == 'symlink':
                    target.symlink_to(self.clip)
                elif kind == 'hardlink':
                    os.link(self.clip, target)
                with self.assertRaisesRegex(ValueError, 'overwrite'):
                    assemble(self.ccsd, self.manifest, self.root, target)
                self.assertEqual(self.clip.read_bytes(), original)

    def test_nondialogue_scene_bounds_are_validated(self):
        for mutation in ({'end': float('nan')}, {'start': -1},
                         {'start': 2, 'end': 1}, {'start': True}, {'end': '2'}, {'end': 10**400}):
            with self.subTest(mutation=mutation):
                ccsd = copy.deepcopy(self.ccsd)
                ccsd['scenes'][1].update(mutation)
                with self.assertRaises(ValueError):
                    assemble(ccsd, self.manifest, self.root, self.output)

    def test_one_sample_overflow_never_extends_output(self):
        self.ccsd['scenes'] = [self.ccsd['scenes'][0]]
        self.ccsd['scenes'][0]['start'] = 0.50002
        with self.assertRaisesRegex(ValueError, 'overlaps|exceeds'):
            self.run_assembly()
        self.assertFalse(self.output.exists())

    def test_success_receipt_describes_decoded_snapshot(self):
        original = self.clip.read_bytes()
        report = self.run_assembly()
        self.assertEqual(self.clip.read_bytes(), original)
        self.assertEqual(report['dialogue'][0]['audio_sha256'], hashlib.sha256(original).hexdigest())
        with wave.open(str(self.output), 'rb') as stream:
            self.assertEqual(stream.getnframes(), 88200)
        self.assertEqual(report['audio_sha256'], sha(self.output))

    def test_cli_destinations_never_overwrite_inputs_or_output(self):
        ccsd = self.root / 'ccsd.json'
        manifest = self.root / 'manifest.json'
        ccsd.write_text(json.dumps(self.ccsd))
        manifest.write_text(json.dumps(self.manifest))
        self.output.write_bytes(b'existing output')
        receipt = self.root / 'receipt.json'
        def command(output, target):
            return subprocess.run([sys.executable, 'scripts/v2_audio_assemble.py',
                                   '--ccsd', str(ccsd), '--manifest', str(manifest),
                                   '--out', str(output), '--receipt', str(target)],
                                  capture_output=True, text=True, timeout=3)
        sources = [ccsd, manifest, self.clip, self.output]
        before = {path: path.read_bytes() for path in sources}
        for target in sources:
            for mode in ('same', 'symlink', 'hardlink'):
                with self.subTest(target=target.name, mode=mode):
                    if receipt.exists() or receipt.is_symlink():
                        receipt.unlink()
                    if mode == 'symlink':
                        receipt.symlink_to(target)
                    elif mode == 'hardlink':
                        os.link(target, receipt)
                    result = command(self.output, target if mode == 'same' else receipt)
                    self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
                    self.assertEqual(json.loads(result.stdout)['status'], 'BLOCKED')
                    for source, data in before.items():
                        self.assertEqual(source.read_bytes(), data)
        if receipt.exists() or receipt.is_symlink():
            receipt.unlink()
        for target in (ccsd, manifest, self.clip):
            result = command(target, receipt)
            self.assertEqual(result.returncode, 2)
            self.assertFalse(receipt.exists())
            self.assertEqual(target.read_bytes(), before[target])

    def test_missing_or_malformed_manifest_replaces_stale_pass_receipt(self):
        ccsd = self.root / 'ccsd.json'
        manifest = self.root / 'manifest.json'
        receipt = self.root / 'receipt.json'
        ccsd.write_text(json.dumps(self.ccsd))
        for content in (None, '{broken', '[]', '{"nested":' + '[' * 50000 + '0' + ']' * 50000 + '}'):
            with self.subTest(length=len(content) if content is not None else None):
                if manifest.exists():
                    manifest.unlink()
                if content is not None:
                    manifest.write_text(content)
                receipt.write_text('{"status":"PASS"}')
                result = subprocess.run([sys.executable, 'scripts/v2_audio_assemble.py',
                                         '--ccsd', str(ccsd), '--manifest', str(manifest),
                                         '--out', str(self.output), '--receipt', str(receipt)],
                                        capture_output=True, text=True, timeout=3)
                self.assertEqual(result.returncode, 2)
                self.assertEqual(json.loads(receipt.read_text())['status'], 'BLOCKED')
                self.assertFalse(self.output.exists())

    def test_fifo_source_does_not_hang_cli(self):
        self.clip.unlink()
        os.mkfifo(self.clip)
        (self.root / 'ccsd.json').write_text(json.dumps(self.ccsd))
        (self.root / 'manifest.json').write_text(json.dumps(self.manifest))
        receipt = self.root / 'receipt.json'
        process = subprocess.run([sys.executable, 'scripts/v2_audio_assemble.py',
                                  '--ccsd', str(self.root / 'ccsd.json'),
                                  '--manifest', str(self.root / 'manifest.json'),
                                  '--out', str(self.output), '--receipt', str(receipt)],
                                 capture_output=True, text=True, timeout=3)
        self.assertEqual(process.returncode, 2)
        self.assertEqual(json.loads(receipt.read_text())['status'], 'BLOCKED')
        self.assertFalse(self.output.exists())


if __name__ == '__main__':
    unittest.main()
