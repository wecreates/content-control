"""Regression checks for executable canonical workflow commands and fail-closed gates."""
import pathlib
import re
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
WORKFLOW=ROOT/'.github/workflows/studio-pipeline.yml'

class StudioFreeExecutionTests(unittest.TestCase):
    def test_canonical_voice_is_local_and_verified(self):
        workflow=WORKFLOW.read_text()
        step=workflow.split('      - name: Build free local production voice',1)[1].split('      - name:',1)[0]
        self.assertNotIn('cartesia_sonic_generate',workflow)
        self.assertNotIn('secrets.CARTESIA',workflow)
        for script in ('v2_free_voice.py','v2_audio_assemble.py','voice_candidate_qa.py'):
            self.assertIn(script,step)
        self.assertIn('listening_review":"pending"',step)
        self.assertIn('assembly["status"] == qa["status"] == "PASS"',step)

    def test_promotions_read_evidence(self):
        workflow=WORKFLOW.read_text()
        self.assertNotRegex(workflow,r'checks.*:true')
        self.assertIn('storyboard-manifest.json',workflow)
        self.assertIn('checks[key]=json.loads(report.read_text()).get("status")=="PASS"',workflow)
        self.assertIn('assert all(checks.values()),checks',workflow)
        self.assertIn('inject_soundscape_path.py',workflow)

    def test_embedded_python_and_shell_parse(self):
        # Extract YAML run blocks without requiring a new runtime YAML dependency.
        text=WORKFLOW.read_text()
        blocks=re.findall(r'^        run: \|\n((?:          .*\n|\n)+)',text,re.M)
        self.assertTrue(blocks)
        for block in blocks:
            shell='\n'.join(line[10:] if line.startswith('          ') else line for line in block.splitlines())+'\n'
            result=subprocess.run(['bash','-n'],input=shell,text=True,capture_output=True)
            self.assertEqual(result.returncode,0,result.stderr)
            for match in re.finditer(r"<<'([A-Z]+)'\n(.*?)\n\1(?:\n|$)",shell,re.S):
                compile(match.group(2),str(WORKFLOW),'exec')

if __name__=='__main__':unittest.main()
