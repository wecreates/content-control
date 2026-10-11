"""Original-script captions aligned strictly to observed local Whisper word times.

Never estimate timestamps or reveal words before their observed start. Progressive
phrases contain at most three original words, preserving punctuation and speaker.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
try:
    from scripts.free_transcription_qa import norm
except ModuleNotFoundError:
    from free_transcription_qa import norm


def build_captions(ccsd,transcription,audio):
    if ccsd.get('publication_enabled') is not False or transcription.get('publication_enabled') is not False:raise ValueError('Publication must remain disabled')
    if transcription.get('status')!='PASS' or transcription.get('word_timestamps') is not True:raise ValueError('Passing observed word transcription required')
    digest=hashlib.sha256(Path(audio).read_bytes()).hexdigest()
    if digest!=transcription.get('audio_sha256'):raise ValueError('Transcription audio hash mismatch')
    scenes=sorted(ccsd.get('scenes',[]),key=lambda s:float(s['start']))
    duration=max(float(s['end']) for s in scenes)
    if not math.isfinite(duration) or duration<=0:raise ValueError('Invalid timeline duration')
    expected=[]
    for scene in scenes:
        for line in scene.get('audio',{}).get('dialogue',[]):
            for raw in line.get('text','').split():
                token=norm(raw).split()
                if len(token)!=1:raise ValueError('Ambiguous script token requires explicit word alignment')
                expected.append({'original':raw,'normalized':token[0],'speaker':line['speaker'],'scene_id':scene['id']})
    actual=transcription.get('words',[])
    if not expected or len(actual)!=len(expected):raise ValueError('Observed word count does not exactly match script')
    cues=[];phrase=[];previous_end=0;pending=[]
    for i,(source,observed) in enumerate(zip(expected,actual)):
        start,end=observed.get('start'),observed.get('end')
        if norm(observed.get('word',''))!=source['normalized']:raise ValueError(f'Observed word mismatch at index {i}')
        if any(isinstance(t,bool) or not isinstance(t,(int,float)) or not math.isfinite(t) for t in (start,end)):raise ValueError('Observed word times missing or invalid')
        if not 0<=start<=end<=duration or start<previous_end:raise ValueError('Observed word timings overlap or leave media bounds')
        if pending and any(expected[j]['scene_id']!=source['scene_id'] or expected[j]['speaker']!=source['speaker'] for j in pending):
            raise ValueError('Zero-duration word cannot cross scene or speaker boundary')
        if start==end:
            pending.append(i)
            if len(pending)>2:raise ValueError('Too many zero-duration words for a short observed phrase')
            previous_end=end
            continue
        fresh=[expected[j]['original'] for j in pending]+[source['original']]
        boundary=i and (expected[i-1]['scene_id']!=source['scene_id'] or expected[i-1]['speaker']!=source['speaker'] or expected[i-1]['original'].endswith(('.', '?', '!')))
        if pending or not phrase or len(phrase)+len(fresh)>3 or boundary:
            phrase=[]
        phrase.extend(fresh)
        cues.append({'start':start,'end':end,'text':' '.join(phrase),'word':' '.join(fresh),'speaker':source['speaker'],'scene_id':source['scene_id'],'observed_word_index':i,'source_word_indices':pending+[i],'deferred_zero_duration_indices':list(pending)})
        pending=[]
        previous_end=end
    if pending:raise ValueError('Terminal zero-duration word lacks a following observed interval')
    return {'schema_version':1,'status':'PASS','publication_enabled':False,'source_audio_sha256':digest,'timing_source':'faster-whisper observed words; no timing interpolation','display_mode':'progressive_phrase_max_3_words','cues':cues,'scope':'Exact normalized word alignment and observed timing bounds; does not certify ASR alignment accuracy or rendered readability'}


def main():
    p=argparse.ArgumentParser();p.add_argument('--ccsd',required=True);p.add_argument('--transcription',required=True);p.add_argument('--audio',required=True);p.add_argument('--out',required=True);a=p.parse_args()
    try:r=build_captions(json.loads(Path(a.ccsd).read_text()),json.loads(Path(a.transcription).read_text()),a.audio);code=0
    except (ValueError,OSError,KeyError,TypeError) as e:r={'status':'BLOCKED','reason':str(e),'publication_enabled':False,'cues':[]};code=2
    target=Path(a.out);target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'status':r['status'],'cues':len(r.get('cues',[])),'reason':r.get('reason')}));return code
if __name__=='__main__':raise SystemExit(main())
