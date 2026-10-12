import copy,hashlib,tempfile,unittest
from pathlib import Path
from scripts.v2_clip_transcription import transcribe_windows
class ClipTranscriptionTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.audio=Path(self.tmp.name)/'audio';self.audio.write_bytes(b'fixture')
  self.cc={'publication_enabled':False,'scenes':[{'id':'a','start':0,'audio':{'dialogue':[{'speaker':'dave','text':'You summoned'}]}},{'id':'b','start':2,'audio':{'dialogue':[{'speaker':'monk','text':'Me'}]}}]}
  self.receipt={'status':'PASS','publication_enabled':False,'audio_sha256':hashlib.sha256(b'fixture').hexdigest(),'duration':3,'dialogue':[{'scene_id':'a','speaker':'dave','start':0,'end':1.5},{'scene_id':'b','speaker':'monk','start':2,'end':3}]}
  self.calls=[]
 def tearDown(self):self.tmp.cleanup()
 def observe(self,samples):
  self.calls.append(len(samples))
  return [{'word':'You','start':0,'end':.4},{'word':'summoned','start':.4,'end':1.4}] if len(samples)==24000 else [{'word':'Me','start':.1,'end':.8}]
 def build(self,observe=None):return transcribe_windows(self.cc,self.receipt,self.audio,[0]*48000,observe or self.observe)
 def test_crop_and_offset_preserve_observed_times_without_script_hints(self):
  r=self.build();self.assertEqual(self.calls,[24000,16000]);self.assertEqual(r['words'][-1]['start'],2.1);self.assertEqual(r['words'][-1]['end'],2.8);self.assertEqual(r['words'][-1]['speaker'],'monk')
 def test_incorrect_word_not_replaced_by_script(self):
  def incorrect(s):
   words=self.observe(s);words[1]['word']='summon';return words
  with self.assertRaisesRegex(ValueError,'differ'):self.build(incorrect)
 def test_asr_cannot_stretch_word_into_next_character(self):
  def stretched(s):
   words=self.observe(s);words[-1]['end']=2.5;return words
  with self.assertRaisesRegex(ValueError,'outside'):self.build(stretched)
 def test_invalid_receipts_rejected_before_asr(self):
  for patch in [{'status':'FAIL'},{'audio_sha256':'wrong'},{'publication_enabled':True},{'duration':4},{'dialogue':[]}]:
   original=copy.deepcopy(self.receipt);self.receipt.update(patch)
   with self.assertRaises(ValueError):self.build()
   self.assertEqual(self.calls,[]);self.receipt=original
 def test_overlap_wrong_speaker_and_nonfinite_window_block(self):
  for patch in [{'start':1},{'end':float('nan')},{'speaker':'dave'}]:
   original=copy.deepcopy(self.receipt);self.receipt['dialogue'][1].update(patch)
   with self.assertRaises(ValueError):self.build()
   self.assertEqual(self.calls,[]);self.receipt=original
if __name__=='__main__':unittest.main()
