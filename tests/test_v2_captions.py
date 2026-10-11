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
 def test_hash_failed_asr_and_publication_block(self):
  for key,value in [('audio_sha256','bad'),('status','FAIL'),('word_timestamps',False),('publication_enabled',True)]:
   old=self.report[key];self.report[key]=value
   with self.assertRaises(ValueError):self.run_build()
   self.report[key]=old
if __name__=='__main__':unittest.main()
