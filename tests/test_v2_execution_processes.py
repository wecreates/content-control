"""Real local process-tree tests. No models, network, renderers, or providers."""
import contextlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from scripts import v2_execution


@unittest.skipUnless(os.name == 'posix', 'production executor requires POSIX')
class ProcessCleanupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.marker = self.root / 'late-output'
        self.ready = self.root / 'ready.json'
        self.work = self.root / 'job'
        scripts = self.root / 'scripts';scripts.mkdir()
        (self.root / 'control').mkdir()
        for name in ('free-voice-policy.json', 'audio-sync-policy.json'):
            (self.root / 'control' / name).write_text('{}')
        self.ccsd = self.root / 'ccsd.json'
        self.ccsd.write_text(json.dumps({'publication_enabled': False,
                                        'scenes': [{'id': 'a', 'start': 0, 'end': 1}]}))
        child = ('import signal,time;from pathlib import Path;'
                 'signal.signal(signal.SIGTERM,signal.SIG_IGN);'
                 'time.sleep(.9);Path(' + repr(str(self.marker)) + ').write_text("late output")')
        self.producer = scripts / 'v2_free_voice.py'
        self.producer.write_text(
            'import json,os,subprocess,sys,time\nfrom pathlib import Path\n'
            'child=subprocess.Popen([sys.executable,"-c",' + repr(child) + '])\n'
            'Path(' + repr(str(self.ready)) + ').write_text(json.dumps({"parent":os.getpid(),"child":child.pid}))\n'
            'time.sleep(5)\n')
        self.addCleanup(self.cleanup_owned_processes)

    def cleanup_owned_processes(self):
        if self.ready.exists():
            ids = json.loads(self.ready.read_text())
            with contextlib.suppress(ProcessLookupError):
                os.killpg(ids['parent'], signal.SIGKILL)
            with contextlib.suppress(ProcessLookupError):
                os.kill(ids['child'], signal.SIGKILL)

    def await_ready(self, process):
        deadline = time.monotonic() + 3
        while not self.ready.exists() and time.monotonic() < deadline:
            if process.poll() is not None:
                self.fail('Fixture exited before launching its child')
            time.sleep(.01)
        self.assertTrue(self.ready.exists(), 'Fixture did not launch its child')
        # Give the child time to install its TERM handler before cancelling.
        time.sleep(.08)

    def test_timeout_kills_term_ignoring_descendant_before_retry(self):
        with (self.root / 'command.log').open('w') as log:
            started = time.monotonic()
            with self.assertRaises(subprocess.TimeoutExpired):
                v2_execution.run_process([sys.executable, str(self.producer)], cwd=self.root,
                                         stdout=log, stderr=log, timeout=.2)
            self.assertLess(time.monotonic() - started, 3)
        time.sleep(.5)
        self.assertFalse(self.marker.exists(), 'Timed-out stage kept writing after cleanup')
        with (self.root / 'retry.log').open('w') as log:
            result = v2_execution.run_process([sys.executable, '-c', 'print("retry")'],
                                             cwd=self.root, stdout=log, stderr=log, timeout=2)
        self.assertEqual(result.returncode, 0)

    def test_cli_cancellation_stops_children_before_job_lock_release(self):
        shutil.copyfile(v2_execution.__file__, self.root / 'scripts/v2_execution.py')
        for signum, repeat in ((signal.SIGINT, False), (signal.SIGTERM, False), (signal.SIGHUP, False), (signal.SIGINT, True)):
            with self.subTest(signal=signum, repeat=repeat):
                self.ready.unlink(missing_ok=True);self.marker.unlink(missing_ok=True)
                cli = subprocess.Popen([sys.executable, str(self.root / 'scripts/v2_execution.py'),
                                        '--ccsd', str(self.ccsd), '--workdir', str(self.work)],
                                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                try:
                    self.await_ready(cli)
                    cli.send_signal(signum)
                    if repeat:
                        time.sleep(.1)
                        cli.send_signal(signal.SIGTERM)
                    stdout, stderr = cli.communicate(timeout=4)
                    self.assertEqual(cli.returncode, 2, (stdout, stderr))
                    state = json.loads((self.work / 'execution.json').read_text())
                    self.assertEqual(state['status'], 'BLOCKED')
                    self.assertEqual(state['stages']['voice']['status'], 'FAILED')
                    with v2_execution.job_lock(self.work):
                        time.sleep(.5)
                        self.assertFalse(self.marker.exists(), 'Cancelled stage wrote after lock release')
                finally:
                    self.cleanup_owned_processes()
                    if cli.poll() is None:
                        cli.kill();cli.wait(timeout=3)

    def test_nonzero_exit_stops_children_before_returning_for_retry(self):
        self.producer.write_text(self.producer.read_text().replace('time.sleep(5)', 'time.sleep(.2);raise SystemExit(7)'))
        with (self.root / 'command.log').open('w') as log:
            result = v2_execution.run_process([sys.executable, str(self.producer)], cwd=self.root,
                                             stdout=log, stderr=log, timeout=2)
        self.assertEqual(result.returncode, 7)
        time.sleep(.5)
        self.assertFalse(self.marker.exists(), 'Failed stage left a child writing during retry')

    def test_cancellation_during_launch_still_cleans_up_owned_child(self):
        from unittest.mock import patch
        original = subprocess.Popen
        def interrupted_launch(*args, **kwargs):
            process = original(*args, **kwargs)
            self.await_ready(process)
            os.kill(os.getpid(), signal.SIGINT)
            return process
        with (self.root / 'command.log').open('w') as log, \
             v2_execution.cancellation_signals(), \
             patch.object(v2_execution.subprocess, 'Popen', side_effect=interrupted_launch):
            with self.assertRaises(InterruptedError):
                v2_execution.run_process([sys.executable, str(self.producer)], cwd=self.root,
                                         stdout=log, stderr=log, timeout=2)
        time.sleep(.5)
        self.assertFalse(self.marker.exists(), 'Launch-time cancellation leaked an owned child')

    def test_launch_preserves_child_signal_mask_and_restores_handlers(self):
        expected = sorted(int(value) for value in signal.pthread_sigmask(signal.SIG_BLOCK, []))
        handlers = {value: signal.getsignal(value) for value in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP)}
        target = self.root / 'signal-mask.json'
        code = ('import json,signal;from pathlib import Path;Path(' + repr(str(target)) +
                ').write_text(json.dumps(sorted(int(value) for value in signal.pthread_sigmask(signal.SIG_BLOCK,[]))))')
        with (self.root / 'command.log').open('w') as log, v2_execution.cancellation_signals():
            result = v2_execution.run_process([sys.executable, '-c', code], cwd=self.root,
                                             stdout=log, stderr=log, timeout=2)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(target.read_text()), expected)
        self.assertEqual({value: signal.getsignal(value) for value in handlers}, handlers)

    def test_exit_code_is_not_changed_into_success(self):
        with (self.root / 'command.log').open('w') as log:
            result = v2_execution.run_process([sys.executable, '-c', 'raise SystemExit(7)'],
                                             cwd=self.root, stdout=log, stderr=log, timeout=2)
        self.assertEqual(result.returncode, 7)
        with self.assertRaises(subprocess.CalledProcessError):
            result.check_returncode()


if __name__ == '__main__':
    unittest.main()
