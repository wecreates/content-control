"""Package measured media for private review; never upload or approve publication."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {'decodes','complete_av_decode','audio_present','audio_audible','audio_covers_video','duration_match','no_black','no_duplicate_run','motion_alive','safe_border','publication_disabled'}


def sha(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()


def timestamp(seconds, separator):
    milliseconds = round(seconds * 1000)
    hours, remainder = divmod(milliseconds,3600000)
    minutes, remainder = divmod(remainder,60000)
    seconds, milliseconds = divmod(remainder,1000)
    return f'{hours:02}:{minutes:02}:{seconds:02}{separator}{milliseconds:03}'


def caption_files(track, duration):
    if track.get('status') != 'PASS' or track.get('publication_enabled') is not False or not track.get('cues'):
        raise ValueError('Passing observed caption track required')
    previous=0;srt=[];vtt=['WEBVTT','']
    for i,cue in enumerate(track['cues'],1):
        start,end=cue.get('start'),cue.get('end')
        if any(type(value) not in (float,int) or not math.isfinite(value) for value in (start,end)) or not 0<=start<end<=duration or start<previous:
            raise ValueError('Invalid observed caption interval')
        text=cue.get('text')
        if not isinstance(text,str) or not text.strip() or '\n' in text or '-->' in text:
            raise ValueError('Invalid caption text')
        if timestamp(start,'.') == timestamp(end,'.'):
            raise ValueError('Caption interval shorter than subtitle precision')
        srt.extend([str(i),timestamp(start,',')+' --> '+timestamp(end,','),text,''])
        vtt.extend([timestamp(start,'.')+' --> '+timestamp(end,'.'),text,''])
        previous=end
    return '\n'.join(srt)+'\n','\n'.join(vtt)+'\n'


def duration_acceptance(ccsd, duration, policy_path=ROOT/'control/long-form-showrunner.json'):
    """Editorial runtime acceptance is separate from measured-media integrity."""
    if type(duration) not in (int,float) or not math.isfinite(duration) or duration<=0:
        raise ValueError('Invalid measured duration')
    if not str(ccsd.get('format','')).startswith('long'):
        return {'status':'NOT_APPLICABLE','scope':'long_form_minimum_runtime','measured_seconds':duration,'publication_enabled':False,'production_approved':False}
    policy=json.loads(Path(policy_path).read_text())
    minimum=policy.get('minimum_runtime_sec')
    if type(minimum) not in (int,float) or not math.isfinite(minimum) or minimum<510 or policy.get('publication_enabled') is not False:
        raise ValueError('Invalid or weakened long-form runtime policy')
    passed=duration>=minimum
    return {'status':'PASS' if passed else 'BLOCKED','scope':'long_form_minimum_runtime','measured_seconds':duration,'minimum_seconds':minimum,'shortfall_seconds':max(0,minimum-duration),'policy_sha256':sha(policy_path),'reason':None if passed else 'Finished long-form media is shorter than the preserved showrunner minimum','publication_enabled':False,'production_approved':False}


def _build_package(ccsd_path, metadata_path, candidate, qa_path, captions_path, outdir, audio=None):
    paths={name:Path(value).resolve() for name,value in [('ccsd',ccsd_path),('metadata',metadata_path),('candidate',candidate),('qa',qa_path),('captions',captions_path)]}
    paths['duration_policy']=ROOT/'control/long-form-showrunner.json'
    paths['audio']=Path(audio).resolve() if audio else paths['captions'].parent/'voice.wav'
    before={name:sha(path) for name,path in paths.items()}
    ccsd,metadata,qa,track=[json.loads(paths[key].read_text()) for key in ('ccsd','metadata','qa','captions')]
    if any(value.get('publication_enabled') is not False for value in (ccsd,metadata,qa,track)):
        raise ValueError('Publication must be explicitly disabled')
    checks=qa.get('checks',{})
    if qa.get('status')!='PASS' or not REQUIRED <= checks.keys() or any(v is not True for v in checks.values()):
        raise ValueError('Complete passing measured media QA required')
    if qa.get('candidate_sha256')!=before['candidate']:
        raise ValueError('Stale QA: candidate hash mismatch')
    if track.get('source_audio_sha256')!=before['audio']:
        raise ValueError('Caption source audio hash mismatch')
    measured=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type','-of','json',str(paths['candidate'])],text=True))
    duration=float(measured['format']['duration'])
    if not math.isfinite(duration) or duration<=0 or {'audio','video'} - {s['codec_type'] for s in measured['streams']}:
        raise ValueError('Candidate lacks valid audiovisual streams')
    if abs(duration-float(qa['metrics']['duration']))>.2:
        raise ValueError('QA duration differs from actual candidate')
    acceptance=duration_acceptance(ccsd,duration,paths['duration_policy'])
    srt,vtt=caption_files(track,duration)
    out=Path(outdir).resolve()
    names=['captions.srt','captions.vtt','metadata.json','thumbnail.png','review-package.json']
    if any((out/name).exists() for name in names):
        raise ValueError('Refusing to overwrite an existing review package')
    out.mkdir(parents=True,exist_ok=True)
    # Existing renderer lookup verifies source text, speaker, timestamps and frame visibility.
    with tempfile.TemporaryDirectory(prefix='package-check-') as temp:
        subprocess.run(['node',str(ROOT/'scripts/verify_caption_frames.mjs'),'--ccsd',str(paths['ccsd']),'--captions',str(paths['captions']),'--out',str(Path(temp)/'frames.json')],check=True,capture_output=True,text=True)
    scenes=sorted(ccsd['scenes'],key=lambda scene:scene['start'])
    scene=scenes[len(scenes)//2]
    frame_time=(float(scene['start'])+float(scene['end']))/2
    if not 0<=frame_time<duration:
        raise ValueError('Representative scene is outside candidate')
    subprocess.run(['ffmpeg','-nostdin','-v','error','-n','-ss',str(frame_time),'-i',str(paths['candidate']),'-frames:v','1',str(out/'thumbnail.png')],check=True,capture_output=True,text=True)
    if not (out/'thumbnail.png').is_file() or not (out/'thumbnail.png').stat().st_size:
        raise ValueError('Thumbnail extraction failed')
    (out/'captions.srt').write_text(srt);(out/'captions.vtt').write_text(vtt)
    packaged={**metadata,'privacy_status':'private','publication_enabled':False,'production_approved':False,'status':'REVIEW_PACKAGE_PENDING_APPROVAL','candidate_sha256':before['candidate'],'measured_duration_seconds':duration,'duration_policy_acceptance':acceptance,'audio_status':'PRESENT_MEASURED','render_status':'RENDERED_TECHNICAL_QA_PASS','review_status':'PENDING_FINAL_AV_REVIEW','thumbnail_type':'actual_candidate_frame','thumbnail_time_seconds':frame_time}
    (out/'metadata.json').write_text(json.dumps(packaged,indent=2)+'\n')
    if any(sha(paths[name])!=digest for name,digest in before.items()):
        raise ValueError('Source changed while packaging')
    result={'schema_version':1,'generator':'cyzor.production_package.v1','status':'REVIEW_PACKAGE_PENDING_APPROVAL','publication_enabled':False,'production_approved':False,'creative_review':'PENDING','listening_review':'PENDING','upload_performed':False,'inputs':{name:{'path':str(paths[name]),'sha256':digest} for name,digest in before.items()},'measured_duration_seconds':duration,'duration_policy_acceptance':acceptance,'thumbnail':{'kind':'unaltered_actual_video_frame','scene_id':scene['id'],'time_seconds':frame_time},'outputs':{name:{'path':str(out/name),'sha256':sha(out/name)} for name in names if name!='review-package.json'}}
    (out/'review-package.json').write_text(json.dumps(result,indent=2)+'\n')
    return result


def package(ccsd_path, metadata_path, candidate, qa_path, captions_path, outdir, audio=None):
    """Versioned, atomic packages; successful earlier outputs are never replaced."""
    audio=audio or Path(captions_path).resolve().parent/'voice.wav'
    sources={'ccsd':ccsd_path,'metadata':metadata_path,'candidate':candidate,'qa':qa_path,'captions':captions_path,'audio':audio,'duration_policy':ROOT/'control/long-form-showrunner.json'}
    hashes={key:sha(value) for key,value in sources.items()}
    identity={**hashes,'packager':sha(__file__)}
    version=hashlib.sha256(json.dumps(identity,sort_keys=True).encode()).hexdigest()[:24]
    root=Path(outdir).resolve();root.mkdir(parents=True,exist_ok=True)
    target=root/version;manifest=target/'review-package.json'
    names={'captions.srt','captions.vtt','metadata.json','thumbnail.png'}
    if target.exists():
        if not manifest.is_file() or manifest.is_symlink():raise ValueError('Existing version lacks generated package manifest')
        result=json.loads(manifest.read_text())
        if result.get('generator')!='cyzor.production_package.v1' or result.get('schema_version')!=1 or result.get('package_identity')!=identity:
            raise ValueError('Existing package provenance mismatch')
        if result.get('status')!='REVIEW_PACKAGE_PENDING_APPROVAL' or result.get('publication_enabled') is not False or result.get('production_approved') is not False:
            raise ValueError('Existing package approval state invalid')
        if set(result.get('outputs',{}))!=names or {p.name for p in target.iterdir()}!=names|{'review-package.json'}:
            raise ValueError('Existing package has unexpected output files')
        if {key:item.get('sha256') for key,item in result.get('inputs',{}).items()}!=hashes:
            raise ValueError('Existing package source mismatch')
        for name,item in result['outputs'].items():
            path=target/name
            if path.is_symlink() or item.get('path')!=str(path) or not path.is_file() or sha(path)!=item.get('sha256'):
                raise ValueError('Existing package output hash mismatch')
        result['manifest_path']=str(manifest)
        return result
    with tempfile.TemporaryDirectory(prefix='.package-',dir=root) as temp:
        stage=Path(temp)/'result'
        result=_build_package(ccsd_path,metadata_path,candidate,qa_path,captions_path,stage,audio)
        if any(sha(sources[key])!=value for key,value in hashes.items()):raise ValueError('Source changed during package generation')
        result['package_identity']=identity
        result['manifest_path']=str(manifest)
        for name,item in result['outputs'].items():item['path']=str(target/name)
        (stage/'review-package.json').write_text(json.dumps(result,indent=2)+'\n')
        # Atomic directory publication; a concurrent existing result is never overwritten.
        os.rename(stage,target)
        return result


def main():
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('ccsd','metadata','candidate','qa','captions','out-dir'):p.add_argument('--'+name,required=True)
    p.add_argument('--receipt',help='Stable result manifest written atomically only after success')
    p.add_argument('--audio',help='Source narration for caption hash verification; defaults to captions directory/voice.wav')
    a=p.parse_args()
    try:
        result=package(a.ccsd,a.metadata,a.candidate,a.qa,a.captions,a.out_dir,a.audio)
        if a.receipt:
            receipt=Path(a.receipt).resolve();receipt.parent.mkdir(parents=True,exist_ok=True)
            protected=[Path(item['path']).resolve() for item in [*result['inputs'].values(),*result['outputs'].values()]]+[Path(result['manifest_path'])]
            if receipt in protected:raise ValueError('Receipt may not overwrite input or packaged artifact')
            with tempfile.NamedTemporaryFile(mode='w',dir=receipt.parent,delete=False) as stream:
                json.dump(result,stream,indent=2);stream.flush();os.fsync(stream.fileno());temporary=stream.name
            os.replace(temporary,receipt)
        print(json.dumps({'status':result['status'],'publication_enabled':False,'manifest_path':result['manifest_path']}));return 0
    except (ValueError,OSError,KeyError,TypeError,subprocess.SubprocessError) as error:
        print(json.dumps({'status':'BLOCKED','reason':str(error),'publication_enabled':False}));return 2


if __name__=='__main__':raise SystemExit(main())
