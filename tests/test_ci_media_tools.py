import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/ci_media_tools.sh'

class MediaToolsTests(unittest.TestCase):
    def run_fixture(self, present, install_exit=0):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            def executable(name, body):
                p = root / name
                p.write_text('#!/bin/bash\n' + body)
                p.chmod(0o755)
            executable('timeout', 'printf "%s\n" "$*" >> "$CALLS"\nwhile [[ "$1" == --* ]]; do shift; done\nshift\nexec "$@"\n')
            for name in ('ffmpeg', 'ffprobe'):
                executable(name, '[[ -f "$READY" ]]\n')
            executable('sudo', 'printf "%s\n" "$*" >> "$CALLS"\nif [[ "$*" == *install* ]]; then /usr/bin/touch "$READY"; fi\nexit ' + str(install_exit) + '\n')
            if present:
                (root / 'ready').touch()
            result = subprocess.run(['/bin/bash', str(SCRIPT)], env={**os.environ, 'PATH': str(root), 'READY': str(root / 'ready'), 'CALLS': str(root / 'calls')}, capture_output=True, text=True, timeout=5)
            return result, (root / 'calls').read_text()

    def test_verified_tools_skip_package_network(self):
        result, calls = self.run_fixture(True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn('apt-get', calls)
        self.assertIn('ffprobe -version', calls)

    def test_failed_update_stops_before_install(self):
        result, calls = self.run_fixture(False, 17)
        self.assertEqual(result.returncode, 17)
        self.assertNotIn(' install ', calls)
        self.assertIn('--kill-after=10s 180s sudo apt-get', calls)

    def test_fallback_installs_and_rechecks_both_tools(self):
        result, calls = self.run_fixture(False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('install -y -qq ffmpeg', calls)
        self.assertIn('ffprobe -version', calls)
