"""Offline plan and real FFmpeg regressions; no external footage is used."""
import copy
import os
import sys
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

from scripts.assemble_render_shards import assemble, concat_line, shard_plan


def plan():
    # Deliberately reverse alphabetical IDs: manifest order is authoritative.
    return {'publication_enabled': False, 'shards': [
        {'id': 'z-first', 'start': 0, 'end': 1},
        {'id': 'a-second', 'start': 1, 'end': 2},
    ]}


class ShardPlanTests(unittest.TestCase):
    def test_partial_frame_boundaries_have_no_duplicate_or_missing_frames(self):
        rows = shard_plan({'publication_enabled': False, 'shards': [
            {'id': 'first', 'start': 0, 'end': .1},
            {'id': 'second', 'start': .1, 'end': 1},
        ]})
        self.assertEqual([(row['first_frame'], row['last_frame']) for row in rows], [(0, 2), (3, 23)])
        self.assertEqual(sum(row['frame_count'] for row in rows), 24)

    def test_duplicate_missing_gap_overlap_and_unsafe_ids_rejected(self):
        cases = []
        for mutation in ({'id': 'z-first'}, {'id': '../other'}, {'id': "x'\nfile evil"},
                         {'start': 1.1}, {'start': .9}, {'end': float('nan')},
                         {'start': True}, {'start': '1'}, {'end': 10**400}):
            manifest = plan()
            manifest['shards'][1].update(mutation)
            cases.append(manifest)
        cases += [None, [], {'publication_enabled': False, 'shards': []},
                  dict(plan(), publication_enabled=True)]
        for manifest in cases:
            with self.subTest(manifest=manifest), self.assertRaises(ValueError):
                shard_plan(manifest)

    def test_newline_in_concat_path_rejected(self):
        with self.assertRaises(ValueError):
            concat_line(Path('scene\nfile injected.mp4'))

    def test_workflow_uses_pinned_plan_and_checked_assembler(self):
        text = Path('.github/workflows/shot-render-farm.yml').read_text()
        self.assertIn("  plan:\n    if: ${{ github.ref == 'refs/heads/main' }}", text)
        self.assertIn("needs.plan.result == 'success' && fromJson", text)
        self.assertIn('test "$GITHUB_REF" = refs/heads/main', text)
        self.assertIn('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"', text)
        self.assertIn('rows=shard_plan(r)', text)
        self.assertIn('START="${{ matrix.first_frame }}"', text)
        self.assertIn('python scripts/assemble_render_shards.py', text)
        self.assertEqual(text.count('ref: "${{ github.sha }}"'), 3)
        self.assertNotIn("find qa-output/render-farm/shards -name", text)


