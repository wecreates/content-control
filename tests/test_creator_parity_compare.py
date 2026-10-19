import json, pathlib, tempfile, unittest, hashlib
from scripts.creator_parity_compare import full_av_access
from scripts.creator_parity_compare import compare, collect_competitor_signals, safe_num

ROOT=pathlib.Path(__file__).resolve().parents[1]
RUBRIC=json.load(open(ROOT/'control/creator-parity-ruthless-gate.json'))
RUBRIC['pass_contract']['minimum_competitor_full_av_videos']=2

def comp(name):
    return {
      'creator':name,
      'artifact_sha256':hashlib.sha256(('SYNTHETIC '+name).encode()).hexdigest(),
      'duration_seconds':5, 'reviewed_intervals':[[0,5]],
      'video_observation':'SYNTHETIC visual observation',
      'audio_observation':'SYNTHETIC audio observation',
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
    def test_complete_synthetic_episode1_evidence_can_pass_actual_rubric(self):
        # Contract fixture only: no actual media, perception or creative acceptance.
        # Load the unmodified Episode 1 requirements, not the reduced test rubric.
        rubric=json.loads((ROOT/'control/creator-parity-ruthless-gate.json').read_text())
        candidate=comp('SYNTHETIC_CANDIDATE') | {
            'duration_seconds':30, 'reviewed_intervals':[[0,15],[15,30]],
            'opening':{'first_3_seconds':'SYNTHETIC physical conflict immediately happens here',
                       'first_15_seconds':'SYNTHETIC clear stakes and entertainment promise emerge through physical action.'},
            'story_and_retention':{
                'why_it_does_not_feel_like_a_lecture':'SYNTHETIC physical action carries the explanation and creates escalating story consequences.',
                'retention_resets':[1,2,3], 'callbacks':[1,2],
                'ending_payoff':'SYNTHETIC callback closes the opening conflict with a final visual joke.'},
            'humor':{'mechanisms':['visual','deadpan','callback']},
            'sound':{'sfx_density':'SYNTHETIC high','sfx_sync':'SYNTHETIC contact-synced'},
            'credit_card_adaptations':['fees','APR','points'],
            'distinctive_elements_not_to_copy':['SYNTHETIC creator-specific characters'],
            'slideshow_detected':False, 'lecture_detected':False,
        }
        references=[comp(f'SYNTHETIC_REEL_{i}') | {'creator':f'SYNTHETIC_CREATOR_{i%5}'}
                    for i in range(7)]
        self.assertTrue(full_av_access(candidate))
        self.assertTrue(all(full_av_access(r) for r in references))
        result=compare(candidate,references,rubric)
        self.assertEqual(result['status'],'PASS',result['faults'])
        self.assertTrue(result['approval_allowed'])  # Scorer output only, not real approval.
        self.assertFalse(result['publication_enabled'])
        self.assertEqual(result['fault_counts'],{'critical':0,'major':0,'medium':0})
        self.assertEqual(result['faults'],[])
        self.assertEqual(result['unresolved_hard_fail_dimensions'],[])
        self.assertEqual(result['benchmark']['full_av_count'],7)
        self.assertEqual(result['benchmark']['creator_count'],5)
        self.assertEqual(result['benchmark']['instagram_reel_full_av_count'],7)

    def test_reference_evidence_must_include_identity_observations_and_coverage(self):
        for patch in [dict(artifact_sha256=None), dict(duration_seconds=True),
                      dict(reviewed_intervals=[[0,1],[4,5]]), dict(reviewed_intervals=[[0,4.99]]),
                      dict(reviewed_intervals=[[0,6]]), dict(audio_observation=None),
                      dict(video_observation=None), dict(source_av_access=None)]:
            with self.subTest(patch=patch):
                self.assertFalse(full_av_access(comp('A') | patch))
                self.assertEqual(collect_competitor_signals([comp('A') | patch])['full_av_count'],0)

    def test_duplicate_bytes_and_candidate_self_comparison_are_excluded(self):
        a=comp('A'); b=comp('B'); b['artifact_sha256']=a['artifact_sha256']
        self.assertEqual(collect_competitor_signals([a,b])['full_av_count'],1)
        self.assertEqual(compare(a,[a,b],RUBRIC)['benchmark']['full_av_count'],0)

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
