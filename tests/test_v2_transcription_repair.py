import copy,hashlib,tempfile,unittest
from pathlib import Path
import numpy as np
from scripts.v2_transcription_repair import repair

class RecognitionRepairTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.audio=Path(self.tmp.name)/'voice.wav';self.audio.write_bytes(b'fixture');digest=hashlib.sha256(self.audio.read_bytes()).hexdigest()
  self.cc={'publication_enabled':False,'scenes':[{'id':'a','start':0,'end':1,'audio':{'dialogue':[{'speaker':'narrator','text':'Useful credits'}]}},{'id':'b','start':1,'end':2,'audio':{'dialogue':[{'speaker':'dave','text':'Continue now'}]}}]}
  self.report={'status':'PASS','publication_enabled':False,'audio_sha256':digest,'words':[{'word':word,'start':i*.5,'end':i*.5+.3} for i,word in enumerate(['Useful','credit','Continue','now'])]}
  self.assembly={'status':'PASS','publication_enabled':False,'audio_sha256':digest,'duration':2,'dialogue':[{'scene_id':'a','start':0,'end':.9},{'scene_id':'b','start':1,'end':1.9}]};self.samples=np.zeros(32000,dtype=np.float32);self.calls=[]
 def tearDown(self):self.tmp.cleanup()
 def observe(self,crop):
  self.calls.append(len(crop));return [{'word':'Useful','start':0.,'end':.3},{'word':'credits','start':.5,'end':.8}]
 def test_only_mismatched_window_reobserved_with_actual_offsets(self):
  before=copy.deepcopy(self.report);result=repair(self.cc,self.report,self.assembly,self.audio,self.samples,self.observe)
  self.assertEqual(self.report,before);self.assertEqual(self.calls,[14400]);self.assertEqual(result['words'][1]['word'],'credits');self.assertEqual(result['words'][2:],before['words'][2:]);self.assertEqual(result['original_full_transcription'],before)
  proof=result['recognition_repair']['windows'][0];self.assertEqual(proof['sample_start'],0);self.assertEqual(proof['sample_end'],14400);self.assertEqual(proof['local_observed_words'][1]['end'],.8)
 def test_mismatch_cannot_be_accepted_or_invented(self):
  for words in [[{'word':'Useful','start':0.,'end':.3}], [{'word':'Useful credit','start':0.,'end':.8}]]:
   with self.assertRaisesRegex(ValueError,'still differs'):repair(self.cc,self.report,self.assembly,self.audio,self.samples,lambda crop:words)
 def test_exact_input_does_not_call_model(self):
  self.report['words'][1]['word']='credits';result=repair(self.cc,self.report,self.assembly,self.audio,self.samples,self.observe);self.assertEqual(self.calls,[]);self.assertEqual(result,self.report)
 def test_exact_words_with_zero_duration_scene_terminal_are_reobserved(self):
  self.report['words'][1].update(word='credits',start=.8,end=.8)
  result=repair(self.cc,self.report,self.assembly,self.audio,self.samples,self.observe)
  self.assertEqual(self.calls,[14400]);self.assertEqual(result['words'][1]['start'],.5)
  self.assertEqual(result['recognition_repair']['windows'][0]['repair_reasons'],['zero_duration_scene_terminal'])
  self.assertEqual(result['original_full_transcription']['words'][1]['start'],.8)
 def test_terminal_zero_crop_cannot_borrow_from_next_speaker(self):
  self.report['words'][1].update(word='credits',start=.8,end=.8)
  def zero(crop):return [{'word':'Useful','start':0.,'end':.3},{'word':'credits','start':.8,'end':.8}]
  with self.assertRaisesRegex(ValueError,'still has unusable zero-duration'):
   repair(self.cc,self.report,self.assembly,self.audio,self.samples,zero)
 def test_safe_zero_prefix_does_not_trigger_reobservation(self):
  self.report['words'][0].update(start=0.,end=0.);self.report['words'][1]['word']='credits'
  result=repair(self.cc,self.report,self.assembly,self.audio,self.samples,self.observe)
  self.assertEqual(self.calls,[]);self.assertEqual(result,self.report)
 def test_terminal_retry_preserves_actual_nonzero_sample_offset(self):
  self.report['words'][1]['word']='credits';self.report['words'][3].update(start=1.8,end=1.8)
  local=[{'word':'Continue','start':.1,'end':.3},{'word':'now','start':.5,'end':.8}]
  result=repair(self.cc,self.report,self.assembly,self.audio,self.samples,lambda crop:local)
  proof=result['recognition_repair']['windows'][0]
  self.assertEqual(proof['scene_id'],'b');self.assertEqual(proof['sample_start'],16000)
  self.assertEqual(result['words'][2]['start'],1.1);self.assertEqual(result['words'][3]['end'],1.8)
 def test_changed_source_and_fabricated_out_of_range_time_block(self):
  with self.assertRaisesRegex(ValueError,'outside actual samples'):
   repair(self.cc,self.report,self.assembly,self.audio,self.samples,lambda crop:[{'word':'Useful credits','start':0.,'end':2.}])
  self.audio.write_bytes(b'changed')
  with self.assertRaisesRegex(ValueError,'actual audio'):repair(self.cc,self.report,self.assembly,self.audio,self.samples,self.observe)
 def test_exact_words_outside_dialogue_window_reobserved(self):
  self.report['words'][1].update(word='credits',end=1.05)
  result=repair(self.cc,self.report,self.assembly,self.audio,self.samples,self.observe)
  self.assertEqual(self.calls,[14400]);self.assertEqual(result['words'][1]['end'],.8)
  self.assertEqual(result['recognition_repair']['windows'][0]['repair_reasons'],['observed_words_leave_dialogue_window'])
  self.assertEqual(result['original_full_transcription']['words'][1]['end'],1.05)
 def test_early_next_speaker_reobserved_not_clamped(self):
  self.report['words'][1]['word']='credits';self.report['words'][2]['start']=.99
  local=[{'word':'Continue','start':.1,'end':.3},{'word':'now','start':.5,'end':.8}]
  result=repair(self.cc,self.report,self.assembly,self.audio,self.samples,lambda crop:local)
  self.assertEqual(result['words'][2]['start'],1.1)
  self.assertEqual(result['recognition_repair']['windows'][0]['scene_id'],'b')
 def test_fractional_crop_never_begins_before_source_window(self):
  start=1+1/48000
  self.cc['scenes'][1]['start']=start;self.assembly['dialogue'][1]['start']=start
  self.report['words'][1]['word']='credits'
  local=[{'word':'Continue','start':0.,'end':.3},{'word':'now','start':.5,'end':.8}]
  result=repair(self.cc,self.report,self.assembly,self.audio,self.samples,lambda crop:local)
  proof=result['recognition_repair']['windows'][0]
  self.assertEqual(proof['sample_start'],16001)
  self.assertGreaterEqual(result['words'][2]['start'],start)
  self.assertEqual(result['words'][2]['start'],16001/16000)
