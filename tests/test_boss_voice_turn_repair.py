import copy,json,math,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from timed_free_voice import build
from repair_boss_voice_turn import repair

class TurnRepairTests(unittest.TestCase):
 def source(self):
  return json.loads(Path('projects/shorts/credit-score-boss-fight/ccsd.json').read_text())
 def tone(self,*args): return [math.sin(i*.1)*.1 for i in range(2400)],24000
 def test_one_take_preserves_other_clips_timing_and_original_evidence(self):
  new=self.source();old=copy.deepcopy(new);old['scenes'][7]['audio']['dialogue'][0]['text']='So I just stop getting punched?'
  with tempfile.TemporaryDirectory() as d:
   base=Path(d)/'old';before=build(old,base,self.tone);raw=(base/'voice.wav').read_bytes();calls=[]
   def synth(text,voice,speed): calls.append((text,voice,speed));return self.tone()
   result=repair(new,base,Path(d)/'new',synth)
   self.assertEqual(calls,[('So, I just stop getting punched?','am_fenrir',1.0)])
   self.assertEqual((base/'voice.wav').read_bytes(),raw)
   for i in range(18):
    if i!=7:self.assertEqual(result['manifest']['clips'][i],before['manifest']['clips'][i])
   self.assertEqual(result['audio']['duration'],54);self.assertFalse(result['production_approved'])
 def test_unrelated_timing_change_rejected_before_synthesis(self):
  new=self.source();old=copy.deepcopy(new);old['scenes'][7]['audio']['dialogue'][0]['text']='So I just stop getting punched?'
  with tempfile.TemporaryDirectory() as d:
   base=Path(d)/'old';build(old,base,self.tone);new['scenes'][0]['audio']['dialogue'][0]['text']='Changed words.'
   with patch('repair_boss_voice_turn.local_synthesizer') as synth:
    with self.assertRaisesRegex(ValueError,'Unrelated'):repair(new,base,Path(d)/'new')
    synth.assert_not_called()

 def test_changed_audio_discards_prior_approval_and_listening_receipts(self):
  new=self.source();old=copy.deepcopy(new);old['scenes'][7]['audio']['dialogue'][0]['text']='So I just stop getting punched?'
  with tempfile.TemporaryDirectory() as d:
   base=Path(d)/'old';r=build(old,base,self.tone)
   r.update(status='APPROVED',production_approved=True,full_av_review=True,listening_review={'approved':True},caption_track={'status':'PASS'})
   (base/'timed-voice.json').write_text(json.dumps(r))
   result=repair(new,base,Path(d)/'new',self.tone)
   self.assertEqual(result['status'],'GENERATED_PENDING_LISTENING_REVIEW')
   self.assertFalse(result['production_approved']);self.assertFalse(result['full_av_review'])
   self.assertFalse(result['publication_enabled'])
   self.assertNotIn('listening_review',result);self.assertNotIn('caption_track',result)

 def test_changed_silent_tail_rejected_before_synthesis(self):
  new=self.source();old=copy.deepcopy(new);old['scenes'][7]['audio']['dialogue'][0]['text']='So I just stop getting punched?'
  with tempfile.TemporaryDirectory() as d:
   base=Path(d)/'old';build(old,base,self.tone)
   new['scenes'][-1]['end']+=1
   with patch('repair_boss_voice_turn.local_synthesizer') as synth:
    with self.assertRaisesRegex(ValueError,'timeline metadata or duration'):repair(new,base,Path(d)/'new')
    synth.assert_not_called()

 def test_workflow_reuses_consumed_take_without_synthesis_or_asr_rerun(self):
  workflow=Path('.github/workflows/timed-free-voice-tests.yml').read_text()
  self.assertIn("artifact-ids: '12525385780'",workflow)
  self.assertIn("run-id: '40007452667'",workflow)
  self.assertIn("run['head_sha']=='4062d49bb2396f6070972ac6f9dcb4c4476ae670'",workflow)
  self.assertNotIn('python scripts/repair_boss_voice_turn.py',workflow)
  self.assertNotIn('python scripts/timed_free_voice.py',workflow)
  self.assertNotIn('python scripts/v2_clip_transcription.py',workflow)
  self.assertIn("raise SystemExit('Listening resolution and reviewed caption continuation required')",workflow)
