"""Original-script captions aligned strictly to observed local Whisper word times.

Never estimate timestamps or reveal words before their observed start. Progressive
phrases contain at most three original words, preserving punctuation and speaker.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path
try:
    from scripts.free_transcription_qa import norm
except ModuleNotFoundError:
    from free_transcription_qa import norm


def enforce_frame_visibility(cues,expected,fps,duration):
    """Mirror ObservedCaptions.mjs's 0.12s hold, capped by the next cue."""
    if isinstance(fps,bool) or not isinstance(fps,(int,float)) or not math.isfinite(fps) or not 1<=fps<=120:raise ValueError('Invalid caption frame rate')
    pending=[];visible=set();counts=[]
    for i,cue in enumerate(cues):
        until=min(cue['end']+.12,cues[i+1]['start'] if i+1<len(cues) else duration,duration)
        first=math.ceil(cue['start']*fps)
        count=max(0,math.ceil(until*fps)-first)
        counts.append(count)
        if not count:
            pending.extend(cue['source_word_indices'])
            continue
        if pending:
            if any(expected[j]['scene_id']!=cue['scene_id'] or expected[j]['speaker']!=cue['speaker'] for j in pending):raise ValueError('Frame-invisible word cannot cross scene or speaker boundary')
            indices=sorted(set(pending+cue['display_word_indices']))
            required=set(pending+cue['source_word_indices'])
            if len(required)>3:raise ValueError('Frame-invisible words exceed short phrase capacity')
            # Previously visible context can yield space to an unheard-on-screen word.
            if len(indices)>3:indices=sorted(required)
            cue['display_word_indices']=indices
            cue['text']=' '.join(expected[j]['original'] for j in indices)
            cue['deferred_frame_invisible_indices']=list(pending)
            pending=[]
        visible.update(cue['display_word_indices'])
    if pending:raise ValueError('Terminal frame-invisible word lacks a following visible interval')
    missing=sorted(set(range(len(expected)))-visible)
    if missing:raise ValueError('Original words missing from rendered frame visibility: '+str(missing))
    return {'status':'PASS','fps':fps,'expected_word_count':len(expected),'visible_word_count':len(visible),'missing_word_indices':missing,'cue_frame_counts':counts,'display_hold_seconds':.12,'method':'Exact frame lattice with next-cue-capped display hold; observed timestamps unchanged'}


