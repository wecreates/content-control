import copy,hashlib,tempfile,unittest
from pathlib import Path
from scripts.v2_captions import build_captions

class ObservedCaptionsTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.audio=Path(self.tmp.name)/'audio.wav';self.audio.write_bytes(b'test-only audio identity fixture')
  self.cc={'publication_enabled':False,'scenes':[{'id':'a','start':0,'end':5,'audio':{'dialogue':[{'speaker':'dave','text':'Why is my wallet the final boss?'}]}}]}
  self.report={'status':'PASS','publication_enabled':False,'word_timestamps':True,'audio_sha256':hashlib.sha256(self.audio.read_bytes()).hexdigest(),'words':[{'word':w,'start':i*.5,'end':i*.5+.3} for i,w in enumerate('Why is my wallet the final boss?'.split())]}
 def tearDown(self):self.tmp.cleanup()
 def run_build(self):return build_captions(self.cc,self.report,self.audio)
 def test_original_progressive_words_never_reveal_future_punchline(self):
  original=copy.deepcopy(self.report);r=self.run_build()
  self.assertEqual(self.report,original);self.assertEqual(r['cues'][0]['text'],'Why');self.assertEqual(r['cues'][2]['text'],'Why is my')
  for i,cue in enumerate(r['cues']):
   self.assertEqual(cue['start'],self.report['words'][i]['start']);self.assertEqual(cue['end'],self.report['words'][i]['end']);self.assertLessEqual(len(cue['text'].split()),3)
   if i<6:self.assertNotIn('boss',cue['text'])
  self.assertEqual(' '.join(c['word'] for c in r['cues']),'Why is my wallet the final boss?')
 def test_brief_financial_word_survives_phrase_window_boundary(self):
  self.cc['scenes'][0]['audio']['dialogue'][0]['text']='Premium rewards: two hundred ten.'
  self.report['words']=[{'word':w,'start':a,'end':b} for w,a,b in [
   ('Premium',0,.4),('rewards:',.4,.795),('two',.795,.875),
   ('hundred',.875,1.055),('ten.',1.055,1.455)]]
  original=copy.deepcopy(self.report)
  r=self.run_build()
  self.assertEqual(self.report,original)
  self.assertEqual(r['cues'][3]['text'],'rewards: two hundred')
  self.assertEqual(r['cues'][4]['text'],'two hundred ten.')
  visible=sum(n for c,n in zip(r['cues'],r['frame_visibility']['cue_frame_counts']) if 2 in c['display_word_indices'])
  self.assertGreaterEqual(visible,12)
  for c,w in zip(r['cues'],self.report['words']):
   self.assertEqual((c['start'],c['end']),(w['start'],w['end']))
 def test_discrepancy_missing_times_and_overlap_block(self):
  for mutate in [lambda r:r['words'].pop(),lambda r:r['words'][2].update(word='their'),lambda r:r['words'][2].update(start=None),lambda r:r['words'][2].update(start=.1),lambda r:r['words'][2].update(end=9)]:
   saved=copy.deepcopy(self.report);mutate(self.report)
   with self.assertRaises(ValueError):self.run_build()
   self.report=saved
 def test_zero_duration_word_waits_for_observed_positive_interval(self):
  self.report['words'][3]['end']=self.report['words'][3]['start']
  r=self.run_build();cue=next(c for c in r['cues'] if c['observed_word_index']==4)
  self.assertEqual(cue['text'],'wallet the');self.assertEqual(cue['start'],2.0);self.assertEqual(cue['end'],2.3)
  self.assertEqual(cue['deferred_zero_duration_indices'],[3])
  self.assertFalse(any(c['observed_word_index']==3 for c in r['cues']))
  self.assertEqual(' '.join(c['word'] for c in r['cues']),'Why is my wallet the final boss?')
 def test_unresolved_or_cross_speaker_zero_duration_stays_blocked(self):
  self.report['words'][-1]['end']=self.report['words'][-1]['start']
  with self.assertRaisesRegex(ValueError,'Terminal'):self.run_build()
  self.report['words'][-1]['end']+=.3
  self.cc['scenes'][0]['audio']['dialogue']=[{'speaker':'dave','text':'Why is my'},{'speaker':'points_monk','text':'wallet the final boss?'}]
  self.report['words'][2]['end']=self.report['words'][2]['start']
  with self.assertRaisesRegex(ValueError,'boundary'):self.run_build()
 def test_zero_prefix_does_not_cross_scene_or_grow_unbounded(self):
  self.cc['scenes']=[{'id':'a','start':0,'end':1.5,'audio':{'dialogue':[{'speaker':'dave','text':'Why is my'}]}},{'id':'b','start':1.5,'end':5,'audio':{'dialogue':[{'speaker':'dave','text':'wallet the final boss?'}]}}]
  self.report['words'][2]['end']=self.report['words'][2]['start']
  with self.assertRaisesRegex(ValueError,'boundary'):self.run_build()
  for i in range(3):self.report['words'][i]['end']=self.report['words'][i]['start']
  with self.assertRaisesRegex(ValueError,'Too many'):self.run_build()
 def test_between_frame_word_carries_to_next_phrase_without_early_reveal(self):
  self.cc={'fps':24,'publication_enabled':False,'scenes':[{'id':'a','start':0,'end':30,'audio':{'dialogue':[{'speaker':'points_monk','text':'Plot twist: the winning card.'}]}}]}
  self.report['words']=[{'word':w,'start':a,'end':b} for w,a,b in [('Plot',25.8,26.32),('twist:',26.32,26.68),('the',27.10,27.12),('winning',27.12,27.3),('card.',27.3,27.7)]]
  r=self.run_build();cue=r['cues'][3]
  self.assertEqual(cue['text'],'twist: the winning');self.assertEqual((cue['start'],cue['end']),(27.12,27.3));self.assertEqual(cue['deferred_frame_invisible_indices'],[2])
  self.assertEqual(r['frame_visibility']['visible_word_count'],5);self.assertEqual(r['frame_visibility']['cue_frame_counts'][2],0)
  self.assertEqual(' '.join(c['word'] for c in r['cues']),'Plot twist: the winning card.')
 def test_frame_invisible_terminal_and_cross_scene_block(self):
  self.cc={'fps':24,'publication_enabled':False,'scenes':[{'id':'a','start':0,'end':.02,'audio':{'dialogue':[{'speaker':'dave','text':'Stop'}]}}]}
  self.report['words']=[{'word':'Stop','start':.01,'end':.02}]
  with self.assertRaisesRegex(ValueError,'Terminal frame'):self.run_build()
  self.cc['scenes'].append({'id':'b','start':.02,'end':1,'audio':{'dialogue':[{'speaker':'dave','text':'now'}]}})
  self.report['words'].append({'word':'now','start':.02,'end':.5})
  with self.assertRaisesRegex(ValueError,'boundary'):self.run_build()
 def test_hash_failed_asr_and_publication_block(self):
  for key,value in [('audio_sha256','bad'),('status','FAIL'),('word_timestamps',False),('publication_enabled',True)]:
   old=self.report[key];self.report[key]=value
   with self.assertRaises(ValueError):self.run_build()
   self.report[key]=old
 def finance(self,script,observed):
  self.cc['fps']=24
  self.cc['scenes'][0]['audio']['dialogue'][0]['text']=script
  self.report['words']=[{'word':w,'start':i*.5,'end':i*.5+.3} for i,w in enumerate(observed)]
  return self.run_build()
 def test_compound_spelling_preserves_original_text_observed_times(self):
  result=self.finance('Choose autopay now.', ['Choose','auto','pay','now.'])
  cue=result['cues'][1]
  self.assertEqual(cue['word'],'autopay');self.assertEqual(cue['observed_token_indices'],[1,2])
  self.assertEqual((cue['start'],cue['end']),(1.0,1.3))
  self.assertEqual(' '.join(c['word'] for c in result['cues']),'Choose autopay now.')
 def test_spoken_morphology_and_units_cannot_be_normalized_away(self):
  for script,observed in [('planned purchases',['plan','purchases']),('useful credits',['useful','credit']),('seventy bucks',['seventy','dollars']),('a true zero',['true','zero'])]:
   with self.subTest(script=script),self.assertRaisesRegex(ValueError,'mismatch'):
    self.finance(script,observed)
 def test_numeric_asr_groups_original_words_without_invented_times(self):
  result=self.finance('Pay twenty-four percent now.', ['Pay','24%','now.'])
  cue=result['cues'][1]
  self.assertEqual(cue['word'],'twenty-four percent')
  self.assertEqual(cue['source_word_indices'],[1,2])
  self.assertEqual(cue['observed_token_indices'],[1])
  self.assertEqual((cue['start'],cue['end']),(.5,.8))
  self.assertEqual(' '.join(c['word'] for c in result['cues']),'Pay twenty-four percent now.')
 def test_spelled_asr_waits_until_final_observed_subword(self):
  result=self.finance('Pay $24 now.', ['Pay','twenty','four','dollars','now.'])
  cue=result['cues'][1]
  self.assertEqual(cue['word'],'$24')
  self.assertEqual(cue['observed_token_indices'],[1,2,3])
  self.assertEqual((cue['start'],cue['end']),(1.5,1.8))
  self.assertEqual(cue['source_word_indices'],[1])
 def test_financial_value_unit_and_sign_mismatches_fail_closed(self):
  for wrong in ['25%','24','-24%']:
   with self.assertRaisesRegex(ValueError,'mismatch'):
    self.finance('twenty-four percent', [wrong])
 def test_normalized_group_cannot_cross_character_or_scene(self):
  self.cc['scenes'][0]['audio']['dialogue']=[{'speaker':'dave','text':'twenty-four'},{'speaker':'points_monk','text':'percent'}]
  self.report['words']=[{'word':'24%','start':0,'end':.5}]
  with self.assertRaisesRegex(ValueError,'boundary'):self.run_build()
 def test_grouped_captions_pass_actual_renderer_lookup(self):
  import json,subprocess
  result=self.finance('Pay twenty-four percent now.', ['Pay','24%','now.'])
  c=Path(self.tmp.name)/'ccsd.json';t=Path(self.tmp.name)/'captions.json';out=Path(self.tmp.name)/'frames.json'
  c.write_text(json.dumps(self.cc));t.write_text(json.dumps(result))
  subprocess.run(['node','scripts/verify_caption_frames.mjs','--ccsd',str(c),'--captions',str(t),'--out',str(out)],check=True,capture_output=True)
  self.assertEqual(json.loads(out.read_text())['status'],'PASS')
 def test_split_numeric_notation_preserves_observed_group_interval(self):
  from scripts.v2_captions import coalesce_numeric_tokens
  for fragments,joined in [(['$10',',000'],'$10,000'),(['24','%'],'24%'),(['$19','.73,'],'$19.73,')]:
   tokens=[{'word':word,'start':i*.2,'end':(i+1)*.2} for i,word in enumerate(fragments)]
   saved=copy.deepcopy(tokens);result=coalesce_numeric_tokens(tokens)
   self.assertEqual(tokens,saved);self.assertEqual(len(result),1)
   self.assertEqual(result[0]['word'],joined)
   self.assertEqual((result[0]['start'],result[0]['end']),(0,.4))
   self.assertEqual(result[0]['observed_token_indices'],[0,1])
 def test_split_numeric_caption_and_nonadjacent_fragment_fail_closed(self):
  self.cc['scenes'][0]['audio']['dialogue'][0]['text']='twenty-four percent'
  self.report['words']=[{'word':'24','start':0,'end':.3},{'word':'%','start':.3,'end':.6}]
  result=self.run_build();self.assertEqual(result['cues'][0]['word'],'twenty-four percent')
  self.assertEqual(result['cues'][0]['observed_token_indices'],[0,1])
  self.report['words'][1]['start']=.4
  with self.assertRaisesRegex(ValueError,'no normalized speech'):self.run_build()
if __name__=='__main__':unittest.main()
