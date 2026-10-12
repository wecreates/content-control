"""Map existing Episode 3 caption windows to locked speakers for free synthesis."""
import argparse,json,math
from pathlib import Path
try:
 from scripts.free_transcription_qa import norm
 from scripts.v2_free_voice import VOICE_ASSIGNMENTS
except ModuleNotFoundError:
 from free_transcription_qa import norm
 from v2_free_voice import VOICE_ASSIGNMENTS

def build_plan(dialogue,contract):
 if dialogue.get('publication_enabled') is not False or contract.get('publication_enabled') is not False:raise ValueError('Publication must remain disabled')
 words=[];owners=[]
 for segment in dialogue.get('segments',[]):
  speaker=segment.get('speaker');tokens=norm(segment.get('text','')).split()
  if speaker not in VOICE_ASSIGNMENTS or not tokens:raise ValueError('Nonempty dialogue and locked free speaker required')
  words.extend(tokens);owners.extend([speaker]*len(tokens))
 if not words or words!=norm(contract.get('narration_text','')).split():raise ValueError('Dialogue differs from factual narration contract')
 scenes=[];offset=0;previous_end=0
 for i,cue in enumerate(contract.get('caption_cues',[])):
  start,end=cue.get('start'),cue.get('end');tokens=norm(cue.get('text','')).split()
  if any(type(t) not in (int,float) or not math.isfinite(t) for t in (start,end)) or abs(start-previous_end)>1e-6 or not 0<=start<end<=30:raise ValueError('Caption windows must continuously cover the 30-second episode')
  if not tokens or tokens!=words[offset:offset+len(tokens)]:raise ValueError('Caption text differs from ordered dialogue')
  speakers=set(owners[offset:offset+len(tokens)])
  if len(speakers)!=1:raise ValueError('A caption window crosses speakers')
  scenes.append({'id':f'episode3-cue-{i+1}','start':start,'end':end,'audio':{'dialogue':[{'speaker':speakers.pop(),'text':cue['text']}]}})
  offset+=len(tokens);previous_end=end
 if offset!=len(words) or previous_end!=30:raise ValueError('Incomplete dialogue or timeline coverage')
 return {'project_id':'episode3-cashback-casino','publication_enabled':False,'fps':30,'scenes':scenes,'scope':'Original dialogue and authored timing, not observed speech alignment or creative approval'}

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--dialogue',required=True);p.add_argument('--contract',required=True);p.add_argument('--out',required=True);a=p.parse_args()
 result=build_plan(json.loads(Path(a.dialogue).read_text()),json.loads(Path(a.contract).read_text()))
 out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({'status':'PASS','windows':len(result['scenes']),'publication_enabled':False}))