def coalesce_numeric_tokens(actual):
    """Join only adjacent numeric notation fragments, retaining actual intervals."""
    result=[];previous_end=0
    for i,token in enumerate(actual):
        item=dict(token);item['observed_token_indices']=[i]
        start,end=item.get('start'),item.get('end')
        if any(isinstance(t,bool) or not isinstance(t,(int,float)) or not math.isfinite(t) for t in (start,end)):raise ValueError('Observed word times missing or invalid')
        if start<previous_end or end<start:raise ValueError('Observed word timings overlap or leave media bounds')
        previous_end=end
        text=item.get('word','').strip()
        previous=result[-1] if result else None
        prefix=previous.get('word','').strip() if previous else ''
        numeric_prefix=bool(re.fullmatch(r'\$?[+-]?\d+(?:,\d{3})*(?:\.\d+)?',prefix))
        numeric_suffix=bool(re.fullmatch(r'(?:,\d{3}|\.\d+)(?:[%.,!?])?|%[.,!?]?',text))
        # No overlap or inserted timing: only touching observed intervals qualify.
        if previous and numeric_prefix and numeric_suffix and isinstance(previous.get('end'),(int,float)) and isinstance(item.get('start'),(int,float)) and abs(previous['end']-item['start'])<1e-6:
            previous['word']=prefix+text
            previous['end']=item.get('end')
            previous['observed_token_indices'].append(i)
        else:
            result.append(item)
    return result


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
                if not token:raise ValueError('Script token has no normalized speech')
                expected.append({'original':raw,'normalized':token,'speaker':line['speaker'],'scene_id':scene['id']})
    actual=coalesce_numeric_tokens(transcription.get('words',[]))
    if not expected or not actual:raise ValueError('Observed word count does not exactly match script')
    # Match the entire normalized sequence exactly, then join only at boundaries
    # shared by source tokens and observed tokens. Never split ASR intervals.
    normalized=[];previous_end=0
    for observed in actual:
        start,end=observed.get('start'),observed.get('end')
        if any(isinstance(t,bool) or not isinstance(t,(int,float)) or not math.isfinite(t) for t in (start,end)):raise ValueError('Observed word times missing or invalid')
        if not 0<=start<=end<=duration or start<previous_end:raise ValueError('Observed word timings overlap or leave media bounds')
        words=norm(observed.get('word','')).split()
        if not words:raise ValueError('Observed token has no normalized speech')
        normalized.append(words);previous_end=end
    if [w for source in expected for w in source['normalized']] != [w for words in normalized for w in words]:
        raise ValueError('Observed word mismatch: exact normalized sequence required')
    source_ends={};observed_ends={};total=0
    for i,source in enumerate(expected):
        total+=len(source['normalized']);source_ends[total]=i
    total=0
    for j,words in enumerate(normalized):
        total+=len(words);observed_ends[total]=j
    groups=[];si=oi=0
    for boundary in sorted(source_ends.keys() & observed_ends.keys()):
        last_source,last_observed=source_ends[boundary],observed_ends[boundary]
        indices=list(range(si,last_source+1));observed_indices=[index for token in actual[oi:last_observed+1] for index in token['observed_token_indices']]
        if len(indices)>3:raise ValueError('Normalized group exceeds short phrase capacity')
        source=expected[last_source]
        if any(expected[k]['scene_id']!=source['scene_id'] or expected[k]['speaker']!=source['speaker'] for k in indices):
            raise ValueError('Normalized group cannot cross scene or speaker boundary')
        # Delay joined source tokens until the final observed token starts. Earlier
        # subwords have already been heard; all times remain actual ASR boundaries.
        groups.append((indices,observed_indices,actual[last_observed]['start'],actual[last_observed]['end']))
        si,oi=last_source+1,last_observed+1
    cues=[];phrase=[];phrase_indices=[];pending=[]
    for indices,observed_indices,start,end in groups:
        i=indices[-1];source=expected[i]
        if pending and any(expected[j]['scene_id']!=source['scene_id'] or expected[j]['speaker']!=source['speaker'] for j in pending):
            raise ValueError('Zero-duration word cannot cross scene or speaker boundary')
        if start==end:
            pending.extend(indices)
            if len(pending)>2:raise ValueError('Too many zero-duration words for a short observed phrase')
            previous_end=end
            continue
        fresh=[expected[j]['original'] for j in pending+indices]
        if len(fresh)>3:raise ValueError('Normalized group with deferred words exceeds short phrase capacity')
        first=indices[0]
        boundary=first and (expected[first-1]['scene_id']!=source['scene_id'] or expected[first-1]['speaker']!=source['speaker'] or expected[first-1]['original'].endswith(('.', '?', '!')))
        if pending or not phrase or boundary:
            phrase=[]
            phrase_indices=[]
        # Keep recently spoken context when the window fills. Resetting every
        # third word made brief words (including the 'two' in 'two hundred ten')
        # vanish after a single frame. Never reveal future words or cross roles.
        while len(phrase)+len(fresh)>3:
            phrase.pop(0)
            phrase_indices.pop(0)
        phrase.extend(fresh)
        phrase_indices.extend(pending+indices)
        cues.append({'start':start,'end':end,'text':' '.join(phrase),'word':' '.join(fresh),'speaker':source['speaker'],'scene_id':source['scene_id'],'observed_word_index':i,'source_word_indices':pending+indices,'observed_token_indices':observed_indices,'display_word_indices':list(phrase_indices),'deferred_zero_duration_indices':list(pending)})
        pending=[]
        previous_end=end
    if pending:raise ValueError('Terminal zero-duration word lacks a following observed interval')
    visibility=enforce_frame_visibility(cues,expected,ccsd.get('fps',24),duration)
    return {'frame_visibility':visibility,'schema_version':1,'status':'PASS','publication_enabled':False,'source_audio_sha256':digest,'timing_source':'faster-whisper observed words; no timing interpolation','display_mode':'rolling_phrase_max_3_words','cues':cues,'scope':'Exact normalized word alignment and observed timing bounds; does not certify ASR alignment accuracy or rendered readability'}


def main():
    p=argparse.ArgumentParser();p.add_argument('--ccsd',required=True);p.add_argument('--transcription',required=True);p.add_argument('--audio',required=True);p.add_argument('--out',required=True);a=p.parse_args()
    try:r=build_captions(json.loads(Path(a.ccsd).read_text()),json.loads(Path(a.transcription).read_text()),a.audio);code=0
    except (ValueError,OSError,KeyError,TypeError) as e:r={'status':'BLOCKED','reason':str(e),'publication_enabled':False,'cues':[]};code=2
    target=Path(a.out);target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'status':r['status'],'cues':len(r.get('cues',[])),'reason':r.get('reason')}));return code
if __name__=='__main__':raise SystemExit(main())
