"""Shorten visual windows around measured speech; never trim or retime audio."""
import argparse,copy,hashlib,json,math
from pathlib import Path


def retime(ccsd,assembly,manifest,audio):
    if ccsd.get('publication_enabled') is not False or assembly.get('publication_enabled') is not False:raise ValueError('Publication must remain disabled')
    digest=hashlib.sha256(Path(audio).read_bytes()).hexdigest()
    if assembly.get('status')!='PASS' or assembly.get('audio_sha256')!=digest:raise ValueError('Passing assembly bound to actual audio required')
    result=copy.deepcopy(ccsd);scenes=sorted(result['scenes'],key=lambda s:s['start']);fps=result['fps']
    if type(fps) is not int or not 1<=fps<=120:raise ValueError('Invalid fps')
    duration=max(s['end'] for s in scenes)
    if abs(duration-assembly['duration'])>.001:raise ValueError('Assembly timeline mismatch')
    if scenes[0]['start']!=0 or any(abs(a['end']-b['start'])>.00001 for a,b in zip(scenes,scenes[1:])):raise ValueError('Contiguous scene timeline required')
    windows=assembly['dialogue'];clips=manifest['clips']
    starts=[i for i,s in enumerate(scenes) if any(d.get('text','').strip() for d in s.get('audio',{}).get('dialogue',[]))]
    if not starts or starts[0]!=0 or len(starts)!=len(windows) or len(clips)!=len(windows):raise ValueError('One clip per dialogue window required')
    cursor=0;provenance=[]
    for n,(index,w,clip) in enumerate(zip(starts,windows,clips)):
        stop=starts[n+1] if n+1<len(starts) else len(scenes)
        section=scenes[index:stop];line=section[0]['audio']['dialogue'][0]
        old_start=section[0]['start'];old_end=section[-1]['end'];old_span=old_end-old_start
        if w['scene_id']!=section[0]['id'] or clip['scene_id']!=w['scene_id'] or clip['audio_sha256']!=w['audio_sha256'] or abs(w['start']-old_start)>1/44100:raise ValueError('Scene clip provenance mismatch')
        if clip['text_sha256']!=hashlib.sha256(line['text'].strip().encode()).hexdigest():raise ValueError('Clip script mismatch')
        measured=w['end']-w['start'];speed=clip['speed']
        if not math.isfinite(measured) or measured<=0 or abs(measured-clip['duration'])>1/44100:raise ValueError('Invalid measured duration')
        if type(speed) not in (int,float) or not math.isfinite(speed) or not 1<=speed<=1.45:raise ValueError('Invalid measured speed')
        line.setdefault('performance',{})['synthesis_speed']=speed
        pause=.6 if n==len(windows)-1 else .4
        frames=min(math.ceil(old_span*fps-1e-8),math.ceil((measured+pause)*fps))
        if frames<len(section) or frames/fps<measured+.03:raise ValueError('Speech cannot fit quantized window without truncation')
        boundaries=[0]
        for j,s in enumerate(section[1:],1):
            desired=round((s['start']-old_start)/old_span*frames)
            boundaries.append(max(boundaries[-1]+1,min(desired,frames-(len(section)-j))))
        boundaries.append(frames)
        for j,s in enumerate(section):s['start']=(cursor+boundaries[j])/fps;s['end']=(cursor+boundaries[j+1])/fps
        provenance.append({'scene_id':w['scene_id'],'original_start':old_start,'original_window_seconds':old_span,'clip_duration_seconds':measured,'audio_sha256':clip['audio_sha256'],'synthesis_speed':speed,'new_start_frame':cursor,'window_frames':frames,'pause_seconds':frames/fps-measured})
        cursor+=frames
    result['scenes']=scenes;result['duration_seconds']=cursor/fps
    result['pacing_repair']={'original_duration_seconds':duration,'revised_duration_seconds':cursor/fps,'fps':fps,'source_assembly_audio_sha256':digest,'summed_clip_duration_seconds':sum(w['end']-w['start'] for w in windows),'method':'Measured unchanged speech plus up to 0.4s interclip pause (rounded to frame); terminal up to 0.6s; original shorter windows preserved within one-frame rounding. Visual shot boundaries proportionally mapped and snapped; no audio truncation or speed changes.','windows':provenance,'requires_reassembly_and_observed_caption_retest':True,'publication_enabled':False}
    return result


def main():
    p=argparse.ArgumentParser()
    for arg in ('ccsd','assembly','manifest','audio','out'):p.add_argument('--'+arg,required=True)
    a=p.parse_args();result=retime(json.loads(Path(a.ccsd).read_text()),json.loads(Path(a.assembly).read_text()),json.loads(Path(a.manifest).read_text()),a.audio)
    Path(a.out).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'original':result['pacing_repair']['original_duration_seconds'],'revised':result['duration_seconds']}))
if __name__=='__main__':main()