@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'ffmpeg/ffprobe required')
class ShardAssemblyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="shard's space ")
        self.root = Path(self.tmp.name)
        self.shards = self.root / 'shards'
        self.shards.mkdir()
        self.output = self.root / 'out' / 'assembled.mp4'
        self.manifest = plan()
        self.make('z-first', 'red')
        self.make('a-second', 'blue')

    def tearDown(self):
        self.tmp.cleanup()

    def make(self, name, color, frames=24, size='16x16'):
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y',
                        '-f', 'lavfi', '-i', f'color={color}:s={size}:r=24',
                        '-frames:v', str(frames), '-an', '-c:v', 'libx264',
                        '-threads', '1', '-pix_fmt', 'yuv420p', str(self.shards / (name + '.mp4'))],
                       capture_output=True, check=True, timeout=30)

    def test_relative_legacy_concat_repro_and_fixed_order_with_quoted_paths(self):
        # The original workflow creates this list outside the shard directory.
        legacy = self.root / 'legacy.txt'
        legacy.write_text("file 'qa-output/render-farm/shards/z-first.mp4'\n")
        broken = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y',
                                 '-f', 'concat', '-safe', '0', '-i', str(legacy),
                                 '-c', 'copy', str(self.root / 'legacy.mp4')],
                                capture_output=True, text=True, timeout=30)
        self.assertNotEqual(broken.returncode, 0)
        self.assertIn('Impossible to open', broken.stderr)
        report = assemble(self.manifest, self.shards, self.output)
        self.assertEqual(report['status'], 'PASS')
        self.assertEqual(report['shard_ids'], ['z-first', 'a-second'])
        self.assertEqual(report['frame_count'], 48)
        for frame, channel in ((0, 0), (24, 2)):
            rgb = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(self.output),
                                  '-vf', f'select=eq(n\\,{frame})', '-frames:v', '1',
                                  '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-threads', '1', '-'],
                                 capture_output=True, check=True, timeout=30).stdout
            self.assertGreater(rgb[channel], 200)
            self.assertLess(rgb[2 if channel == 0 else 0], 30)

    def test_missing_extra_duplicate_and_symlinked_shards_cannot_pass(self):
        second = self.shards / 'a-second.mp4'
        original = second.read_bytes()
        second.unlink()
        with self.assertRaisesRegex(ValueError, 'Missing'):
            assemble(self.manifest, self.shards, self.output)
        second.write_bytes(original)
        extra = self.shards / 'extra.mp4'
        extra.write_bytes(original)
        with self.assertRaisesRegex(ValueError, 'unexpected'):
            assemble(self.manifest, self.shards, self.output)
        extra.unlink()
        second.unlink()
        second.symlink_to(self.shards / 'z-first.mp4')
        with self.assertRaisesRegex(ValueError, 'regular'):
            assemble(self.manifest, self.shards, self.output)
        self.assertFalse(self.output.exists())

    def test_bad_shard_count_and_format_preserve_existing_output(self):
        self.output.parent.mkdir()
        self.output.write_bytes(b'existing accepted artifact')
        for frames, size, reason in ((23, '16x16', 'count'), (24, '32x32', 'formats')):
            self.make('a-second', 'blue', frames, size)
            with self.assertRaisesRegex(ValueError, reason):
                assemble(self.manifest, self.shards, self.output)
            self.assertEqual(self.output.read_bytes(), b'existing accepted artifact')

    def test_cli_receipt_aliases_cannot_replace_video_or_inputs(self):
        manifest = self.root / 'manifest.json'
        manifest.write_text(json.dumps(self.manifest))
        self.output.parent.mkdir()
        self.output.write_bytes(b'existing output')
        receipt = self.root / 'receipt.json'
        targets = [manifest, self.output, self.shards / 'z-first.mp4']
        before = {path: path.read_bytes() for path in targets}
        for target in targets:
            for mode in ('same', 'symlink', 'hardlink'):
                with self.subTest(target=target.name, mode=mode):
                    if receipt.exists() or receipt.is_symlink():
                        receipt.unlink()
                    if mode == 'symlink':
                        receipt.symlink_to(target)
                    elif mode == 'hardlink':
                        os.link(target, receipt)
                    result = subprocess.run([sys.executable, 'scripts/assemble_render_shards.py',
                                             '--manifest', str(manifest), '--shard-dir', str(self.shards),
                                             '--out', str(self.output), '--receipt', str(target if mode == 'same' else receipt)],
                                            capture_output=True, text=True, timeout=3)
                    self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
                    self.assertEqual(json.loads(result.stdout)['status'], 'BLOCKED')
                    for source, data in before.items():
                        self.assertEqual(source.read_bytes(), data)

    def test_cli_deep_manifest_replaces_safe_stale_pass(self):
        manifest, receipt = self.root / 'manifest.json', self.root / 'receipt.json'
        manifest.write_text('{"nested":' + '[' * 50000 + '0' + ']' * 50000 + '}')
        receipt.write_text('{"status":"PASS"}')
        result = subprocess.run([sys.executable, 'scripts/assemble_render_shards.py',
                                 '--manifest', str(manifest), '--shard-dir', str(self.shards),
                                 '--out', str(self.output), '--receipt', str(receipt)],
                                capture_output=True, text=True, timeout=3)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(json.loads(receipt.read_text())['status'], 'BLOCKED')
        self.assertFalse(self.output.exists())

    def test_cli_fifo_symlink_and_oversized_manifest_fail_promptly(self):
        manifest, receipt = self.root / 'manifest.json', self.root / 'receipt.json'
        fifo = self.root / 'manifest-pipe'
        for kind in ('fifo', 'symlink-fifo', 'oversized'):
            with self.subTest(kind=kind):
                if manifest.exists() or manifest.is_symlink():
                    manifest.unlink()
                if kind == 'fifo':
                    os.mkfifo(manifest)
                elif kind == 'symlink-fifo':
                    os.mkfifo(fifo); manifest.symlink_to(fifo)
                else:
                    manifest.write_bytes(b' ' * (2 * 1024 * 1024 + 1))
                receipt.write_text('{"status":"PASS"}')
                result = subprocess.run([sys.executable, 'scripts/assemble_render_shards.py',
                                         '--manifest', str(manifest), '--shard-dir', str(self.shards),
                                         '--out', str(self.output), '--receipt', str(receipt)],
                                        capture_output=True, text=True, timeout=3)
                self.assertEqual(result.returncode, 2)
                self.assertEqual(json.loads(receipt.read_text())['status'], 'BLOCKED')
                self.assertFalse(self.output.exists())

    def test_output_alias_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'overwrite'):
            assemble(self.manifest, self.shards, self.shards / 'z-first.mp4')


if __name__ == '__main__':
    unittest.main()
