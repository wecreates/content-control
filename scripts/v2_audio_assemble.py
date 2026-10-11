"""Assemble existing approved character clips; never call a paid provider or TTS fallback."""
import argparse, hashlib, json, math, struct, wave
from pathlib import Path


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def assemble(ccsd, manifest, root, output):
    root=Path(root).resolve();output=Path(output)
    if ccsd.get('publication_enabled') is not False or manifest.get('publication_enabled') is not False:
        raise ValueError('PUBLICATION_DISABLED required')
    if manifest.get('provider')!='cartesia' or manifest.get('model_id')!='sonic-3.6':
        raise ValueError('Existing production voice policy requires Cartesia Sonic 3.6 clips')
    locks=manifest.get('voice_assignments',{})
    expected=[(s,d) for s in ccsd.get('scenes',[]) for d in s.get('audio',{}).get('dialogue',[]) if d.get('text','').strip()]
    clips=manifest.get('clips',[])
    if not expected or len(clips)!=len(expected):raise ValueError('Exactly one approved clip per dialogue segment required')
    speakers={d['speaker'] for _,d in expected}
    if any(not locks.get(s) for s in speakers) or len({locks[s] for s in speakers})!=len(speakers):
        raise ValueError('Distinct locked voice assignments required for each speaker')
    duration=max(float(s['end']) for s in ccsd['scenes']); rate=44100
    if not math.isfinite(duration) or not 0<duration<=600:raise ValueError('Invalid duration')
    timeline=bytearray(round(duration*rate)*4); receipts=[]
    starts=[float(s['start']) for s,_ in expected]
    for i,((scene,d),clip) in enumerate(zip(expected,clips)):
        if clip.get('scene_id')!=scene['id'] or clip.get('speaker')!=d['speaker'] or clip.get('voice_id')!=locks[d['speaker']]:
            raise ValueError('Clip speaker/scene/voice does not match locked dialogue')
        if clip.get('text_sha256')!=hashlib.sha256(d['text'].strip().encode()).hexdigest():raise ValueError('Clip text hash mismatch')
        p=(root/clip['file']).resolve()
        if not p.is_relative_to(root):raise ValueError('Clip outside audio directory')
        if sha(p)!=clip.get('audio_sha256'):raise ValueError('Clip audio hash mismatch')
        with wave.open(str(p),'rb') as w:
            if (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getcomptype())!=(2,2,rate,'NONE'):
                raise ValueError('Clips must be stereo 16-bit PCM WAV at 44100 Hz')
            frames=w.getnframes();data=w.readframes(frames)
        samples=struct.unpack('<'+'h'*(len(data)//2),data)
        rms=math.sqrt(sum(v*v for v in samples)/max(1,len(samples)))
        if rms<33:raise ValueError('Silent or inaudible clip')
        start=starts[i];end=start+frames/rate;next_start=starts[i+1] if i+1<len(starts) else duration
        if not math.isfinite(start) or start<0 or end>next_start+1/rate:raise ValueError('Dialogue overlaps next speaker or exceeds video; do not truncate')
        offset=round(start*rate)*4;timeline[offset:offset+len(data)]=data
        receipts.append({'scene_id':scene['id'],'speaker':d['speaker'],'start':start,'end':end,'audio_sha256':sha(p),'rms':round(rms,2)})
    output.parent.mkdir(parents=True,exist_ok=True)
    with wave.open(str(output),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes(timeline)
    return {'status':'PASS','publication_enabled':False,'provider_calls':0,'duration':duration,'dialogue':receipts,'audio_sha256':sha(output),'scope':'Timing, declared voice assignment, integrity and audibility; does not certify voice identity or creative quality'}


def main():
    p=argparse.ArgumentParser();p.add_argument('--ccsd',required=True);p.add_argument('--manifest',required=True);p.add_argument('--out',required=True);p.add_argument('--receipt',required=True);a=p.parse_args()
    try:
        m=Path(a.manifest)
        if not m.exists():raise ValueError('APPROVED_CHARACTER_AUDIO_MISSING: supply existing locked-voice clips; paid generation is not enabled')
        result=assemble(json.loads(Path(a.ccsd).read_text()),json.loads(m.read_text()),m.parent,a.out)
    except (ValueError,OSError,KeyError,wave.Error) as e:result={'status':'BLOCKED','reason':str(e),'publication_enabled':False,'provider_calls':0}
    r=Path(a.receipt);r.parent.mkdir(parents=True,exist_ok=True);r.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));return 0 if result['status']=='PASS' else 2
if __name__=='__main__':raise SystemExit(main())
