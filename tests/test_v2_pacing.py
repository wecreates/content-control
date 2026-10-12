import copy,hashlib,tempfile,unittest
from pathlib import Path
from scripts.v2_pacing import retime

class PacingTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.audio=Path(self.tmp.name)/'voice.wav';self.audio.write_bytes(b'fixture')
  self.cc={'publication_enabled':False,'fps':24,'duration_seconds':10,'scenes':[{'id':'a','start':0,'end':2,'audio':{'dialogue':[{'speaker':'dave','text':'Hello'}]}},{'id':'cut','start':2,'end':5},{'id':'b','start':5,'end':10,'audio':{'dialogue':[{'speaker':'narrator','text':'World'}]}}]}
  self.assembly={'status':'PASS','publication_enabled':False,'audio_sha256':hashlib.sha256(self.audio.read_bytes()).hexdigest(),'duration':10,'dialogue':[{'scene_id':'a','start':0,'end':2,'audio_sha256':'a'},{'scene_id':'b','start':5,'end':7,'audio_sha256':'b'}]}
  self.manifest={'clips':[{'scene_id':i,'text_sha256':hashlib.sha256(t.encode()).hexdigest(),'duration':2,'speed':1.08,'audio_sha256':i} for i,t in [('a','Hello'),('b','World')]]}
 def tearDown(self):self.tmp.cleanup()
 def test_measured_pacing_preserves_audio_and_remaps_every_shot(self):
  before=copy.deepcopy(self.cc);r=retime(self.cc,self.assembly,self.manifest,self.audio)
  self.assertEqual(self.cc,before);self.assertEqual(r['duration_seconds'],121/24)
  self.assertEqual(r['scenes'][0]['audio']['dialogue'][0]['performance']['synthesis_speed'],1.08)
  self.assertEqual(len(r['scenes']),3)
  for a,b in zip(r['scenes'],r['scenes'][1:]):self.assertEqual(a['end'],b['start'])
  for s in r['scenes']:
   self.assertGreater(s['end'],s['start']);self.assertAlmostEqual(s['start']*24,round(s['start']*24))
  for w in r['pacing_repair']['windows']:self.assertGreaterEqual(w['window_frames']/24,w['clip_duration_seconds']+.03)
 def test_wrong_audio_or_stale_script_block(self):
  self.audio.write_bytes(b'changed')
  with self.assertRaisesRegex(ValueError,'actual audio'):retime(self.cc,self.assembly,self.manifest,self.audio)
  self.audio.write_bytes(b'fixture');self.cc['scenes'][0]['audio']['dialogue'][0]['text']='changed'
  with self.assertRaisesRegex(ValueError,'script'):retime(self.cc,self.assembly,self.manifest,self.audio)
