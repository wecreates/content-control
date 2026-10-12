#!/usr/bin/env python3
"""Original local JSON adapter. No upstream source is copied or modified.

The plugin executes in a separate interpreter against a pinned clean checkout.
Only local probe and compatible hard-cut concatenation are enabled.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

PIN='9327439db69021ab4b0e2776729bf3b58fdb5a87'
SOURCE='https://github.com/calesthio/OpenMontage'
# This is invocation glue, not an implementation copied from upstream.
PLUGIN='''import dataclasses,json,sys
sys.path.insert(0,sys.argv[1])
request=json.load(sys.stdin)
if request["operation"]=="probe":
 from tools.analysis.audio_probe import AudioProbe
 result=AudioProbe().execute(request["inputs"])
else:
 from tools.video.video_stitch import VideoStitch
 result=VideoStitch().execute(request["inputs"])
print(json.dumps(dataclasses.asdict(result)))
'''


def digest(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for block in iter(lambda:f.read(1048576),b''):h.update(block)
    return h.hexdigest()


def checked_checkout(directory):
    root=Path(directory).resolve()
    revision=subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip()
    if revision!=PIN:raise ValueError('Upstream revision does not match reviewed pin')
    dirty=subprocess.check_output(['git','-C',str(root),'status','--porcelain','--untracked-files=normal'],text=True).strip()
    if dirty:raise ValueError('Upstream checkout must be unmodified, with no untracked files')
    if (root/'.env').exists():raise ValueError('Upstream .env credentials are forbidden')
    required=['LICENSE','tools/__init__.py','tools/base_tool.py','tools/analysis/__init__.py','tools/analysis/audio_probe.py','tools/video/__init__.py','tools/video/video_stitch.py','lib/__init__.py','lib/events.py','lib/paths.py']
    hashes={}
    for rel in required:
        p=root/rel
        if not p.is_file() or p.is_symlink():raise ValueError('Missing or symlinked upstream dependency: '+rel)
        expected=subprocess.check_output(['git','-C',str(root),'show',PIN+':'+rel])
        if p.read_bytes()!=expected:raise ValueError('Changed upstream dependency: '+rel)
        hashes[rel]=digest(p)
    return root,hashes


def media_path(value):
    if not isinstance(value,str) or any(c in value for c in "\n\r'\\") or '://' in value:raise ValueError('Only safe local media paths are accepted')
    p=Path(value).resolve()
    if not p.is_file() or p.suffix.lower() not in {'.mp4','.mov','.mkv','.wav','.mp3','.m4a'}:raise ValueError('Existing local media file required')
    if any(c in str(p) for c in "\n\r'\\"):raise ValueError('Resolved media path unsafe for upstream concat manifest')
    return p


def execute(upstream,request):
    if request.get('publication_enabled') is not False:raise ValueError('publication_enabled must be false')
    operation=request.get('operation')
    if operation not in {'probe','concat'}:raise ValueError('Only probe and concat are enabled')
    root,hashes=checked_checkout(upstream)
    files=[media_path(request['input_path'])] if operation=='probe' else [media_path(x) for x in request.get('clips',[])]
    if operation=='concat' and not 2<=len(files)<=64:raise ValueError('Concat requires 2 to 64 clips')
    target=None
    if operation=='concat':
        target=Path(request['output_path']).resolve()
        if target.exists() or target in files:raise ValueError('Output must be a new path')
        if target.suffix.lower()!='.mp4':raise ValueError('MP4 output required')
        target.parent.mkdir(parents=True,exist_ok=True)
    # No inherited tokens, provider configuration, HOME or Python import hooks.
    env={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'PYTHONDONTWRITEBYTECODE':'1','LC_ALL':'C.UTF-8'}
    with tempfile.TemporaryDirectory(prefix='openmontage-local-',dir=str(target.parent) if target else None) as work:
        inputs={'input_path':str(files[0])} if operation=='probe' else {'operation':'stitch','clips':[str(x) for x in files],'output_path':str(Path(work)/'result.mp4'),'transition':'cut','auto_normalize':False}
        result=subprocess.run([sys.executable,'-I','-B','-c',PLUGIN,str(root)],input=json.dumps({'operation':operation,'inputs':inputs}),text=True,capture_output=True,cwd=work,env=env,timeout=180)
        if result.returncode:raise ValueError('Upstream local plugin failed: '+result.stderr[-500:])
        data=json.loads(result.stdout)
        if not data.get('success'):raise ValueError('Upstream local plugin rejected media: '+str(data.get('error')))
        if target:
            staged=Path(work)/'result.mp4'
            if not staged.is_file() or not staged.stat().st_size:raise ValueError('No upstream output produced')
            # Hard-link creation is exclusive: never overwrite a concurrently created output.
            os.link(staged,target)
            data['artifacts']=[str(target)]
            data['data']['output']=str(target)
        return {'schema_version':1,'status':'PASS','operation':operation,'upstream_commit':PIN,'upstream_source':SOURCE,'license':'AGPL-3.0','upstream_file_sha256':hashes,'provider_calls':0,'publication_enabled':False,'scope':'Local media probe or compatible hard-cut concat only; no visual/audio creative QA certified','inputs':[{'path':str(p),'sha256':digest(p)} for p in files],'output_sha256':digest(target) if target else None,'result':data}


def main():
    p=argparse.ArgumentParser();p.add_argument('--upstream',required=True);p.add_argument('--request',required=True);p.add_argument('--receipt',required=True);a=p.parse_args()
    try:r=execute(a.upstream,json.loads(Path(a.request).read_text()));code=0
    except (ValueError,KeyError,OSError,subprocess.SubprocessError) as e:r={'status':'BLOCKED','reason':str(e),'publication_enabled':False};code=2
    Path(a.receipt).write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'status':r['status'],'receipt':a.receipt}));return code
if __name__=='__main__':raise SystemExit(main())
