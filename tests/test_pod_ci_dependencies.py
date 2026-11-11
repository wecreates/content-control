"""Offline dependency-gate regressions: never invokes a real package manager."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]


class DependencyGateTests(unittest.TestCase):
    def run_gate(self, mode):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            log = root / 'calls'
            # Keep production's immutable deadline, but scale it only in this
            # offline executable fixture so stalled-child tests finish quickly.
            timeout = shutil.which('timeout')
            self.assertIsNotNone(timeout)
            (root / 'timeout').write_text(
                '#!/bin/bash\n'
                'test "$1" = --signal=TERM && test "$2" = --kill-after=5s && test "$3" = 120s || exit 97\n'
                'shift 3\nexec ' + timeout + ' --signal=TERM --kill-after=1s 0.15s "$@"\n')
            (root / 'sudo').write_text('#!/bin/bash\nexec "$@"\n')
            (root / 'apt-get').write_text(
                '#!/bin/bash\n'
                'echo "$*" >> "$TEST_LOG"\n'
                'if [[ "$TEST_MODE" == "$1-fail" ]]; then exit 100; fi\n'
                'if [[ "$TEST_MODE" == "$1-stall" ]]; then sleep 10; fi\n')
            for name in ('timeout', 'sudo', 'apt-get'):
                (root / name).chmod(0o700)
            started = time.monotonic()
            result = subprocess.run(['bash', str(ROOT / 'scripts/pod_ci_dependencies.sh')],
                env={**os.environ, 'PATH': str(root) + ':' + os.defpath,
                     'TEST_MODE': mode, 'TEST_LOG': str(log)},
                capture_output=True, text=True, timeout=3)
            self.assertLess(time.monotonic() - started, 2)
            return result.returncode, log.read_text().splitlines() if log.exists() else []

    def test_success_keeps_all_required_packages(self):
        self.assertEqual(self.run_gate('success'),
                         (0, ['update', 'install -y tesseract-ocr fonts-dejavu-core']))

    def test_update_failure_stops_installation(self):
        self.assertEqual(self.run_gate('update-fail'), (100, ['update']))

    def test_install_failure_is_not_ignored(self):
        self.assertEqual(self.run_gate('install-fail'),
                         (100, ['update', 'install -y tesseract-ocr fonts-dejavu-core']))

    def test_stalled_update_expires_without_installation(self):
        self.assertEqual(self.run_gate('update-stall'), (124, ['update']))

    def test_stalled_installation_expires(self):
        self.assertEqual(self.run_gate('install-stall'),
                         (124, ['update', 'install -y tesseract-ocr fonts-dejavu-core']))

    def test_workflow_uses_gate_without_failure_bypass(self):
        workflow = (ROOT / '.github/workflows/pod-integration.yml').read_text()
        self.assertIn('- run: bash scripts/pod_ci_dependencies.sh', workflow)
        self.assertNotIn('continue-on-error:', workflow)
        self.assertNotIn('sudo apt-get update &&', workflow)


if __name__ == '__main__':
    unittest.main()
