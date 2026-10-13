"""No real credentials or network required: unknown-cost reviews fail closed."""
import ast
import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]

class FreeReviewGuardTests(unittest.TestCase):
    def test_direct_functions_fail_before_network_even_on_retries(self):
        with patch.dict(os.environ, {'GEMINI_API_KEY':'synthetic-test-key','EXPECTED_SHA':'synthetic-sha','PUBLICATION_ENABLED':'true','ALLOW_PAID':'true'}):
            for filename, calls in [
                ('competitor_intelligence.py',[('gemini_upload',(Path('/missing.mp4'),'synthetic')),('gemini_analyze',('synthetic-uri','synthetic'))]),
                ('gemini_content_analysis.py',[('upload',()),('infer',({'uri':'synthetic-uri'},))]),
            ]:
                spec=importlib.util.spec_from_file_location('guard_test_'+filename[:-3],ROOT/'scripts'/filename)
                module=importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                with patch('urllib.request.urlopen') as network:
                    for name,args in calls:
                        for _ in range(3):
                            with self.assertRaisesRegex(RuntimeError,'unverified_cost_review_disabled'):
                                getattr(module,name)(*args)
                    network.assert_not_called()

    def test_inline_review_blocks_fail_before_any_instructions(self):
        count=0
        for filename in ['dropbox-review-bridge.yml']:
            lines=(ROOT/'.github/workflows'/filename).read_text().splitlines()
            for i,line in enumerate(lines):
                if "python - <<'PY'" not in line:
                    continue
                block=[]
                for following in lines[i+1:]:
                    if following.strip()=='PY':break
                    block.append(following[10:])
                source='\n'.join(block)
                tree=ast.parse(source)
                self.assertIsInstance(tree.body[0],ast.Raise)
                with patch('urllib.request.urlopen') as network:
                    with self.assertRaisesRegex(RuntimeError,'unverified_cost_review_disabled'):
                        exec(compile(tree,filename,'exec'),{})
                    network.assert_not_called()
                count+=1
        self.assertEqual(count,1)

    def test_exact_review_uses_local_probe_and_existing_evidence_without_paid_inference(self):
        workflow=(ROOT/'.github/workflows/exact-av-review.yml').read_text()
        reviewer=(ROOT/'scripts/exact_av_review.mjs').read_text()
        for forbidden in ['GEMINI_API_KEY','generativelanguage.googleapis.com','gemini_upload','gemini_analyze']:
            self.assertNotIn(forbidden,workflow+reviewer)
        self.assertIn('node scripts/exact_av_review.mjs prepare',workflow)
        self.assertIn("'scripts/exact_av_review.mjs','validate'",workflow)
        self.assertIn("PUBLICATION_ENABLED: 'false'",workflow)
        self.assertIn('production-execution.yml',workflow)
        self.assertIn('ffprobe',reviewer)

if __name__=='__main__':unittest.main()
