"""Assemble existing approved character clips; never call a paid provider or TTS fallback."""
import argparse, array, hashlib, io, json, math, os, stat, sys, tempfile, wave
from pathlib import Path


MAX_AUDIO_BYTES = 600 * 44100 * 4 + 1024 * 1024


def read_audio(path, limit=MAX_AUDIO_BYTES):
    """Read one bounded regular-file snapshot; never wait on a pipe/device."""
    fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or not 0 < info.st_size <= limit:
            raise ValueError('Audio must be a bounded nonempty regular file')
        with os.fdopen(fd, 'rb') as stream:
            fd = None
            data = stream.read(limit + 1)
        if not data or len(data) > limit:
            raise ValueError('Audio exceeds size bound')
        return data
    finally:
        if fd is not None:
            os.close(fd)


def sha(path):
    return hashlib.sha256(read_audio(path)).hexdigest()


def assemble(ccsd, manifest, root, output):
    root=Path(root).resolve();output=Path(output)
    if not isinstance(ccsd,dict) or not isinstance(manifest,dict):raise ValueError('CCSD and manifest objects required')
    if ccsd.get('publication_enabled') is not False or manifest.get('publication_enabled') is not False:
        raise ValueError('PUBLICATION_DISABLED required')
    if manifest.get('provider')!='kokoro' or manifest.get('model_id')!='Kokoro-82M':
        raise ValueError('Free-only production requires local Kokoro-82M clips')
    locks=manifest.get('voice_assignments',{})
    approved={'dave':'am_fenrir','points_monk':'am_michael','narrator':'am_adam'}
    if any(approved.get(s)!=v for s,v in locks.items()):raise ValueError('Voice assignment differs from fixed character voice policy')
    scenes=ccsd.get('scenes',[])
    if not isinstance(scenes,list) or not scenes:raise ValueError('Scenes required')
    for scene in scenes:
        if not isinstance(scene,dict):raise ValueError('Invalid scene')
        times=(scene.get('start'),scene.get('end'))
        if any(isinstance(t,bool) or not isinstance(t,(int,float)) or not 0<=t<=600 for t in times) or not 0<=times[0]<times[1]<=600:
            raise ValueError('Invalid scene timing')
    expected=[(s,d) for s in sorted(scenes,key=lambda s:s['start']) for d in s.get('audio',{}).get('dialogue',[]) if d.get('text','').strip()]
    clips=manifest.get('clips',[])
    if not expected or len(clips)!=len(expected):raise ValueError('Exactly one approved clip per dialogue segment required')
    speakers={d['speaker'] for _,d in expected}
    if any(not locks.get(s) for s in speakers) or len({locks[s] for s in speakers})!=len(speakers):
        raise ValueError('Distinct locked voice assignments required for each speaker')
    duration=max(float(s['end']) for s in scenes); rate=44100
    if not math.isfinite(duration) or not 0<duration<=600:raise ValueError('Invalid duration')
    timeline=bytearray(round(duration*rate)*4); receipts=[]
    starts=[float(s['start']) for s,_ in expected]
    paths=[]
    for clip in clips:
        p=(root/clip['file']).resolve()
        if not p.is_relative_to(root):raise ValueError('Clip outside audio directory')
        if output.resolve()==p or (output.exists() and p.exists() and output.samefile(p)):
            raise ValueError('Output would overwrite source audio')
        paths.append(p)
    for i,((scene,d),clip) in enumerate(zip(expected,clips)):
        if clip.get('scene_id')!=scene['id'] or clip.get('speaker')!=d['speaker'] or clip.get('voice_id')!=locks[d['speaker']]:
            raise ValueError('Clip speaker/scene/voice does not match locked dialogue')
        if clip.get('text_sha256')!=hashlib.sha256(d['text'].strip().encode()).hexdigest():raise ValueError('Clip text hash mismatch')
        snapshot=read_audio(paths[i])
        clip_sha=hashlib.sha256(snapshot).hexdigest()
        if clip_sha!=clip.get('audio_sha256'):raise ValueError('Clip audio hash mismatch')
        with wave.open(io.BytesIO(snapshot),'rb') as w:
            if (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getcomptype())!=(2,2,rate,'NONE'):
                raise ValueError('Clips must be stereo 16-bit PCM WAV at 44100 Hz')
            frames=w.getnframes()
            if not 0<frames<=round(duration*rate):raise ValueError('Invalid clip frame count')
            data=w.readframes(frames)
        if len(data)!=frames*4:raise ValueError('Truncated PCM clip')
        samples=array.array('h',data)
        if sys.byteorder!='little':samples.byteswap()
        rms=math.sqrt(sum(v*v for v in samples)/max(1,len(samples)))
        if rms<33:raise ValueError('Silent or inaudible clip')
        start_frame=round(starts[i]*rate)
        next_frame=round(starts[i+1]*rate) if i+1<len(starts) else len(timeline)//4
        if start_frame+frames>next_frame or start_frame+frames>len(timeline)//4:raise ValueError('Dialogue overlaps next speaker or exceeds video; do not truncate')
        offset=start_frame*4;timeline[offset:offset+len(data)]=data
        receipts.append({'scene_id':scene['id'],'speaker':d['speaker'],'start':start_frame/rate,'end':(start_frame+frames)/rate,'audio_sha256':clip_sha,'rms':round(rms,2)})
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.audio-assemble-',dir=output.parent) as temporary:
        staged=Path(temporary)/'voice.wav'
        with wave.open(str(staged),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes(timeline)
        output_sha=sha(staged)
        os.replace(staged,output)
    return {'status':'PASS','publication_enabled':False,'provider_calls':0,'duration':duration,'dialogue':receipts,'audio_sha256':output_sha,'scope':'Timing, declared voice assignment, integrity and audibility; does not certify voice identity or creative quality'}


def same_file(left, right):
    left,right=Path(left),Path(right)
    return left.resolve()==right.resolve() or (left.exists() and right.exists() and left.samefile(right))


def check_destinations(output, receipt, sources):
    if same_file(output,receipt) or any(same_file(target,source) for target in (output,receipt) for source in sources):
        raise ValueError('Output or receipt would overwrite an input or each other')


def main():
    p=argparse.ArgumentParser();p.add_argument('--ccsd',required=True);p.add_argument('--manifest',required=True);p.add_argument('--out',required=True);p.add_argument('--receipt',required=True);a=p.parse_args()
    # Unsafe destinations cannot be used even for failure receipts. Ordinary
    # missing/malformed inputs must still replace a stale success receipt.
    try:
        check_destinations(a.out,a.receipt,[a.ccsd,a.manifest])
    except (ValueError,OSError) as e:
        print(json.dumps({'status':'BLOCKED','reason':str(e),'publication_enabled':False,'provider_calls':0}));return 2
    receipt_safe=True
    try:
        m=Path(a.manifest)
        if not m.exists():raise ValueError('APPROVED_CHARACTER_AUDIO_MISSING: supply existing locked-voice clips; paid generation is not enabled')
        manifest=json.loads(read_audio(m,2*1024*1024))
        clips=manifest.get('clips',[])
        sources=[a.ccsd,m,*[m.parent/clip['file'] for clip in clips if isinstance(clip,dict) and isinstance(clip.get('file'),str)]] if isinstance(clips,list) else [a.ccsd,m]
        try:check_destinations(a.out,a.receipt,sources)
        except (ValueError,OSError):
            receipt_safe=False
            raise
        result=assemble(json.loads(read_audio(a.ccsd,2*1024*1024)),manifest,m.parent,a.out)
    except (ValueError,OSError,KeyError,TypeError,AttributeError,RecursionError,wave.Error,EOFError) as e:result={'status':'BLOCKED','reason':str(e),'publication_enabled':False,'provider_calls':0}
    if receipt_safe:
        r=Path(a.receipt);r.parent.mkdir(parents=True,exist_ok=True);r.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result));return 0 if result['status']=='PASS' else 2
if __name__=='__main__':raise SystemExit(main())
