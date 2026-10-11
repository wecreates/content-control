"""Mix existing owned audio stems locally. No synthesis, uploads, or provider calls."""
import argparse
import hashlib
import json
import math
import subprocess
import tempfile
import wave
import array
from pathlib import Path


def run(args):
    result=subprocess.run(args,check=False,capture_output=True,text=True,timeout=120)
    if result.returncode:raise ValueError('Audio tool failed: '+result.stderr[-1200:])
    return result.stdout


def probe(file):
    data=json.loads(run(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type','-of','json',str(file)]))
    if not any(s.get('codec_type')=='audio' for s in data.get('streams',[])):raise ValueError('Audio stream missing')
    duration=float(data['format']['duration'])
    if not math.isfinite(duration) or duration<=0:raise ValueError('Invalid audio duration')
    return duration


def digest(file):return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def mix(voice,ccsd,music,sfx_files,out_dir):
    if ccsd.get('publication_enabled') is not False:raise ValueError('Publication must remain disabled')
    scenes=sorted(ccsd.get('scenes',[]),key=lambda s:float(s['start']))
    if not scenes:raise ValueError('Scenes required')
    duration=max(float(s['end']) for s in scenes)
    if not math.isfinite(duration) or not 0<duration<=600:raise ValueError('Invalid timeline duration')
    for scene in scenes:
        start,end=float(scene['start']),float(scene['end'])
        if not math.isfinite(start) or not math.isfinite(end) or not 0<=start<end<=duration:raise ValueError('Invalid scene timing')
    sources=[Path(voice).resolve(),Path(music).resolve(),*[Path(p).resolve() for p in sfx_files]]
    if len(sfx_files)!=2 or any(not p.is_file() for p in sources):raise ValueError('Existing narration, music, and two effects required')
    voice_duration=probe(sources[0])
    if abs(voice_duration-duration)>.05:raise ValueError('Narration must already match the complete timeline')
    source_durations={str(p):probe(p) for p in sources}
    out=Path(out_dir).resolve();targets=[out/'music.wav',out/'sfx.wav',out/'mix.wav']
    if any(p in sources for p in targets):raise ValueError('Output would overwrite source audio')
    out.mkdir(parents=True,exist_ok=True)
    before={str(p):digest(p) for p in sources}
    common=['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-y']
    pcm=['-t',str(duration),'-ar','44100','-ac','2','-c:a','pcm_s16le']
    # Normalize backing music first, then hold it well below speech.
    run(common+['-stream_loop','-1','-i',str(sources[1]),'-af','loudnorm=I=-30:TP=-8:LRA=7,afade=t=in:d=0.4,afade=t=out:st='+str(max(0,duration-.7))+':d=0.7']+pcm+[str(targets[0])])
    # At most eight restrained accents, never more often than every six seconds.
    directed=ccsd.get('sound_design',{}).get('cue_seconds')
    cues=[]
    if directed is not None:
        if not isinstance(directed,list) or len(directed)>8:raise ValueError('At most eight directed sound cues required')
        for value in directed:
            t=float(value)
            if not math.isfinite(t) or not 0<=t<duration-.1 or (cues and t-cues[-1]<6):raise ValueError('Directed cues must be ordered, sparse and inside the timeline')
            cues.append(t)
        if not cues:raise ValueError('Directed cues cannot be empty')
    else:
        for scene in scenes:
            t=float(scene['start'])
            if t<duration-.1 and (not cues or t-cues[-1]>=6):cues.append(t)
            if len(cues)==8:break
    # Decode short MP3 effects independently, then place samples on an exact PCM
    # timeline. MP3 encoder timestamps interacting with a multi-input filter graph
    # previously ended the SFX stem at the first delay (0.5s rather than 50s).
    frame_count=round(duration*44100)
    timeline=array.array('h',[0])*(frame_count*2)
    with tempfile.TemporaryDirectory(prefix='sfx-decode-') as temporary:
        decoded=[]
        for i,source in enumerate(sources[2:]):
            destination=Path(temporary)/f'{i}.wav'
            run(common+['-i',str(source),'-af','atrim=duration=0.65,asetpts=PTS-STARTPTS,volume=0.18,alimiter=limit=0.18:level=false:latency=true,afade=t=out:st=0.4:d=0.25','-ar','44100','-ac','2','-c:a','pcm_s16le',str(destination)])
            with wave.open(str(destination),'rb') as w:
                if (w.getnchannels(),w.getsampwidth(),w.getframerate())!=(2,2,44100):raise ValueError('Invalid decoded effect format')
                samples=array.array('h');samples.frombytes(w.readframes(w.getnframes()))
            if not samples or not any(samples):raise ValueError('Decoded effect is silent')
            decoded.append(samples)
        for i,t in enumerate(cues):
            offset=round(t*44100)*2;samples=decoded[i%2]
            for j,value in enumerate(samples[:max(0,len(timeline)-offset)]):
                timeline[offset+j]=max(-32768,min(32767,timeline[offset+j]+value))
    with wave.open(str(targets[1]),'wb') as w:
        w.setparams((2,2,44100,0,'NONE','not compressed'));w.writeframes(timeline.tobytes())
    # Narration enters exactly once. Low music/SFX stems remain separate for revision.
    run(common+['-i',str(sources[0]),'-i',str(targets[0]),'-i',str(targets[1]),'-filter_complex','[0:a]loudnorm=I=-16:TP=-2:LRA=7[v];[v][1:a][2:a]amix=inputs=3:normalize=0,alimiter=limit=0.89:level=false:latency=true[m]','-map','[m]']+pcm+[str(targets[2])])
    for p in sources:
        if digest(p)!=before[str(p)]:raise ValueError('Source audio changed during mixing')
    durations={p.name:probe(p) for p in targets}
    if any(abs(v-duration)>.05 for v in durations.values()):raise ValueError('Mixed stem duration mismatch: '+json.dumps(durations))
    return {'status':'PASS','publication_enabled':False,'provider_calls':0,'duration':duration,'cue_seconds':cues,'source_sha256':before,'source_duration_seconds':source_durations,'outputs':{p.name:{'path':str(p),'sha256':digest(p),'duration':durations[p.name]} for p in targets},'scope':'Local decode, separate stem assembly, source integrity and duration verification; listening quality and voice identity remain unverified'}


def main():
    p=argparse.ArgumentParser();p.add_argument('--voice',required=True);p.add_argument('--ccsd',required=True);p.add_argument('--music',default='public/audio/episode1-music.mp3');p.add_argument('--sfx',nargs=2,default=['public/audio/episode1-sfx-1.mp3','public/audio/episode1-sfx-2.mp3']);p.add_argument('--out-dir',required=True);p.add_argument('--receipt',required=True);a=p.parse_args()
    try:result=mix(a.voice,json.loads(Path(a.ccsd).read_text()),a.music,a.sfx,a.out_dir)
    except (ValueError,OSError,KeyError,subprocess.TimeoutExpired) as e:result={'status':'BLOCKED','publication_enabled':False,'provider_calls':0,'reason':str(e)}
    target=Path(a.receipt);target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));return 0 if result['status']=='PASS' else 2
if __name__=='__main__':raise SystemExit(main())
