"""Opt-in real renderer/mux regression; tones are not narration or creative approval.

RUN_REMOTION_SMOKE=1 python3 -m unittest -v tests.test_v2_render_format
Requires installed Remotion browser dependencies and ffmpeg/ffprobe. Run offline.
"""
import array
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import wave

from scripts.v2_execution import ROOT, video_render_command, video_mux_command


@unittest.skipUnless(os.environ.get('RUN_REMOTION_SMOKE') == '1', 'Opt-in real Remotion render')
class RenderFormatTests(unittest.TestCase):
    def test_production_render_and_mux_preserve_mobile_format_and_tone_timing(self):
        with tempfile.TemporaryDirectory() as temporary:
            out = Path(os.environ.get('REMOTION_SMOKE_OUTPUT_DIR', temporary))
            out.mkdir(parents=True, exist_ok=True)
            props, raw, tone, final = [out / name for name in ('props.json', 'raw.mp4', 'tone.wav', 'final.mp4')]
            props.write_text(json.dumps({'ccsd': {'publication_enabled': False, 'scenes': [{
                'id': 'synthetic-only', 'start': 0, 'end': 3,
                'story': {'beat': 'SYNTHETIC A/V TEST'}, 'camera': {'move': 'punch_in'},
                'characters': [{'id': 'dave'}], 'props': [{'id': 'card'}]}]}}))
            samples = array.array('h')
            for i in range(3 * 48000):
                t = i / 48000
                value = int(10000 * math.sin(2 * math.pi * 440 * t)) if .5 <= t < 1 or 2 <= t < 2.5 else 0
                samples.extend((value, value))
            if sys.byteorder != 'little':
                samples.byteswap()
            with wave.open(str(tone), 'wb') as stream:
                stream.setparams((2, 2, 48000, 0, 'NONE', 'not compressed'))
                stream.writeframes(samples.tobytes())
            commands = [video_render_command('StudioAnimatic', raw, props, 1) + ['--bundle-cache=false'],
                        video_mux_command(raw, tone, final)]
            for index, args in enumerate(commands):
                with (out / f'stage-{index}.log').open('w') as log:
                    subprocess.run(args, cwd=ROOT, stdout=log, stderr=log, check=True, timeout=180)
            probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames',
                '-show_streams', '-show_format', '-of', 'json', str(final)], text=True))
            (out / 'probe.json').write_text(json.dumps(probe, indent=2))
            subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', final, '-f', 'null', '-'], check=True, timeout=30)
            decoded = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', final, '-map', '0:a:0',
                '-f', 's16le', '-ac', '1', '-ar', '48000', '-'], timeout=30)
            pcm = array.array('h'); pcm.frombytes(decoded)
            if sys.byteorder != 'little':
                pcm.byteswap()
            active = [i / 48000 for i in range(0, len(pcm)-479, 480)
                      if math.sqrt(sum(x*x for x in pcm[i:i+480])/480) > 1000]
            groups = []
            for t in active:
                if not groups or t - groups[-1][-1] > .015:
                    groups.append([])
                groups[-1].append(t)
            windows = [(g[0], g[-1]+.01) for g in groups]
            report = {'tone_windows_seconds': windows, 'creative_approval': False, 'publication_enabled': False,
                      'sha256': hashlib.sha256(final.read_bytes()).hexdigest()}
            (out / 'tone-timing.json').write_text(json.dumps(report, indent=2))
            self.assertEqual(len(windows), 2)
            for actual, expected in zip(windows, [(.5, 1), (2, 2.5)]):
                for observed, intended in zip(actual, expected):
                    self.assertAlmostEqual(observed, intended, delta=.03)
            video = next(s for s in probe['streams'] if s['codec_type'] == 'video')
            audio = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
            self.assertEqual((video['width'], video['height'], video['avg_frame_rate'], int(video['nb_read_frames'])), (720, 1280, '24/1', 72))
            self.assertEqual((audio['codec_name'], int(audio['sample_rate']), audio['channels']), ('aac', 48000, 2))
            self.assertAlmostEqual(float(video['duration']), 3, delta=.05)
            self.assertAlmostEqual(float(audio.get('start_time', 0)), 0, delta=.03)
            self.assertAlmostEqual(float(audio['duration']), 3, delta=.1)
            qa = subprocess.run([sys.executable, ROOT / 'scripts/free_mobile_compat_qa.py',
                '--video', final, '--output', out / 'mobile-qa.json'], capture_output=True, text=True)
            self.assertEqual(qa.returncode, 0, qa.stdout + qa.stderr)
            self.assertEqual(video['color_space'], 'bt709')
            self.assertEqual(video['color_range'], 'tv')
            self.assertEqual(video['color_primaries'], 'bt709')
            self.assertEqual(video['color_transfer'], 'bt709')
