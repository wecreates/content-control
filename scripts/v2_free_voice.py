"""Local CPU Kokoro generation; official open weights, no paid inference provider.
Docs: https://github.com/hexgrad/kokoro
Voices: https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import subprocess
import tempfile
import wave

VOICE_ASSIGNMENTS={'dave':'am_fenrir','points_monk':'am_michael','narrator':'am_adam'}
MODEL_REPO='hexgrad/Kokoro-82M'
MAX_SPEED=1.45


def sha(file):return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def local_synthesizer():
    # Lazy import keeps tests independent from heavyweight model downloads.
    from kokoro import KPipeline
    pipeline=KPipeline(lang_code='a',repo_id=MODEL_REPO,device='cpu')
    def synth(text,voice,speed):
        samples=[]
        for _,_,audio in pipeline(text,voice=voice,speed=speed,split_pattern=r'\n+'):
            samples.extend(audio.detach().cpu().numpy().reshape(-1).tolist())
        return samples,24000
    return synth


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
            dialogue.append((s,d))
    if not dialogue:raise ValueError('No dialogue to synthesize')
    windows=[]
    for i,(s,d) in enumerate(dialogue):
        window=(float(dialogue[i+1][0]['start']) if i+1<len(dialogue) else duration)-float(s['start'])
        if window<=.08:raise ValueError('Dialogue windows overlap or are too short')
        windows.append(window)
    out=Path(out_dir).resolve();out.mkdir(parents=True,exist_ok=True)
    synth=synth or local_synthesizer()
    manifest={'schema_version':1,'publication_enabled':False,'provider':'kokoro','model_id':'Kokoro-82M','model_repository':MODEL_REPO,'device':'cpu','voice_assignments':dict(VOICE_ASSIGNMENTS),'clips':[],'provider_calls':0,'status':'GENERATED_PENDING_LISTENING_REVIEW','scope':'Local synthesis, declared stock voice assignment, timing and file integrity; transcript/listening quality requires review'}
    # Manifest is committed only after every clip succeeds; no partial success claim.
    with tempfile.TemporaryDirectory(prefix='.voice-build-',dir=out) as temp:
        stage=Path(temp)
        for i,((scene,d),window) in enumerate(zip(dialogue,windows)):
            text=d['text'].strip();voice=VOICE_ASSIGNMENTS[d['speaker']];speed=1.0
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
            manifest['clips'].append({'scene_id':scene['id'],'speaker':d['speaker'],'voice_id':voice,'file':target.name,'text_sha256':hashlib.sha256(text.encode()).hexdigest(),'audio_sha256':sha(target),'duration':output_duration,'window_seconds':window,'speed':speed,'attempts':attempt+1})
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
