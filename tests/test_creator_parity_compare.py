import json, pathlib, tempfile, unittest
from scripts.creator_parity_compare import compare, collect_competitor_signals, safe_num

ROOT=pathlib.Path(__file__).resolve().parents[1]
RUBRIC=json.load(open(ROOT/'control/creator-parity-ruthless-gate.json'))
RUBRIC['pass_contract']['minimum_competitor_full_av_videos']=2

def comp(name):
    return {
      'creator':name,
      'source_url':'https://www.instagram.com/reel/'+name+'/',
      'source_av_access':{'visual':True,'audio':True,'complete_end_to_end':True},
      'opening':{'intro_length_est_sec':2},
      'motion_language':{'meaningful_visual_change_est_sec':1.8},
      'story_and_retention':{'retention_resets':[1,2,3]},
      'transferable_mechanics':['physical action'],
      'slideshow_failure_modes':['static cards'],
      'lecture_failure_modes':['narration-only explanation'],
    }

class CreatorParityTests(unittest.TestCase):
    def test_duplicates_and_incomplete_reviews_cannot_inflate_benchmark(self):
        a=comp('A'); duplicate=comp('Other');duplicate['source_url']='https://instagram.com/reel/A/?tracking=1'
        incomplete=comp('B');incomplete['source_av_access']['audio']=False
        string_flag=comp('C');string_flag['source_av_access']['visual']='true'
        report=collect_competitor_signals([a,duplicate,incomplete,string_flag])
        self.assertEqual(report['full_av_count'],1)
        self.assertEqual(report['creator_count'],1)
        self.assertEqual(report['instagram_reel_full_av_count'],1)

    def test_partial_review_does_not_affect_cadence(self):
        partial=comp('B');partial['source_av_access']['complete_end_to_end']=False
        partial['motion_language']['meaningful_visual_change_est_sec']=100
        self.assertEqual(collect_competitor_signals([comp('A'),partial])['median_visual_change_sec'],1.8)

    def test_existing_creator_and_reel_requirements_are_enforced(self):
        r=compare({},[comp('A'),comp('B')],RUBRIC)
        dimensions={f['dimension'] for f in r['faults']}
        self.assertIn('competitor_creators',dimensions)
        self.assertIn('instagram_reel_benchmark',dimensions)
        self.assertFalse(r['approval_allowed'])

    def test_source_aliases_and_creator_case_do_not_inflate_counts(self):
        a=comp('A');a['source_url']='https://youtu.be/abcdefghijk'
        b=comp('B');b['source_url']='https://www.youtube.com/watch?v=abcdefghijk'
        c=comp(' @a ')
        c['source_url']='https://www.instagram.com/reel/unique/'
        r=collect_competitor_signals([a,b,c])
        self.assertEqual(r['full_av_count'],2)
        self.assertEqual(r['creator_count'],1)
        self.assertEqual(r['instagram_reel_full_av_count'],1)

    def test_nonfinite_and_boolean_measurements_are_not_evidence(self):
        for value in ['NaN','Infinity',True,False]:
            self.assertIsNone(safe_num(value))

    def test_rejects_slideshow_candidate(self):
        c={
          'source_av_access':{'visual':True,'audio':True,'complete_end_to_end':True},
          'opening':{'first_3_seconds':'physical conflict immediately happens here','first_15_seconds':'clear stakes and entertainment promise are established immediately'},
          'motion_language':{'meaningful_visual_change_est_sec':1.8},
          'story_and_retention':{'why_it_does_not_feel_like_a_lecture':'Physical action continuously carries the explanation and creates story consequences.','retention_resets':[1,2,3],'callbacks':[1,2],'ending_payoff':'Strong callback closes the opening conflict with a visual joke.'},
          'humor':{'mechanisms':['visual','deadpan','callback']},
          'sound':{'sfx_density':'high','sfx_sync':'contact-synced'},
          'credit_card_adaptations':['fees','APR','points'],
          'distinctive_elements_not_to_copy':['creator characters'],
          'slideshow_detected':True,'lecture_detected':False,
        }
        r=compare(c,[comp('A'),comp('B')],RUBRIC)
        self.assertEqual(r['status'],'REJECT')
        self.assertTrue(any(f['dimension']=='slideshow' for f in r['faults']))

    def test_requires_competitor_evidence(self):
        c={'source_av_access':{'visual':True,'audio':True,'complete_end_to_end':True}}
        r=compare(c,[],RUBRIC)
        self.assertEqual(r['status'],'REJECT')
        self.assertTrue(any(f['dimension']=='competitor_benchmark' for f in r['faults']))

if __name__=='__main__':
    unittest.main()
