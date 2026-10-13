import fnmatch
import json
import types
import unittest
from pathlib import Path
from unittest.mock import patch
from tests.test_revalidate_v2_candidate import RevalidationTests
from scripts.accept_existing_v2 import assess, promote, REVIEW_PATH
from scripts.revalidate_v2_candidate import digest


class ExistingAcceptanceTests(RevalidationTests):
    def setUp(self):
        super().setUp()
        for name in ('creative-handoff.js','social-intake.js','package.json'):
            (self.root/name).write_bytes(Path(name).read_bytes())
        media=self.artifact/'receipts/render.json';r=json.loads(media.read_text());r['metrics']={'duration':50};media.write_text(json.dumps(r))
        report=self.root/'state/v2-production-status.json';r=json.loads(report.read_text())
        for name,item in r['checks'].items():item['status']='PASS'
        r['checks']['technical_video']['receipt_sha256']=digest(media);report.write_text(json.dumps(r))
        self.write('state/visual-analysis/frame-review.json',{'candidate':{'sha256':self.hash}})
        self.module=types.ModuleType('scripts.rendered_visual_parity');self.module.evaluate_visual_review=lambda *args:{'status':'PASS'}
    def review(self):
        keys=['hook','story_escalation','visual_storytelling','character_consistency','voice_performance','sound_mix','pacing','phone_readability','payoff','factual_accuracy']
        return {'candidate_sha256':self.hash,'status':'PASS','method':'rendered_video_review','full_video_review':True,'full_audio_review':True,'duration_seconds':50,'reviewed_intervals':[[0,50]],'checks':{k:{'pass':True,'evidence':'Synthetic test evidence for '+k} for k in keys},'comparisons':[{'url':f'https://example.org/{i}','full_video_review':True,'full_audio_review':True,'access_scope':'full audiovisual review','observation':'Synthetic fixture observation','applied_difference':'Synthetic fixture application'} for i in (1,2)],'unresolved_issues':[]}
    def assessment(self):
        with patch.dict('sys.modules',{'scripts.rendered_visual_parity':self.module}):return assess(self.root,self.artifact,self.run)
    def test_missing_review_retains_existing_candidate(self):
        before=digest(self.root/'public-review/v2-draft.mp4');result,health,_=self.assessment()
        self.assertEqual(result['status'],'BLOCKED');self.assertIn('complete_audiovisual_review_pending',result['reasons']);self.assertIsNone(health)
        self.assertEqual(digest(self.root/'public-review/v2-draft.mp4'),before)
        self.assertFalse((self.root/'state/v2-health.json').exists())
    def test_only_complete_current_reviews_can_prepare_and_promote(self):
        review=self.review();self.write(REVIEW_PATH,review)
        result,health,candidate=self.assessment();self.assertEqual(result['status'],'ELIGIBLE')
        promote(self.root,candidate,health)
        self.assertEqual(digest(self.root/'public-review/v2-boss-fight.mp4'),self.hash)
        self.assertIs(json.loads((self.root/'state/v2-health.json').read_text())['publication_enabled'],False)
        review['full_audio_review']=False;self.write(REVIEW_PATH,review)
        self.assertEqual(self.assessment()[0]['status'],'BLOCKED')
        with self.assertRaises(ValueError):promote(self.root,candidate,health)
    def test_promotion_creates_missing_output_directory(self):
        self.write(REVIEW_PATH,self.review())
        _,health,candidate=self.assessment()
        retained=self.root/'retained-candidate.mp4';candidate.rename(retained)
        (self.root/'public-review').rmdir()
        promote(self.root,retained,health)
        self.assertEqual(digest(self.root/'public-review/v2-boss-fight.mp4'),self.hash)

    def test_static_visual_failure_and_wrong_review_hash_block(self):
        review=self.review();review['candidate_sha256']='b'*64;self.write(REVIEW_PATH,review)
        self.assertIn('exact_render_review_missing',self.assessment()[0]['reasons'])
        review=self.review();self.write(REVIEW_PATH,review);self.module.evaluate_visual_review=lambda *args:{'status':'FAIL'}
        self.assertIsNone(self.assessment()[1])
    def test_review_records_are_excluded_from_render_trigger(self):
        text=Path('.github/workflows/content-control-v2.yml').read_text()
        patterns=[line.strip()[3:-1] for line in text.splitlines() if line.strip().startswith("- '")]
        def included(file):
            result=False
            for pattern in patterns:
                negative=pattern.startswith('!')
                if fnmatch.fnmatchcase(file,pattern.lstrip('!')):result=not negative
            return result
        self.assertFalse(included(REVIEW_PATH))
        self.assertFalse(included('projects/v2/example/revision-review.json'))
        self.assertTrue(included('projects/v2/example/ccsd.json'))


if __name__=='__main__':unittest.main()
