"""Observe each assembled speech window independently; never infer missing words."""
import argparse, hashlib, json, math
from pathlib import Path
try:
 from scripts.free_transcription_qa import decode_transcription_audio, norm
except ModuleNotFoundError:
 from free_transcription_qa import decode_transcription_audio, norm

def transcribe_windows(ccsd, receipt, audio, samples, observe):
 digest=hashlib.sha256(Path(audio).read_bytes()).hexdigest()
 if ccsd.get('publication_enabled') is not False or receipt.get('publication_enabled') is not False:raise ValueError('Publication must remain disabled')
 if receipt.get('status')!='PASS' or receipt.get('audio_sha256')!=digest:raise ValueError('Passing assembly receipt for exact audio required')
 expected=[(s,d) for s in sorted(ccsd['scenes'],key=lambda s:s['start']) for d in s.get('audio',{}).get('dialogue',[]) if d.get('text','').strip()]
 windows=receipt.get('dialogue',[])
 if not expected or len(windows)!=len(expected):raise ValueError('Exactly one assembly window per dialogue required')
 duration=len(samples)/16000
 if not math.isfinite(receipt.get('duration',float('nan'))) or abs(duration-receipt['duration'])>.001:raise ValueError('Assembly duration mismatch')
 # Validate all windows before invoking the model.
 previous=0
 for (scene,line),window in zip(expected,windows):
  start,end=window.get('start'),window.get('end')
  if window.get('scene_id')!=scene['id'] or window.get('speaker')!=line['speaker']:raise ValueError('Assembly scene or speaker mismatch')
  if any(type(t) not in (int,float) or not math.isfinite(t) for t in (start,end)) or not previous<=start<end<=duration or abs(start-scene['start'])>1/44100:raise ValueError('Invalid assembly speech window')
  previous=end
 words=[];observations=[]
 for (scene,line),window in zip(expected,windows):
  first=round(window['start']*16000);last=round(window['end']*16000)
  local=list(observe(samples[first:last]))
  if not local or norm(' '.join(w['word'] for w in local))!=norm(line['text']):raise ValueError('Observed words differ from script: '+scene['id']+'; expected='+repr(norm(line['text']))+'; observed='+repr(norm(' '.join(w['word'] for w in local))))
  previous=0
  for w in local:
   start,end=w.get('start'),w.get('end')
   if any(type(t) not in (int,float) or not math.isfinite(t) for t in (start,end)) or not previous<=start<=end<=(last-first)/16000:raise ValueError('Observed word outside speech window: '+scene['id'])
   words.append({**w,'start':start+first/16000,'end':end+first/16000,'scene_id':scene['id'],'speaker':line['speaker']})
   previous=end
  observations.append({'scene_id':scene['id'],'speaker':line['speaker'],'sample_start':first,'sample_end':last,'sample_rate':16000,'actual_transcript':' '.join(w['word'] for w in local)})
 return {'schema_version':1,'status':'PASS','publication_enabled':False,'word_timestamps':True,'audio_sha256':digest,'words':words,'windows':observations,'actual_transcript':' '.join(w['word'] for w in words),'timing_source':'Independent ASR on decoded assembly windows; original observed times plus exact sample offset','scope':'Exact normalized text and speech-window bounds; ASR accuracy and full audiovisual review remain separate'}

def main():
 p=argparse.ArgumentParser()
 for arg in ('ccsd','assembly','audio','out'):p.add_argument('--'+arg,required=True)
 p.add_argument('--model',default='small.en');a=p.parse_args()
 try:
  from faster_whisper import WhisperModel
  samples,_=decode_transcription_audio(a.audio)
  model=WhisperModel(a.model,device='cpu',compute_type='int8')
  def observe(clip):
   segments,_=model.transcribe(clip,language='en',beam_size=5,word_timestamps=True,vad_filter=False,condition_on_previous_text=False)
   return [{'word':w.word,'start':float(w.start),'end':float(w.end),'probability':float(w.probability)} for s in segments for w in (s.words or [])]
  result=transcribe_windows(json.loads(Path(a.ccsd).read_text()),json.loads(Path(a.assembly).read_text()),a.audio,samples,observe)
  result.update(engine='faster-whisper',model=a.model)
 except (ValueError,KeyError,TypeError,OSError,RuntimeError) as e:result={'status':'BLOCKED','publication_enabled':False,'words':[],'reason':str(e)}
 out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({'status':result['status'],'words':len(result['words']),'reason':result.get('reason')}))
 return 0 if result['status']=='PASS' else 2
if __name__=='__main__':raise SystemExit(main())
