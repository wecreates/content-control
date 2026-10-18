"""No real credentials or network required: unknown-cost reviews fail closed."""
import ast
import importlib.util
import os
import re
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

    def assert_local_review_has_no_provider_access(self, workflow, reviewer):
        # Exempt only the explicitly gated diagnostic job, never later jobs.
        prefix, jobs = workflow.split("\njobs:\n", 1)
        sections = re.split(r"(?m)^(  \S[^\n]*(?:\n|\Z))", jobs)
        self.assertEqual(sections[0], "")
        blocks = list(zip(sections[1::2], sections[2::2]))
        diagnostic = [body for name, body in blocks if name == "  free-api-diagnostic:\n"]
        self.assertEqual(len(diagnostic), 1)
        local = prefix + "".join(name+body for name, body in blocks if name != "  free-api-diagnostic:\n")
        for forbidden in ['GEMINI_API_KEY','GEMINI_PROJECT_READ_TOKEN','id-token: write',
                          'generativelanguage.googleapis.com','gemini_upload','gemini_analyze']:
            self.assertNotIn(forbidden, local+reviewer)
        guard = diagnostic[0].split("\n", 1)[0]
        for required in ["github.event_name == 'workflow_dispatch'", "github.ref == 'refs/heads/main'",
                         "github.event.repository.private == false", "inputs.run_free_api_diagnostic",
                         "vars.GEMINI_AV_IDENTITY_ENABLED == 'true'", "vars.GEMINI_AV_WIF_PROVIDER != ''",
                         "vars.GEMINI_AV_READ_SERVICE_ACCOUNT != ''"]:
            self.assertIn(required, guard)

    def test_local_job_guard_rejects_provider_access_before_and_after_diagnostic(self):
        workflow=(ROOT/'.github/workflows/exact-av-review.yml').read_text()
        for position in ['before', 'after']:
            for header in ['leaked-provider-job:', '"leaked-provider-job":', 'leaked-provider-job: # comment']:
                for forbidden in ['GEMINI_API_KEY', 'GEMINI_PROJECT_READ_TOKEN', 'id-token: write']:
                    extra=f"  {header}\n    env: {{{forbidden}: synthetic}}\n"
                    mutated=(workflow.replace("  free-api-diagnostic:\n",extra+"  free-api-diagnostic:\n")
                             if position=='before' else workflow+extra)
                    with self.subTest(position=position, header=header, forbidden=forbidden):
                        with self.assertRaises(AssertionError):
                            self.assert_local_review_has_no_provider_access(mutated, '')
        with self.assertRaises(AssertionError):
            self.assert_local_review_has_no_provider_access(workflow+'  inline-job: {env: {GEMINI_API_KEY: synthetic}}', '')

    def test_exact_review_uses_local_probe_and_existing_evidence_without_paid_inference(self):
        workflow=(ROOT/'.github/workflows/exact-av-review.yml').read_text()
        reviewer=(ROOT/'scripts/exact_av_review.mjs').read_text()
        self.assert_local_review_has_no_provider_access(workflow, reviewer)
        self.assertIn("import {inspectMedia,prepareReview} from './scripts/exact_av_review.mjs'",workflow)
        self.assertIn('inspectMedia(process.env.MEDIA_PATH)',workflow)
        self.assertIn('prepareReview(media)',workflow)
        self.assertIn('media.candidate_sha256!==source.expected_sha256',workflow)
        self.assertIn("'scripts/exact_av_review.mjs','validate'",workflow)
        self.assertIn("PUBLICATION_ENABLED: 'false'",workflow)
        self.assertIn('reviewSource(run,',workflow)
        self.assertIn('production-execution.yml',reviewer)
        self.assertIn('content-control-v2.yml',reviewer)
        self.assertIn('ffprobe',reviewer)

if __name__=='__main__':unittest.main()
