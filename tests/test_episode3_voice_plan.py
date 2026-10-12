import copy,json,unittest
from pathlib import Path
from scripts.episode3_voice_plan import build_plan
class VoicePlanTests(unittest.TestCase):
 def setUp(self):
  self.dialogue=json.loads(Path('production/episode3/voice-dialogue.json').read_text())
  self.contract=json.loads(Path('state/episode3-factual-contract.json').read_text())
 def test_real_episode_keeps_words_speakers_and_existing_windows(self):
  before=copy.deepcopy((self.dialogue,self.contract));plan=build_plan(self.dialogue,self.contract)
  self.assertEqual(before,(self.dialogue,self.contract));self.assertFalse(plan['publication_enabled'])
  self.assertEqual(len(plan['scenes']),9)
  self.assertEqual([s['audio']['dialogue'][0]['speaker'] for s in plan['scenes']],['narrator','narrator','dave','narrator','narrator','points_monk','narrator','narrator','narrator'])
  for scene,cue in zip(plan['scenes'],self.contract['caption_cues']):
   self.assertEqual((scene['start'],scene['end'],scene['audio']['dialogue'][0]['text']),(cue['start'],cue['end'],cue['text']))
 def test_rejects_changed_words_publication_and_nonverbal_roles(self):
  for change in ['words','publication','speaker']:
   d=copy.deepcopy(self.dialogue)
   if change=='words':d['segments'][0]['text']='Invented narration'
   if change=='publication':d['publication_enabled']=True
   if change=='speaker':d['segments'][0]['speaker']='cashback_goblin'
   with self.subTest(change=change),self.assertRaises(ValueError):build_plan(d,self.contract)
 def test_rejects_gaps_incomplete_coverage_and_speaker_crossing(self):
  for change in ['gap','coverage','crossing']:
   c=copy.deepcopy(self.contract)
   if change=='gap':c['caption_cues'][1]['start']+=.1
   if change=='coverage':c['caption_cues'].pop()
   if change=='crossing':
    a,b=c['caption_cues'][1:3];a['text']+=' '+b['text'];a['end']=b['end'];del c['caption_cues'][2]
   with self.subTest(change=change),self.assertRaises(ValueError):build_plan(self.dialogue,c)
if __name__=='__main__':unittest.main()
