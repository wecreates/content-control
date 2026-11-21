"""Local CPU Kokoro generation; official open weights, no paid inference provider.
Docs: https://github.com/hexgrad/kokoro
Voices: https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md
"""
import argparse
import hashlib
import json
import math
import os
import shutil
from pathlib import Path
import struct
import subprocess
import tempfile
import wave

VOICE_ASSIGNMENTS={'dave':'am_fenrir','points_monk':'am_michael','narrator':'am_adam'}
MODEL_REPO='hexgrad/Kokoro-82M'
# Canonical v1.0 assets; not the separate q8 audition model.
# https://huggingface.co/hexgrad/Kokoro-82M/tree/f3ff3571791e39611d31c381e3a41a3af07b4987
# LFS SHA-256/size metadata plus independently hashed config.json.
MODEL_REVISION='f3ff3571791e39611d31c381e3a41a3af07b4987'
MODEL_ASSETS={
    'config.json':(2351,'5abb01e2403b072bf03d04fde160443e209d7a0dad49a423be15196b9b43c17f'),
    'kokoro-v1_0.pth':(327212226,'496dba118d1a58f5f3db2efc88dbdc216e0483fc89fe6e47ee1f2c53f18ad1e4'),
    'voices/am_adam.pt':(523420,'ced7e284aba12472891be1da3ab34db84cc05cc02b5889535796dbf2d8b0cb34'),
    'voices/am_fenrir.pt':(523430,'98e507eca1db08230ae3b6232d59c10aec9630022d19accac4f5d12fcec3c37a'),
    'voices/am_michael.pt':(523435,'9a443b79a4b22489a5b0ab7c651a0bcd1a30bef675c28333f06971abbd47bd37'),
}


def model_identity():
    return {'model_revision':MODEL_REVISION,
            'model_asset_sha256':{name:value[1] for name,value in MODEL_ASSETS.items()}}


def pinned_assets(download=None):
    """Resolve explicit immutable assets and verify bytes before deserialization."""
    if download is None:
        from huggingface_hub import hf_hub_download
        download=hf_hub_download
    paths={}
    for name,(size,expected) in MODEL_ASSETS.items():
        path=Path(download(repo_id=MODEL_REPO,filename=name,revision=MODEL_REVISION))
        digest=hashlib.sha256()
        with path.open('rb') as source:
            if os.fstat(source.fileno()).st_size!=size:raise ValueError('Pinned Kokoro asset size mismatch: '+name)
            for block in iter(lambda:source.read(1024*1024),b''):digest.update(block)
        if digest.hexdigest()!=expected:raise ValueError('Pinned Kokoro asset hash mismatch: '+name)
        paths[name]=str(path)
    return paths


MAX_SPEED=1.45


def sha(file):return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def local_synthesizer():
    # Lazy import keeps tests independent from heavyweight model downloads.
    from kokoro import KModel,KPipeline
    assets=pinned_assets()
    model=KModel(repo_id=MODEL_REPO,config=assets['config.json'],model=assets['kokoro-v1_0.pth']).to('cpu').eval()
    pipeline=KPipeline(lang_code='a',repo_id=MODEL_REPO,model=model,device='cpu')
    # Passing verified local tensors avoids KPipeline's unpinned voice-name fetch.
    voices={voice:pipeline.load_voice(assets[f'voices/{voice}.pt']) for voice in VOICE_ASSIGNMENTS.values()}
    def synth(text,voice,speed):
        samples=[]
        for _,_,audio in pipeline(text,voice=voices[voice],speed=speed,split_pattern=r'\n+'):
            samples.extend(audio.detach().cpu().numpy().reshape(-1).tolist())
        return samples,24000
    return synth


