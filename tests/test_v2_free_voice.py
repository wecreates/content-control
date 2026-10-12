import copy,hashlib,json,math,shutil,tempfile,unittest,wave
from pathlib import Path
from unittest.mock import patch
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
 def test_all_reused_without_model_initialization(self):
  generate(self.cc,self.out,self.synth);self.calls.clear()
  with patch('scripts.v2_free_voice.local_synthesizer',side_effect=AssertionError('model initialized')):
   result=generate(self.cc,self.out)
  self.assertTrue(all(c['reused'] for c in result['clips']));self.assertEqual(self.calls,[])
 def test_edit_regenerates_only_changed_text(self):
  generate(self.cc,self.out,self.synth);self.calls.clear()
  self.cc['scenes'][0]['audio']['dialogue'][0]['text']='Different sentence.'
  result=generate(self.cc,self.out,self.synth)
  self.assertEqual(len(self.calls),1);self.assertEqual(self.calls[0][0],'Different sentence.')
  self.assertEqual([c['reused'] for c in result['clips']],[True,False])
 def test_tampered_audio_regenerates_only_corrupt_clip(self):
  result=generate(self.cc,self.out,self.synth);self.calls.clear()
  (self.out/result['clips'][0]['file']).write_bytes(b'corrupt')
  result=generate(self.cc,self.out,self.synth)
  self.assertEqual(len(self.calls),1);self.assertEqual([c['reused'] for c in result['clips']],[False,True])
 def test_matching_hash_cannot_reuse_silent_pcm(self):
  result=generate(self.cc,self.out,self.synth);self.calls.clear()
  target=self.out/result['clips'][0]['file']
  with wave.open(str(target),'wb') as w:
   w.setparams((2,2,44100,0,'NONE','not compressed'));w.writeframes(b'\x00'*88200)
  result['clips'][0]['audio_sha256']=hashlib.sha256(target.read_bytes()).hexdigest()
  (self.out/'approved-manifest.json').write_text(json.dumps(result))
  repaired=generate(self.cc,self.out,self.synth)
  self.assertEqual(len(self.calls),1);self.assertFalse(repaired['clips'][0]['reused'])
 def test_changed_model_provenance_disables_reuse(self):
  result=generate(self.cc,self.out,self.synth);self.calls.clear()
  result['model_repository']='different/model'
  (self.out/'approved-manifest.json').write_text(json.dumps(result))
  repaired=generate(self.cc,self.out,self.synth)
  self.assertEqual(len(self.calls),2);self.assertFalse(any(c['reused'] for c in repaired['clips']))
 def test_shorter_window_rechecks_and_resynthesizes(self):
  generate(self.cc,self.out,self.synth);self.calls.clear()
  self.cc['scenes'][1]['end']=.45;self.cc['scenes'][0]['start']=.45
  result=generate(self.cc,self.out,self.synth)
  self.assertFalse(result['clips'][0]['reused']);self.assertTrue(result['clips'][1]['reused'])
  self.assertGreater(len(self.calls),0);self.assertTrue(all(c[0]=='Hello.' for c in self.calls))
  self.assertLessEqual(result['clips'][0]['duration'],.42)
 def test_failed_repair_preserves_previous_manifest_and_clips(self):
  generate(self.cc,self.out,self.synth)
  originals={p.name:p.read_bytes() for p in self.out.iterdir() if p.is_file()}
  self.cc['scenes'][0]['audio']['dialogue'][0]['text']='Changed.'
  with self.assertRaisesRegex(ValueError,'silent'):
   generate(self.cc,self.out,lambda *args:([0.]*1000,24000))
  self.assertEqual(originals,{p.name:p.read_bytes() for p in self.out.iterdir() if p.is_file()})
 def test_explicit_speed_starts_synthesis_and_invalidates_changed_speed(self):
  self.cc['scenes'][0]['audio']['dialogue'][0]['performance']={'synthesis_speed':1.1}
  generate(self.cc,self.out,self.synth)
  self.assertEqual(self.calls[1][2],1.1);self.calls.clear()
  self.cc['scenes'][0]['audio']['dialogue'][0]['performance']['synthesis_speed']=1.2
  r=generate(self.cc,self.out,self.synth)
  self.assertEqual(len(self.calls),1);self.assertEqual(self.calls[0][2],1.2)
  self.assertTrue(r['clips'][0]['reused'])
 def test_invalid_explicit_speed_fails_before_synthesis(self):
  for value in [True,0.99,1.46,float('nan'),'1.2']:
   self.cc['scenes'][0]['audio']['dialogue'][0]['performance']={'synthesis_speed':value}
   with self.assertRaisesRegex(ValueError,'synthesis speed'):generate(self.cc,self.out,self.synth)
  self.assertEqual(self.calls,[])
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
