"""Bounded independent ASR retry for exact mismatches; never interpolate words."""
import argparse,copy,difflib,hashlib,json,math
from pathlib import Path
try:
 from scripts.free_transcription_qa import norm,decode_transcription_audio,spoken_number_suppression
except ModuleNotFoundError:
 from free_transcription_qa import norm,decode_transcription_audio,spoken_number_suppression


def repair(ccsd,report,assembly,audio,samples,observe):
 digest=hashlib.sha256(Path(audio).read_bytes()).hexdigest()
 if any(x.get('publication_enabled') is not False for x in (ccsd,report,assembly)):raise ValueError('Publication must remain disabled')
 if any(x.get('status')!='PASS' or x.get('audio_sha256')!=digest for x in (report,assembly)):raise ValueError('Passing reports bound to actual audio required')
 if abs(len(samples)/16000-assembly['duration'])>.001:raise ValueError('Decoded duration mismatch')
 scenes=[s for s in sorted(ccsd['scenes'],key=lambda s:s['start']) if s.get('audio',{}).get('dialogue')]
 windows=assembly['dialogue']
 if len(scenes)!=len(windows):raise ValueError('Assembly windows differ from script')
 expected=[];ranges=[]
 for scene,w in zip(scenes,windows):
  if scene['id']!=w['scene_id'] or abs(scene['start']-w['start'])>1/44100 or len(scene['audio']['dialogue'])!=1:raise ValueError('Window provenance mismatch')
  line=scene['audio']['dialogue'][0];start=len(expected);expected.extend(norm(line['text']).split());ranges.append((start,len(expected)))
 actual=[];boundaries={0:0}
 for i,word in enumerate(report['words']):actual.extend(norm(word['word']).split());boundaries[len(actual)]=i+1
 ops=difflib.SequenceMatcher(None,expected,actual,autojunk=False).get_opcodes()
 affected=set()
 for tag,i,j,k,l in ops:
  if tag!='equal':
   for n,(start,end) in enumerate(ranges):
    if max(start,i)<min(end,j) or i==j and start<=i<=end:affected.add(n)
 if not affected:return copy.deepcopy(report)
 def mapped_boundary(index):
  choices={k+index-i for tag,i,j,k,l in ops if tag=='equal' and i<=index<=j}
  if index==0:choices.add(0)
  if index==len(expected):choices.add(len(actual))
  if len(choices)!=1:raise ValueError('Ambiguous scene alignment boundary')
  mapped=choices.pop()
  if mapped not in boundaries:raise ValueError('Cannot split observed token at scene boundary')
  return boundaries[mapped]
 replacements=[];proof=[]
 for n in sorted(affected):
  scene,w=scenes[n],windows[n];line=scene['audio']['dialogue'][0]
  first,last=round(w['start']*16000),round(w['end']*16000)
  if not 0<=first<last<=len(samples):raise ValueError('Invalid crop sample bounds')
  crop=samples[first:last];local=list(observe(crop))
  if norm(' '.join(x['word'] for x in local))!=norm(line['text']):raise ValueError('Independent crop still differs: '+scene['id'])
  previous=0;absolute=[]
  for word in local:
   start,end=word.get('start'),word.get('end')
   if any(type(t) not in (int,float) or not math.isfinite(t) for t in (start,end)) or not previous<=start<=end<=len(crop)/16000:raise ValueError('Observed crop time outside actual samples')
   absolute.append({**word,'start':start+first/16000,'end':end+first/16000,'scene_id':scene['id'],'speaker':line['speaker']});previous=end
  lo,hi=map(mapped_boundary,ranges[n]);replacements.append((lo,hi,absolute))
  proof.append({'scene_id':scene['id'],'audio_sha256':digest,'sample_rate':16000,'sample_start':first,'sample_end':last,'decoded_crop_sha256':hashlib.sha256(crop.tobytes()).hexdigest(),'original_observed_word_range':[lo,hi],'original_observed_words':report['words'][lo:hi],'local_observed_words':local,'actual_transcript':' '.join(x['word'] for x in local),'absolute_offset_seconds':first/16000})
 words=copy.deepcopy(report['words'])
 for lo,hi,absolute in reversed(replacements):words[lo:hi]=absolute
 if [w for x in words for w in norm(x['word']).split()]!=expected:raise ValueError('Repaired full transcript does not exactly match')
 previous=0
 for w in words:
  if not previous<=w['start']<=w['end']<=len(samples)/16000:raise ValueError('Repaired observed intervals overlap')
  previous=w['end']
 result=copy.deepcopy(report);result['original_full_transcription']=copy.deepcopy(report);result['words']=words;result['actual_transcript']=' '.join(x['word'] for x in words);result['segments']=[{'start':x['start'],'end':x['end'],'text':x['word']} for x in words]
 result['sequence_similarity']=1.0;result['content_token_recall']=1.0
 result['recognition_repair']={'status':'PASS','method':'Independent whole-scene ASR of actual decoded samples; no expected-text prompt; absolute timestamps are observed crop times plus exact sample offset','exact_normalized_match':True,'windows':proof,'publication_enabled':False}
 return result


def main():
 p=argparse.ArgumentParser()
 for name in ('ccsd','transcription','assembly','audio','out'):p.add_argument('--'+name,required=True)
 p.add_argument('--model',default='medium.en');a=p.parse_args()
 from faster_whisper import WhisperModel
 samples,_=decode_transcription_audio(a.audio);model=None
 def observe(crop):
  nonlocal model
  if model is None:model=WhisperModel(a.model,device='cpu',compute_type='int8')
  segments,_=model.transcribe(crop,language='en',beam_size=5,word_timestamps=True,vad_filter=False,condition_on_previous_text=False,suppress_tokens=spoken_number_suppression(model.hf_tokenizer))
  return [{'word':w.word,'start':float(w.start),'end':float(w.end),'probability':float(w.probability)} for s in segments for w in (s.words or [])]
 result=repair(json.loads(Path(a.ccsd).read_text()),json.loads(Path(a.transcription).read_text()),json.loads(Path(a.assembly).read_text()),a.audio,samples,observe)
 if 'recognition_repair' in result:result['recognition_repair'].update(model=a.model,engine='faster-whisper',spoken_number_decoding=True)
 Path(a.out).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'status':result['status'],'reobserved_windows':len(result.get('recognition_repair',{}).get('windows',[]))}))
if __name__=='__main__':main()
