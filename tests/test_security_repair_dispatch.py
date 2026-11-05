"""Source-only dispatcher tests. gh is a shell fixture, never the real CLI."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

class DispatchTests(unittest.TestCase):
    def run_dispatch(self, workflow, sha, api_status=0):
        source = (ROOT/'.github/workflows/free-production-watchdog.yml').read_text()
        start = source.index('            if [ "$workflow" = "runtime-security-audit.yml" ]; then')
        end = source.index('          done < /tmp/repair-workflows', start)
        fragment = source[start:end]
        with tempfile.TemporaryDirectory() as tmp:
            script = '''set -euo pipefail
            gh() {
              if [ "$1" = api ]; then printf '%s\\n' "$FIXTURE_SHA"; return "$API_STATUS"; fi
              printf '%s\\n' "$@" > "$CALL_LOG"
            }
            ''' + fragment
            log = Path(tmp)/'calls'
            result = subprocess.run(['bash','-c',script], env={
                'PATH':os.defpath,'workflow':workflow,'FIXTURE_SHA':sha,
                'API_STATUS':str(api_status),'CALL_LOG':str(log),
                'GITHUB_REPOSITORY':'wecreates/content-control'}, capture_output=True)
            return result.returncode, log.read_text().splitlines() if log.exists() else []
    def test_security_route_passes_exact_current_main_sha(self):
        code,args = self.run_dispatch('runtime-security-audit.yml','a'*40)
        self.assertEqual(code,0)
        self.assertEqual(args,['workflow','run','runtime-security-audit.yml','--ref','main','-f','expected_sha='+'a'*40])
    def test_invalid_or_failed_lookup_never_dispatches(self):
        for sha,status in [('',0),('a'*39,0),('A'*40,0),('a'*40+';echo bad',0),('a'*40,1)]:
            with self.subTest(sha=sha,status=status):
                code,args=self.run_dispatch('runtime-security-audit.yml',sha,status)
                self.assertNotEqual(code,0); self.assertEqual(args,[])
    def test_other_routes_preserve_original_arguments(self):
        code,args=self.run_dispatch('runtime-integrity-manifest.yml','',1)
        self.assertEqual(code,0)
        self.assertEqual(args,['workflow','run','runtime-integrity-manifest.yml','--ref','main'])

if __name__ == '__main__': unittest.main()
