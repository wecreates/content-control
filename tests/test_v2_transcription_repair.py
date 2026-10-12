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
 def test_changed_source_and_fabricated_out_of_range_time_block(self):
  with self.assertRaisesRegex(ValueError,'outside actual samples'):
   repair(self.cc,self.report,self.assembly,self.audio,self.samples,lambda crop:[{'word':'Useful credits','start':0.,'end':2.}])
  self.audio.write_bytes(b'changed')
  with self.assertRaisesRegex(ValueError,'actual audio'):repair(self.cc,self.report,self.assembly,self.audio,self.samples,self.observe)
