import hashlib,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from scripts.repository_v2_handoff import prepare,observed_inputs
class HandoffTests(unittest.TestCase):
 def test_existing_build_binding_rejects_wrong_media_or_receipt(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'state').mkdir();(root/'public-review').mkdir();a=root/'artifact';(a/'render').mkdir(parents=True);(a/'receipts').mkdir()
   media=b'fixture media';digest=hashlib.sha256(media).hexdigest()
   (root/'public-review/v2-draft.mp4').write_bytes(media);(a/'render/v2-boss-fight.mp4').write_bytes(media)
   tech={'candidate_sha256':digest,'metrics':{'duration':10}};(a/'receipts/render.json').write_text(json.dumps(tech));technical_hash=hashlib.sha256((a/'receipts/render.json').read_bytes()).hexdigest()
   report={'run_id':123,'source_commit':'a'*40,'candidate_sha256':digest,'publication_enabled':False,'production_approved':False,'checks':{'technical_video':{'receipt_sha256':technical_hash}}}
   (a/'voice.wav').write_bytes(b'voice fixture');voice_hash=hashlib.sha256((a/'voice.wav').read_bytes()).hexdigest()
   segment={'start':0.,'end':2.,'text':'Actual dialogue'}
   transcription={'status':'PASS','publication_enabled':False,'audio_sha256':voice_hash,'word_timestamps':True,'segments':[segment],'actual_transcript':'Actual dialogue'}
   captions={'status':'PASS','publication_enabled':False,'source_audio_sha256':voice_hash,'cues':[segment]}
   for name,path,payload in [('transcription','receipts/transcription.json',transcription),('captions','captions.json',captions)]:
    (a/path).write_text(json.dumps(payload));report['checks'][name]={'receipt_sha256':hashlib.sha256((a/path).read_bytes()).hexdigest()}
   for name in ('v2-production-status.json','v2-draft.json'):(root/'state'/name).write_text(json.dumps(report))
   (a/'ccsd.json').write_text(json.dumps({'project_id':'fixture','publication_enabled':False,'scenes':[{'audio':{'dialogue':[{'text':'Actual dialogue'}]}}]}))
   metadata={'title':'Fixture','description':'Public draft','tags':[],'publication_enabled':False}
   with patch('scripts.repository_v2_handoff.git',return_value=json.dumps(metadata)):
    result=prepare(root,a,root/'out');self.assertEqual(result['candidate_sha256'],digest)
    self.assertEqual(json.loads((root/'out/audit-input.json').read_text())['transcript'],'Actual dialogue');self.assertFalse(result['production_approved'])
    (a/'render/v2-boss-fight.mp4').write_bytes(b'wrong')
    with self.assertRaisesRegex(ValueError,'not current video'):prepare(root,a,root/'bad')
    (a/'render/v2-boss-fight.mp4').write_bytes(media);(a/'receipts/render.json').write_text('{}')
    with self.assertRaisesRegex(ValueError,'receipt mismatch'):prepare(root,a,root/'bad')

 def test_observed_track_uses_real_boundaries_and_rejects_wrong_audio(self):
  import copy
  t={'status':'PASS','publication_enabled':False,'audio_sha256':'a'*64,'word_timestamps':True,'segments':[{'start':0.,'end':3.75,'text':'First sentence.'},{'start':4.,'end':14.,'text':'Next sentence.'}]}
  c={'status':'PASS','publication_enabled':False,'source_audio_sha256':'a'*64,'cues':[{'start':.25,'end':.75,'text':'First'},{'start':.75,'end':1.25,'text':'First sentence.'}]}
  windows,srt,end=observed_inputs(t,c,15.,'a'*64)
  self.assertEqual(end,3.75);self.assertIn('00:00:00,250 --> 00:00:00,750',srt)
  self.assertEqual(windows['transcript']['segments'],t['segments'])
  with self.assertRaisesRegex(ValueError,'transcription'):observed_inputs(t,c,15.,'b'*64)
  bad=copy.deepcopy(c);bad['cues'][0]['end']=float('nan')
  with self.assertRaisesRegex(ValueError,'interval'):observed_inputs(t,bad,15.,'a'*64)
