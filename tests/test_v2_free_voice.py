import copy,hashlib,math,shutil,tempfile,unittest,wave
from pathlib import Path
from scripts.v2_free_voice import generate,VOICE_ASSIGNMENTS,MAX_SPEED

@unittest.skipUnless(shutil.which('ffmpeg'),'ffmpeg required')
class FreeVoiceTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.out=Path(self.tmp.name)/'audio'
  self.cc={'publication_enabled':False,'scenes':[{'id':'b','start':1,'end':2,'audio':{'dialogue':[{'speaker':'points_monk','text':'Yes.'}]}},{'id':'a','start':0,'end':1,'audio':{'dialogue':[{'speaker':'dave','text':'Hello.'}]}}]}
  self.calls=[]
 def tearDown(self):self.tmp.cleanup()
 def synth(self,text,voice,speed):
  self.calls.append((text,voice,speed));n=round(24000*.5/speed);return [math.sin(i*.1)*.1 for i in range(n)],24000
 def test_sorted_distinct_voice_hash_pcm_and_no_mutation(self):
  before=copy.deepcopy(self.cc);r=generate(self.cc,self.out,self.synth)
  self.assertEqual(self.cc,before);self.assertEqual([c['scene_id'] for c in r['clips']],['a','b']);self.assertEqual(r['provider_calls'],0);self.assertFalse(r['publication_enabled'])
  self.assertEqual({c['voice_id'] for c in r['clips']},{'am_fenrir','am_michael'})
  for c in r['clips']:
   p=self.out/c['file'];self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),c['audio_sha256'])
   with wave.open(str(p),'rb') as w:self.assertEqual((w.getnchannels(),w.getsampwidth(),w.getframerate()),(2,2,44100))
  self.assertTrue((self.out/'approved-manifest.json').exists())
 def test_fit_retries_bounded_without_truncation(self):
  def longer(text,voice,speed):
   self.calls.append(speed);return [math.sin(i*.1)*.1 for i in range(round(24000*1.1/speed))],24000
  r=generate(self.cc,self.out,longer);self.assertTrue(any(s>1 for s in self.calls));self.assertTrue(all(s<=MAX_SPEED for s in self.calls));self.assertTrue(all(c['duration']<c['window_seconds'] for c in r['clips']))
 def test_impossible_fit_has_no_success_manifest(self):
  def too_long(text,voice,speed):return [.1]*72000,24000
  with self.assertRaisesRegex(ValueError,'cannot fit'):generate(self.cc,self.out,too_long)
  self.assertFalse((self.out/'approved-manifest.json').exists())
 def test_fail_before_synthesis_for_unauthorized_or_unknown_speaker(self):
  self.cc['publication_enabled']=True
  with self.assertRaisesRegex(ValueError,'Publication'):generate(self.cc,self.out,self.synth)
  self.cc['publication_enabled']=False;self.cc['scenes'][0]['audio']['dialogue'][0]['speaker']='goblin'
  with self.assertRaisesRegex(ValueError,'assignment'):generate(self.cc,self.out,self.synth)
  self.assertEqual(self.calls,[])
 def test_silence_rejected(self):
  with self.assertRaisesRegex(ValueError,'silent'):generate(self.cc,self.out,lambda *args:([0.]*1000,24000))
if __name__=='__main__':unittest.main()
