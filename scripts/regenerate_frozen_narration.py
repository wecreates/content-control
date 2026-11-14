"""Reproduce frozen narration bytes from the original repository audio only.

No media is embedded or downloaded. Exact WAV and MP3 identity are mandatory;
version-dependent differences fail closed instead of becoming new candidates.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import stat
import subprocess
import tempfile
import wave

SOURCE_SHA256='77ae2168527509c49a02ab08d9e54f8c04fd5774309bba82e8eefa88974074fb'
WAV_SHA256='e6576e6936e914c1614282cdaf8f1b4ba96428ef1e9b2b9c2e75bb732af2f14f'
MP3_SHA256='c2b633f1c509fec43be6fd75d365b6335ca273e8beb6be6c5552bbb3cd24cd57'
RECIPE={'version':1,'decode_rate':44100,'channels':1,'token_seconds':[2.27,2.66],
        'fade_seconds':.005,'padding_seconds':.025,'insert_seconds':[9.79,10.5,11.19],
        'wav_format':'signed 16-bit little-endian PCM',
        'mp3_args':['-ar','24000','-ac','1','-c:a','libmp3lame','-b:a','96k']}


def sha(data):return hashlib.sha256(data).hexdigest()


def snapshot(path):
    limit=128*1024*1024
    fd=os.open(path,os.O_RDONLY|getattr(os,'O_NONBLOCK',0))
    try:
        info=os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or not 0<info.st_size<=limit:
            raise ValueError('Source must be a bounded nonempty regular file')
        with os.fdopen(fd,'rb') as stream:
            fd=None;data=stream.read(limit+1)
        if not data or len(data)>limit:raise ValueError('Source exceeds bound')
        return data
    finally:
        if fd is not None:os.close(fd)


def ffmpeg(*args):
    result=subprocess.run(['ffmpeg',*args],capture_output=True,timeout=60)
    if result.returncode:
        raise ValueError('FFmpeg failed: '+result.stderr.decode(errors='replace')[-1000:])
    return result.stdout


def regenerate(source,output):
    source=Path(source);output=Path(output)
    data=snapshot(source)
    if sha(data)!=SOURCE_SHA256:
        raise ValueError('Original repository audio SHA-256 mismatch; refusing regeneration')
    # Never merge into, overwrite or clear an existing directory.
    output.mkdir(parents=True,exist_ok=False)
    receipt={'status':'BLOCKED','publication_enabled':False,'production_ready':False,
        'acceptance_evidence':False,'source_sha256':SOURCE_SHA256,
        'recipe':RECIPE,'recipe_sha256':sha(json.dumps(RECIPE,sort_keys=True,separators=(',',':')).encode()),
        'helper_sha256':sha(Path(__file__).read_bytes()),
        'expected_wav_sha256':WAV_SHA256,'expected_mp3_sha256':MP3_SHA256,
        'python':platform.python_version(),'platform':platform.platform()}
    try:
        import numpy as np
        receipt['numpy']=np.__version__
        receipt['ffmpeg_version']=ffmpeg('-version').decode(errors='replace')
        with tempfile.TemporaryDirectory(prefix='.unverified-',dir=output) as temporary:
            stage=Path(temporary);encoded=stage/'original.mp3';encoded.write_bytes(data)
            pcm=ffmpeg('-nostdin','-hide_banner','-loglevel','error','-i',str(encoded),
                       '-ac','1','-ar','44100','-f','f32le','pipe:1')
            if not pcm or len(pcm)%4:raise ValueError('Invalid decoded PCM')
            samples=np.frombuffer(pcm,dtype='<f4').copy()
            if not np.isfinite(samples).all():raise ValueError('Nonfinite decoded samples')
            rate=44100;token=samples[round(2.27*rate):round(2.66*rate)].copy();fade=round(.005*rate)
            token[:fade]*=np.linspace(0,1,fade);token[-fade:]*=np.linspace(1,0,fade)
            pause=np.zeros(round(.025*rate),dtype=np.float32)
            insertion=np.concatenate([pause,token,pause]);pieces=[];previous=0
            for time in (9.79,10.5,11.19):
                boundary=round(time*rate);pieces.extend([samples[previous:boundary],insertion]);previous=boundary
            pieces.append(samples[previous:]);edited=np.concatenate(pieces)
            wav_path=stage/'candidate.wav'
            with wave.open(str(wav_path),'wb') as stream:
                stream.setparams((1,2,rate,0,'NONE','not compressed'))
                stream.writeframes((np.clip(edited,-1,1)*32767).astype('<i2').tobytes())
            receipt['observed_wav_sha256']=sha(wav_path.read_bytes())
            if receipt['observed_wav_sha256']!=WAV_SHA256:
                raise ValueError('Frozen WAV hash mismatch; decoder/Numpy/platform differences may prevent exact reproduction')
            mp3_path=stage/'candidate.mp3'
            ffmpeg('-nostdin','-hide_banner','-loglevel','error','-i',str(wav_path),
                   *RECIPE['mp3_args'],str(mp3_path))
            receipt['observed_mp3_sha256']=sha(mp3_path.read_bytes())
            if receipt['observed_mp3_sha256']!=MP3_SHA256:
                raise ValueError('Frozen MP3 hash mismatch; FFmpeg/libmp3lame build or metadata differences may prevent exact reproduction')
            if sha(snapshot(source))!=SOURCE_SHA256:raise ValueError('Original source changed during regeneration')
            os.replace(wav_path,output/'narration-currency-edit-candidate.wav')
            os.replace(mp3_path,output/'narration-currency-edit-candidate.mp3')
            receipt.update(status='FROZEN_BYTES_REPRODUCED',source_unchanged=True,
                           listening_quality_assessed=False,duration_seconds=len(edited)/rate)
    except (OSError,ValueError,ImportError,subprocess.TimeoutExpired) as error:
        receipt['reason']=str(error)
    (output/'regeneration-receipt.json').write_text(json.dumps(receipt,indent=2,sort_keys=True)+'\n')
    return receipt


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',required=True)
    parser.add_argument('--output-dir',required=True)
    args=parser.parse_args()
    try:receipt=regenerate(args.source,args.output_dir)
    except (OSError,ValueError) as error:
        receipt={'status':'BLOCKED','reason':str(error),'publication_enabled':False,'acceptance_evidence':False}
    print(json.dumps(receipt,sort_keys=True))
    return 0 if receipt['status']=='FROZEN_BYTES_REPRODUCED' else 2


if __name__=='__main__':raise SystemExit(main())
