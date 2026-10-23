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
