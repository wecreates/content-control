import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/ci_media_tools.sh'

class MediaToolsTests(unittest.TestCase):
    def run_fixture(self, present, update_exit=0, *, retry_exit=None, install_exit=0):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            def executable(name, body):
                p = root / name
                p.write_text('#!/bin/bash\n' + body)
                p.chmod(0o755)
            executable('timeout', 'printf "%s\n" "$*" >> "$CALLS"\nwhile [[ "$1" == --* ]]; do shift; done\nshift\nexec "$@"\n')
            for name in ('ffmpeg', 'ffprobe'):
                executable(name, '[[ -f "$READY" ]]\n')
            executable('sleep', 'printf "sleep %s\n" "$*" >> "$CALLS"\n')
            executable('sudo', 'printf "%s\n" "$*" >> "$CALLS"\n'
                       f'if [[ "$*" == *install* ]]; then /usr/bin/touch "$READY"; exit {install_exit}; fi\n'
                       f'if [[ -f "$READY.attempted" ]]; then exit {retry_exit if retry_exit is not None else update_exit}; fi\n'
                       f'/usr/bin/touch "$READY.attempted"\nexit {update_exit}\n')
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
        self.assertIn('--kill-after=3s 85s sudo apt-get', calls)
        self.assertNotIn('sleep', calls)

    def test_index_timeout_retries_once_and_then_verifies_tools(self):
        result, calls = self.run_fixture(False, 124, retry_exit=0)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls.count('--kill-after=3s 85s sudo apt-get'), 2)
        self.assertIn('sleep 3', calls)
        self.assertIn('retrying once', result.stderr)
        self.assertIn('ffprobe -version', calls)

    def test_second_index_timeout_and_install_failure_remain_distinct(self):
        result, calls = self.run_fixture(False, 124)
        self.assertEqual(result.returncode, 124)
        self.assertEqual(calls.count('sudo apt-get -o Acquire::Retries=1'), 2)
        self.assertNotIn(' install ', calls)
        self.assertIn('index refresh failed', result.stderr)
        result, calls = self.run_fixture(False, install_exit=124)
        self.assertEqual(result.returncode, 124)
        self.assertEqual(calls.count(' install '), 2)  # timeout and sudo fixture logs
        self.assertNotIn('sleep', calls)
        self.assertIn('package installation failed', result.stderr)

    def test_fallback_installs_and_rechecks_both_tools(self):
        result, calls = self.run_fixture(False)
        self.assertEqual(result.returncode, 0, result.stderr)
        install = next(line for line in calls.splitlines() if line.startswith('--kill-after=10s 180s '))
        self.assertIn('install -y -qq --no-install-recommends ffmpeg', install)
        for option in ('Acquire::Retries=1', 'Acquire::http::Timeout=30',
                       'Acquire::https::Timeout=30', 'Acquire::Languages=none', 'DPkg::Lock::Timeout=30'):
            self.assertIn(option, install)
        self.assertIn('ffprobe -version', calls)
