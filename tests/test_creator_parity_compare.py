import json, pathlib, tempfile, unittest
from scripts.creator_parity_compare import compare

ROOT=pathlib.Path(__file__).resolve().parents[1]
RUBRIC=json.load(open(ROOT/'control/creator-parity-ruthless-gate.json'))
RUBRIC['pass_contract']['minimum_competitor_full_av_videos']=2

def comp(name):
    return {
      'creator':name,
      'source_av_access':{'visual':True,'audio':True,'complete_end_to_end':True},
      'opening':{'intro_length_est_sec':2},
      'motion_language':{'meaningful_visual_change_est_sec':1.8},
      'story_and_retention':{'retention_resets':[1,2,3]},
      'transferable_mechanics':['physical action'],
      'slideshow_failure_modes':['static cards'],
      'lecture_failure_modes':['narration-only explanation'],
    }

class CreatorParityTests(unittest.TestCase):
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
