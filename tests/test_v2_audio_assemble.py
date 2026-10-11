import unittest,tempfile,wave,struct,hashlib
from pathlib import Path
from scripts.v2_audio_assemble import assemble,sha
class AudioAssemblyTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
  self.cc={'publication_enabled':False,'scenes':[{'id':'a','start':0,'end':1,'audio':{'dialogue':[{'speaker':'dave','text':'Hello'}]}},{'id':'b','start':2,'end':4,'audio':{'dialogue':[{'speaker':'points_monk','text':'Yes'}]}}]}
  self.m={'publication_enabled':False,'provider':'cartesia','model_id':'sonic-3.6','voice_assignments':{'dave':'voice-a','points_monk':'voice-b'},'clips':[]}
  for i,(speaker,text) in enumerate([('dave','Hello'),('points_monk','Yes')]):
   f=self.root/f'{i}.wav'
   with wave.open(str(f),'wb') as w:w.setparams((2,2,44100,0,'NONE','not compressed'));w.writeframes(struct.pack('<hh',1000,-1000)*22050)
   self.m['clips'].append({'scene_id':'ab'[i],'speaker':speaker,'voice_id':self.m['voice_assignments'][speaker],'text_sha256':hashlib.sha256(text.encode()).hexdigest(),'audio_sha256':sha(f),'file':f.name})
 def tearDown(self):self.tmp.cleanup()
 def run_assembly(self):return assemble(self.cc,self.m,self.root,self.root/'out.wav')
 def test_alignment_and_duration(self):
  r=self.run_assembly();self.assertEqual(r['duration'],4);self.assertEqual(r['dialogue'][1]['start'],2)
  with wave.open(str(self.root/'out.wav'),'rb') as w:
   w.setpos(44100);self.assertEqual(w.readframes(1),b'\0'*4);w.setpos(88200);self.assertNotEqual(w.readframes(1),b'\0'*4)
 def test_reject_crossed_voice(self):
  self.m['clips'][1]['voice_id']='voice-a'
  with self.assertRaisesRegex(ValueError,'voice'):self.run_assembly()
 def test_reject_text_mismatch(self):
  self.cc['scenes'][0]['audio']['dialogue'][0]['text']='Different'
  with self.assertRaisesRegex(ValueError,'text hash'):self.run_assembly()
 def test_reject_overlap(self):
  self.cc['scenes'][1]['start']=.2
  with self.assertRaisesRegex(ValueError,'overlaps'):self.run_assembly()
 def test_reject_fallback_and_publication(self):
  self.m['provider']='espeak'
  with self.assertRaises(ValueError):self.run_assembly()
  self.m['provider']='cartesia';self.cc['publication_enabled']=True
  with self.assertRaisesRegex(ValueError,'PUBLICATION'):self.run_assembly()
 def test_reject_tamper(self):
  (self.root/'0.wav').write_bytes(b'invalid')
  with self.assertRaisesRegex(ValueError,'audio hash'):self.run_assembly()
if __name__=='__main__':unittest.main()