def cached_clips(out):
    """Only trust identity metadata from the prior successfully staged manifest."""
    try:
        old=json.loads((out/'approved-manifest.json').read_text())
        if (not isinstance(old,dict) or old.get('publication_enabled') is not False or old.get('provider')!='kokoro'
                or old.get('model_id')!='Kokoro-82M' or old.get('model_repository')!=MODEL_REPO
                or old.get('voice_assignments')!=VOICE_ASSIGNMENTS
                or old.get('generator_sha256')!=sha(__file__)
                or any(old.get(k)!=v for k,v in model_identity().items())):return {}
        result={}
        for clip in old['clips']:
            requested=clip.get('requested_speed')
            if isinstance(requested,bool) or not isinstance(requested,(int,float)) or not 1<=requested<=MAX_SPEED or not math.isfinite(requested):return {}
            key=(clip['scene_id'],clip['speaker'],clip['text_sha256'],clip['voice_id'])
            if key in result:return {}  # Ambiguous provenance is not reusable.
            result[key]=clip
        return result
    except (OSError,ValueError,KeyError,TypeError,AttributeError):return {}


def reuse_clip(out,stage,name,clip,window):
    """Recheck bytes, PCM audibility and the *current* timing window."""
    try:
        source=out/clip['file']
        if source.parent!=out or source.is_symlink() or sha(source)!=clip['audio_sha256']:return None
        speed=float(clip['speed'])
        if not math.isfinite(speed) or not 1<=speed<=MAX_SPEED:return None
        with wave.open(str(source),'rb') as w:
            if (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getcomptype())!=(2,2,44100,'NONE'):return None
            frames=w.getnframes();data=w.readframes(frames);seconds=frames/44100
        if not frames or len(data)!=frames*4 or seconds>window-.03:return None
        samples=struct.unpack('<'+'h'*(len(data)//2),data)
        if math.sqrt(sum(v*v for v in samples)/len(samples))/32767<.001:return None
        target=stage/name;shutil.copyfile(source,target)
        if sha(target)!=clip['audio_sha256']:return None
        return dict(clip,file=name,duration=seconds,window_seconds=window,reused=True,attempts=0)
    except (OSError,ValueError,OverflowError,KeyError,TypeError,wave.Error,EOFError):return None


def generate(ccsd,out_dir,synth=None):
    if ccsd.get('publication_enabled') is not False:raise ValueError('Publication must remain disabled')
    scenes=sorted(ccsd.get('scenes',[]),key=lambda s:float(s['start']))
    if not scenes:raise ValueError('Scenes required')
    duration=max(float(s['end']) for s in scenes)
    if not math.isfinite(duration) or not 0<duration<=600:raise ValueError('Invalid timeline duration')
    dialogue=[]
    for s in scenes:
        if not math.isfinite(float(s['start'])) or not 0<=float(s['start'])<float(s['end'])<=duration:raise ValueError('Invalid scene times')
        entries=[d for d in s.get('audio',{}).get('dialogue',[]) if d.get('text','').strip()]
        if len(entries)>1:raise ValueError('One timed dialogue per scene required')
        for d in entries:
            if d.get('speaker') not in VOICE_ASSIGNMENTS:raise ValueError('Speaker has no approved free voice assignment')
            if len(d['text'])>3000:raise ValueError('Dialogue too long')
            requested=d.get('performance',{}).get('synthesis_speed',1.0)
            if isinstance(requested,bool) or not isinstance(requested,(int,float)) or not 1<=requested<=MAX_SPEED or not math.isfinite(requested):raise ValueError('Invalid synthesis speed')
            dialogue.append((s,d))
    if not dialogue:raise ValueError('No dialogue to synthesize')
    windows=[]
    for i,(s,d) in enumerate(dialogue):
        window=(float(dialogue[i+1][0]['start']) if i+1<len(dialogue) else duration)-float(s['start'])
        if window<=.08:raise ValueError('Dialogue windows overlap or are too short')
        windows.append(window)
    out=Path(out_dir).resolve();out.mkdir(parents=True,exist_ok=True)
    previous=cached_clips(out)
    manifest={'schema_version':1,'publication_enabled':False,'provider':'kokoro','model_id':'Kokoro-82M','model_repository':MODEL_REPO,**model_identity(),'generator_sha256':sha(__file__),'device':'cpu','voice_assignments':dict(VOICE_ASSIGNMENTS),'clips':[],'provider_calls':0,'status':'GENERATED_PENDING_LISTENING_REVIEW','scope':'Local synthesis, declared stock voice assignment, timing and file integrity; transcript/listening quality requires review'}
    # Manifest is committed only after every clip succeeds; no partial success claim.
    with tempfile.TemporaryDirectory(prefix='.voice-build-',dir=out) as temp:
        stage=Path(temp)
        for i,((scene,d),window) in enumerate(zip(dialogue,windows)):
            text=d['text'].strip();voice=VOICE_ASSIGNMENTS[d['speaker']];speed=d.get('performance',{}).get('synthesis_speed',1.0)
            name=f'{i:02d}-{d["speaker"]}.wav'
            key=(scene['id'],d['speaker'],hashlib.sha256(text.encode()).hexdigest(),voice)
            cached=previous.get(key)
            # Requested speed identifies the take; speed may differ after bounded auto-fit.
            if cached and cached.get('requested_speed')!=speed:cached=None
            reused=reuse_clip(out,stage,name,cached,window) if cached else None
            if reused:
                manifest['clips'].append(reused)
                continue
            if synth is None:synth=local_synthesizer()
            requested_speed=speed
            for attempt in range(3):
                samples,rate=synth(text,voice,speed)
                if not isinstance(rate,int) or rate<8000 or rate>96000 or not len(samples):raise ValueError('Invalid synthesized audio')
                if any(not math.isfinite(float(v)) or abs(float(v))>1 for v in samples):raise ValueError('Invalid synthesized samples')
                rms=math.sqrt(sum(float(v)**2 for v in samples)/len(samples))
                if rms<.001:raise ValueError('Synthesized audio silent')
                seconds=len(samples)/rate
                if seconds<=window-.03:break
                if speed>=MAX_SPEED or attempt==2:raise ValueError(f'Dialogue cannot fit bounded speed without truncation: {scene["id"]}')
                speed=min(MAX_SPEED,max(speed+.08,speed*seconds/(window-.04)*1.02))
            raw=stage/f'{i:02d}-raw.wav';target=stage/f'{i:02d}-{d["speaker"]}.wav'
            with wave.open(str(raw),'wb') as w:
                w.setparams((1,2,rate,0,'NONE','not compressed'));w.writeframes(struct.pack('<'+'h'*len(samples),*[round(float(v)*32767) for v in samples]))
            process=subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-i',str(raw),'-ar','44100','-ac','2','-c:a','pcm_s16le',str(target)],capture_output=True,text=True,timeout=60)
            if process.returncode:raise ValueError('PCM conversion failed: '+process.stderr[-500:])
            with wave.open(str(target),'rb') as w:
                output_duration=w.getnframes()/w.getframerate()
                if (w.getnchannels(),w.getsampwidth(),w.getframerate())!=(2,2,44100) or output_duration>window:raise ValueError('Converted clip violates timeline')
            manifest['clips'].append({'scene_id':scene['id'],'speaker':d['speaker'],'voice_id':voice,'file':target.name,'text_sha256':hashlib.sha256(text.encode()).hexdigest(),'audio_sha256':sha(target),'duration':output_duration,'window_seconds':window,'requested_speed':requested_speed,'speed':speed,'attempts':attempt+1,'reused':False})
        for clip in manifest['clips']:os.replace(stage/clip['file'],out/clip['file'])
        staged_manifest=stage/'manifest.json';staged_manifest.write_text(json.dumps(manifest,indent=2)+'\n');os.replace(staged_manifest,out/'approved-manifest.json')
    return manifest


def main():
    p=argparse.ArgumentParser();p.add_argument('--ccsd',required=True);p.add_argument('--out-dir',required=True);p.add_argument('--receipt');a=p.parse_args()
    try:r=generate(json.loads(Path(a.ccsd).read_text()),a.out_dir);code=0
    except (ValueError,OSError,KeyError,ImportError,RuntimeError,subprocess.TimeoutExpired) as e:r={'status':'BLOCKED','reason':str(e),'publication_enabled':False,'provider_calls':0};code=2
    if a.receipt:target=Path(a.receipt);target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(r,indent=2)+'\n')
    print(json.dumps(r));return code
if __name__=='__main__':raise SystemExit(main())
