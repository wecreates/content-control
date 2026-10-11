import hashlib,math,shutil,struct,tempfile,unittest,wave
from pathlib import Path
from scripts.v2_sound_mix import mix,probe,resolve_cues

class CueTimingTests(unittest.TestCase):
 def test_current_project_migration_preserves_timing(self):
  import json
  cc=json.loads(Path('projects/v2/amex-vs-chase-boss-fight/ccsd.json').read_text())
  cues,events=resolve_cues(cc,cc['scenes'],max(s['end'] for s in cc['scenes']))
  for actual,expected in zip(cues,[.5,7.5,14,22.25,28.5,34.5]):self.assertAlmostEqual(actual,expected)
  self.assertEqual(len(events),6)
 def test_cues_follow_shifted_and_stretched_beat(self):
  cc={'sound_design':{'cue_events':[{'id':'impact','beat':'trap','phase':.25}]}}
  scenes=[{'id':'trap-a-1','start':10,'end':12},{'id':'trap-b-1','start':12,'end':14}]
  self.assertEqual(resolve_cues(cc,scenes,20)[0],[11])
  scenes=[{'id':'trap-a-1','start':20,'end':24},{'id':'trap-b-1','start':24,'end':28}]
  cues,events=resolve_cues(cc,scenes,30)
  self.assertEqual(cues,[22]);self.assertEqual(events[0]['beat_end'],28)
 def test_invalid_events_fail_closed(self):
  scenes=[{'id':'trap-a-1','start':0,'end':10}]
  valid={'id':'impact','beat':'trap','phase':.25}
  for event in [dict(valid,phase=True),dict(valid,phase=float('nan')),dict(valid,phase=2),dict(valid,beat='absent'),dict(valid,id=''),None]:
   with self.subTest(event=event),self.assertRaises(ValueError):resolve_cues({'sound_design':{'cue_events':[event]}},scenes,10)
  for design in [{'cue_events':[valid,valid]},{'cue_events':[valid],'cue_seconds':[1]},{'cue_events':[]}]:
   with self.assertRaises(ValueError):resolve_cues({'sound_design':design},scenes,10)
  for start in (4,6):
   with self.assertRaisesRegex(ValueError,'contiguous'):resolve_cues({'sound_design':{'cue_events':[valid]}},[{'id':'trap-a-1','start':0,'end':5},{'id':'trap-b-1','start':start,'end':10}],10)

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
 def test_relative_cue_places_pcm_at_resolved_time(self):
  self.cc['scenes'][0]['id']='trap-a-1';self.cc['scenes'][1]['id']='trap-b-1'
  self.cc['sound_design']={'cue_events':[{'id':'tap','beat':'trap','phase':.25}]}
  result=self.call();self.assertEqual(result['cue_seconds'],[.5])
  self.assertEqual(result['resolved_cue_events'][0]['beat_end'],2)
  with wave.open(str(self.root/'out'/'sfx.wav'),'rb') as w:
   self.assertEqual(w.readframes(22050),b'\0'*88200)
   self.assertNotEqual(w.readframes(1000),b'\0'*4000)
 def test_fifty_second_mp3_cues_keep_exact_pcm_timeline(self):
  import subprocess
  with wave.open(str(self.sources[0]),'rb') as w:data=w.readframes(w.getnframes())
  with wave.open(str(self.sources[0]),'wb') as w:w.setparams((2,2,44100,0,'NONE','not compressed'));w.writeframes(data*25)
  for i in (2,3):
   mp3=self.root/f'effect-{i}.mp3'
   subprocess.run(['ffmpeg','-v','error','-y','-i',str(self.sources[i]),str(mp3)],check=True,timeout=30)
   self.sources[i]=mp3
  self.cc={'publication_enabled':False,'scenes':[{'start':0,'end':50}],'sound_design':{'cue_seconds':[.5,7,13.5,20,27,34,41,48]}}
  r=self.call()
  for result in r['outputs'].values():self.assertAlmostEqual(result['duration'],50,places=3)
  with wave.open(str(self.root/'out'/'sfx.wav'),'rb') as w:
   self.assertEqual(w.getnframes(),50*44100)
   for cue in self.cc['sound_design']['cue_seconds']:
    w.setpos(round((cue+.03)*44100));self.assertNotEqual(w.readframes(1000),b'\0'*4000)
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
