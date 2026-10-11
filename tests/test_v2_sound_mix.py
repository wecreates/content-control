import hashlib,math,shutil,struct,tempfile,unittest,wave
from pathlib import Path
from scripts.v2_sound_mix import mix,probe

@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'),'ffmpeg/ffprobe required')
class SoundMixTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
  self.sources=[]
  for name,duration,hz in [('voice',2,440),('music',.4,220),('hit1',.3,880),('hit2',.3,660)]:
   p=self.root/(name+'.wav');self.sources.append(p)
   with wave.open(str(p),'wb') as w:
    w.setparams((2,2,44100,0,'NONE','not compressed'));w.writeframes(b''.join(struct.pack('<hh',*[int(1500*math.sin(2*math.pi*hz*i/44100))]*2) for i in range(round(duration*44100))))
  self.cc={'publication_enabled':False,'scenes':[{'start':0,'end':1},{'start':1,'end':2}]}
 def tearDown(self):self.tmp.cleanup()
 def call(self):return mix(self.sources[0],self.cc,self.sources[1],self.sources[2:],self.root/'out')
 def test_distinct_stems_duration_no_source_mutation(self):
  before=[p.read_bytes() for p in self.sources];r=self.call();self.assertEqual(r['status'],'PASS');self.assertEqual(r['provider_calls'],0)
  self.assertEqual(set(r['outputs']),{'music.wav','sfx.wav','mix.wav'})
  self.assertEqual(len({o['sha256'] for o in r['outputs'].values()}),3)
  for o in r['outputs'].values():self.assertAlmostEqual(probe(o['path']),2,places=2)
  self.assertEqual(before,[p.read_bytes() for p in self.sources]);self.assertEqual(r['cue_seconds'],[0])
 def test_directed_cue_alignment_and_invalid_density(self):
  self.cc['sound_design']={'cue_seconds':[.5]}
  result=self.call();self.assertEqual(result['cue_seconds'],[.5])
  with wave.open(str(self.root/'out'/'sfx.wav'),'rb') as w:
   self.assertEqual(w.readframes(20000),b'\0'*80000)
   w.setpos(23000);self.assertNotEqual(w.readframes(1000),b'\0'*4000)
  self.cc['sound_design']['cue_seconds']=[.2,.4]
  with self.assertRaisesRegex(ValueError,'sparse'):self.call()
 def test_publication_and_missing_voice_fail_closed(self):
  self.cc['publication_enabled']=True
  with self.assertRaisesRegex(ValueError,'Publication'):self.call()
  self.cc['publication_enabled']=False;self.sources[0].unlink()
  with self.assertRaisesRegex(ValueError,'Existing narration'):self.call()
 def test_wrong_narration_duration_rejected(self):
  self.cc['scenes'][-1]['end']=3
  with self.assertRaisesRegex(ValueError,'match'):self.call()
 def test_source_overwrite_rejected(self):
  with self.assertRaisesRegex(ValueError,'overwrite'):mix(self.sources[0],self.cc,self.sources[1],self.sources[2:],self.root)
if __name__=='__main__':unittest.main()
