"""Opt-in local editorial consumer of an existing V2 handoff; no auto-install."""
import argparse
import hashlib
import json
import math
import os
import re
from pathlib import Path
import subprocess
import sys

PINS={'youtube-agent-skill':'a2feb2104981a375ffd4f87ee04f4f5344ac43c6','youtube-clipper-skill':'f31f077ee0905c95a510a6f34bbd0c3c85b15129'}
ADAPTERS={'integrations/run.py':'53fef072723e90f32679291e99e896da6864ed251cab69f477ccfe393b1715b7','integrations/youtube_skill/adapter.py':'98c82076359791d017355e5f65a6fd4791909619b47c50b4e33c6173f73678d5'}
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def read(p):return json.loads(Path(p).read_text(encoding='utf-8'))
def require(ok):
    if not ok:raise ValueError('EDITORIAL_EVIDENCE_REQUIRED')
def exclusive(p,data):
    with Path(p).open('x',encoding='utf-8') as f:json.dump(data,f,indent=2)

def prepared(root,handoff):
    root=Path(root).resolve();handoff=Path(handoff).resolve()
    m=read(handoff/'handoff.json');candidate=root/'public-review/v2-draft.mp4'
    require(isinstance(m,dict))
    run_id=m.get('build_run_id');source=m.get('build_source_commit')
    require(isinstance(run_id,str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}',run_id) is not None)
    protected=m.get('kind')=='PROTECTED_LOCAL_JOB_EXPORT'
    if protected:
        require(re.fullmatch(r'[a-f0-9]{64}',run_id) is not None and m.get('job_id')==run_id and source is None)
        require(isinstance(m.get('execution_sha256'),str) and re.fullmatch(r'[a-f0-9]{64}',m['execution_sha256']) is not None)
        require(m.get('source_export_sha256')==sha(root/'protected-export-provenance.json'))
        provenance=read(root/'protected-export-provenance.json')
        require(provenance.get('kind')==m['kind'] and provenance.get('job_id')==run_id and provenance.get('execution_sha256')==m['execution_sha256'] and provenance.get('publication_enabled') is False and provenance.get('production_approved') is False)
    else:
        require(isinstance(source,str) and re.fullmatch(r'[a-f0-9]{40}',source) is not None)
    require(m.get('publication_enabled') is False and m.get('production_approved') is False)
    require(m.get('candidate_sha256')==sha(candidate))
    for name in ('transcript-input.json','teaser.srt'):
        require(m.get('inputs',{}).get(name)==sha(handoff/name))
    current=read(root/'state/v2-production-status.json')
    if protected:require(current.get('kind')==m['kind'] and current.get('job_id')==run_id and current.get('execution_sha256')==m['execution_sha256'])
    require(current.get('candidate_sha256')==m['candidate_sha256'] and current.get('run_id')==m.get('build_run_id') and current.get('source_commit')==m.get('build_source_commit'))
    require(current.get('publication_enabled') is False and current.get('production_approved') is False)
    end=m.get('teaser_end_seconds');require(type(end) in (int,float) and math.isfinite(end) and 0<end<=12)
    segments=read(handoff/'transcript-input.json').get('transcript',{}).get('segments',[])
    require(isinstance(segments,list) and bool(segments))
    hook=segments[0].get('text');require(isinstance(hook,str) and 0<len(hook.strip())<=3000)
    srt=(handoff/'teaser.srt').read_text(encoding='utf-8');require(0<len(srt)<=200000 and '\x00' not in srt)
    return m,candidate,{'hook-score':{'hook':hook},'edit-plan':{'transcript_srt':srt},'chapters':{'transcript_srt':srt}},sha(handoff/'handoff.json')

def preflight(money):
    money=Path(money).resolve()
    for rel,digest in ADAPTERS.items():require(sha(money/rel)==digest)
    registry=read(money/'integrations/repositories.json')
    entries=registry.get('repositories',[])+registry.get('agent_tools',[])
    for tool,pin in PINS.items():
        found=[e for e in entries if e.get('id')==tool]
        require(len(found)==1 and found[0].get('revision')==pin and found[0].get('path')=='integrations/vendor/'+tool)
    # Worker verifies actual checkout revision at use. Registry labels are not installation evidence.

def execute(root,handoff,money,runtime,*,authorized=False):
    require(authorized is True)
    root=Path(root).resolve();handoff=Path(handoff).resolve();money=Path(money).resolve();runtime=Path(runtime).resolve()
    m,candidate,payloads,manifest_hash=prepared(root,handoff);preflight(money)
    attempt=handoff/'editorial-local-attempt';attempt.mkdir(mode=0o700) # exclusive: no automatic retries
    results=[]
    try:
        operations=[('youtube-agent-skill',op) for op in payloads]+[('youtube-clipper-skill','clip'),('youtube-clipper-skill','captions')]
        for tool,operation in operations:
            prepared(root,handoff);require(sha(handoff/'handoff.json')==manifest_hash)
            folder=attempt/operation;folder.mkdir(mode=0o700)
            if tool=='youtube-agent-skill':
                input_path=folder/'input.json';exclusive(input_path,payloads[operation]);suffix='.json'
            else:
                input_path=candidate if operation=='clip' else attempt/'clip/result.mp4';suffix='.mp4'
            output=folder/('result'+suffix)
            job={'tool':tool,'operation':operation,'input':str(input_path),'output':str(output),'publication_enabled':False,'paid_generation_enabled':False}
            if operation=='clip':job.update(start=0,end=m['teaser_end_seconds'])
            if operation=='captions':job['subtitles']=str(handoff/'teaser.srt')
            input_hash=sha(input_path);subtitle_hash=sha(handoff/'teaser.srt');job_path=folder/'job.json';exclusive(job_path,job)
            env={'PATH':'/usr/bin:/bin','PYTHONDONTWRITEBYTECODE':'1','PUBLICATION_ENABLED':'false','MONEY_FACTORY_ROOT':str(money)}
            subprocess.run([sys.executable,str(root/'scripts/repository_tools.py'),str(job_path),'--runtime',str(runtime)],cwd=root,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=660,check=True)
            prepared(root,handoff);require(sha(handoff/'handoff.json')==manifest_hash and sha(input_path)==input_hash and sha(handoff/'teaser.srt')==subtitle_hash)
            receipt=read(str(output)+'.receipt.json')
            require(receipt.get('status')=='PASS' and receipt.get('publication_enabled') is False and receipt.get('tool')==tool and receipt.get('operation')==operation and receipt.get('revision')==PINS[tool] and receipt.get('output_sha256')==sha(output))
            record={'tool':tool,'operation':operation,'revision':PINS[tool],'input_sha256':input_hash,'output':str(output),'output_sha256':sha(output),'receipt_sha256':sha(str(output)+'.receipt.json')}
            if tool=='youtube-agent-skill':
                data=read(output)
                require(data.get('status')=='PASS' and data.get('execution_status')=='PASS' and data.get('exit_code')==0 and data.get('upstream_revision')==PINS[tool] and data.get('input_sha256')==input_hash and data.get('operation')==operation and data.get('publication_enabled') is False and data.get('paid_generation_enabled') is False and data.get('production_ready') is False and isinstance(data.get('findings'),(dict,list)))
                record['findings']=data['findings'] # preserve negative editorial findings
            else:
                media=receipt.get('media') or {};duration=media.get('duration')
                require(type(duration) in (float,int) and math.isfinite(duration) and duration>0 and any(s.get('codec_type')=='video' for s in media.get('streams',[])))
                record['media']=media
                if operation=='captions':record['subtitle_sha256']=subtitle_hash
            results.append(record)
        report={'schema_version':1,'status':'LOCAL_OPERATIONS_VERIFIED_REVIEW_REQUIRED','candidate_sha256':m['candidate_sha256'],'build_run_id':m['build_run_id'],'source_handoff_sha256':manifest_hash,'operations':results,'publication_enabled':False,'production_approved':False,'scope':'Offline heuristic findings and local derivatives only. No audience prediction, exact keyframe trim, subtitle readability, creative approval or installation-wide readiness.'}
        exclusive(handoff/'editorial-review.json',report)
        return report
    except Exception:
        exclusive(attempt/'blocked.json',{'status':'BLOCKED','reason':'EDITORIAL_OPERATION_FAILED_OR_UNVERIFIED','publication_enabled':False,'production_approved':False,'completed_operations':len(results)})
        raise ValueError('EDITORIAL_OPERATION_FAILED_OR_UNVERIFIED') from None

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',required=True);p.add_argument('--handoff',required=True);p.add_argument('--money-factory');p.add_argument('--runtime');p.add_argument('--execute-reviewed-local',action='store_true');a=p.parse_args()
    if not a.execute_reviewed_local:
        m,_,_,_=prepared(a.root,a.handoff);print(json.dumps({'status':'INPUTS_VERIFIED_EXECUTION_DISABLED','candidate_sha256':m['candidate_sha256'],'publication_enabled':False}));return
    require(bool(a.money_factory) and bool(a.runtime));print(json.dumps(execute(a.root,a.handoff,a.money_factory,a.runtime,authorized=True)))
if __name__=='__main__':main()
