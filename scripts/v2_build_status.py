#!/usr/bin/env python3
"""Summarize actual build receipts without granting production approval."""
import argparse,datetime,hashlib,json,os,re,stat
from pathlib import Path

RECEIPTS={'voices':'receipts/voice.json','sound_mix':'receipts/mix.json','transcription':'receipts/transcription.json','captions':'captions.json','caption_frames':'receipts/caption-frames.json','technical_video':'receipts/render.json','style_parity':'receipts/visual-parity.json'}
DIAGNOSTICS={'caption_windows':'receipts/clip-transcription.json'}
RECEIPTS.update(character_binding='receipts/character-binding.json',phone_viewport='receipts/phone-viewport.json')
# These generators emit explicit boolean checks; voices, mix, captions and
# viewport use different receipt shapes and must not be rejected for that.
CHECKED_RECEIPTS={'transcription','caption_frames','technical_video','style_parity','character_binding'}
def file_identity(info):
    return (info.st_dev,info.st_ino,info.st_size,info.st_mtime_ns,info.st_ctime_ns)
def read_receipt(path):
    # O_NONBLOCK precedes fstat so a replaced path or FIFO cannot stall a job.
    fd=os.open(path,os.O_RDONLY|os.O_NONBLOCK)
    try:
        before=os.fstat(fd);limit=512*1024
        if not stat.S_ISREG(before.st_mode) or not 0<before.st_size<=limit:raise ValueError('Regular bounded receipt required')
        chunks=[];size=0
        while size<=limit:
            chunk=os.read(fd,min(65536,limit+1-size))
            if not chunk:break
            chunks.append(chunk);size+=len(chunk)
        if size>limit or size!=before.st_size or file_identity(os.fstat(fd))!=file_identity(before) or file_identity(os.stat(path))!=file_identity(before):raise ValueError('Receipt changed while reading')
        return b''.join(chunks)
    finally:os.close(fd)
def candidate_digest(video):
    fd=None
    try:
        fd=os.open(video,os.O_RDONLY|os.O_NONBLOCK)
        before=os.fstat(fd);limit=512*1024*1024
        if not stat.S_ISREG(before.st_mode) or not 0<before.st_size<=limit:return None
        digest=hashlib.sha256();size=0
        while True:
            chunk=os.read(fd,1024*1024)
            if not chunk:break
            size+=len(chunk)
            if size>limit:return None
            digest.update(chunk)
        if size!=before.st_size or file_identity(os.fstat(fd))!=file_identity(before) or file_identity(os.stat(video))!=file_identity(before):return None
        return digest.hexdigest()
    except OSError:return None
    finally:
        if fd is not None:os.close(fd)
def classify_readiness(checks,candidate_generated):
    technical=bool(candidate_generated) and all(checks.get(name,{}).get('status')=='PASS' for name in RECEIPTS if name!='style_parity')
    visual=checks.get('style_parity',{})
    if not technical:
        return {'status':'BLOCKED','technical_status':'BLOCKED','review_status':'TECHNICAL_PREREQUISITES_MISSING','next_action':'Resolve missing or failed original technical evidence; no approval inferred.'}
    if visual.get('status')=='PASS':
        return {'status':'REVIEW_REQUIRED','technical_status':'PASS','review_status':'FULL_AUDIOVISUAL_REVIEW_REQUIRED','next_action':'Apply authentic full audiovisual and competitor review to these existing candidate bytes; do not regenerate to apply review.'}
    if visual.get('status')=='FAIL':
        return {'status':'BLOCKED','technical_status':'PASS','review_status':'CREATIVE_REPAIR_REQUIRED','next_action':'Address documented visual findings; review failure is not a technical rendering failure.'}
    if visual.get('status') in {'BLOCKED','NOT_RUN'} and not any(x in visual.get('failed_checks',[]) for x in ['publication_disabled_not_verified','exact_candidate_binding_missing']):
        return {'status':'AWAITING_REVIEW','technical_status':'PASS','review_status':'CURRENT_CANDIDATE_VISUAL_REVIEW_REQUIRED','next_action':'Review the exact existing candidate, then revalidate without regeneration. Full audiovisual and competitor approval remain mandatory.'}
    return {'status':'BLOCKED','technical_status':'PASS','review_status':'REVIEW_EVIDENCE_INVALID','next_action':'Repair invalid review evidence before revalidation.'}

def summarize(root,run_id,source_commit,outcome):
    root=Path(root)
    if not isinstance(run_id,int) or isinstance(run_id,bool) or run_id<=0: raise ValueError('Invalid run ID')
    if not re.fullmatch('[0-9a-f]{40}',source_commit): raise ValueError('Invalid source commit')
    if outcome not in {'success','failure','cancelled'}: raise ValueError('Invalid workflow outcome')
    checks={}
    video=root/'render/v2-boss-fight.mp4'
    digest=candidate_digest(video)
    for name,relative in {**RECEIPTS,**DIAGNOSTICS}.items():
        p=root/relative
        if not p.exists(): checks[name]={'status':'NOT_RUN'};continue
        try:
            receipt_bytes=read_receipt(p)
            r=json.loads(receipt_bytes)
            if not isinstance(r,dict):raise ValueError('Receipt must be an object')
            status=r.get('status')
            if status not in {'PASS','FAIL','BLOCKED'}:raise ValueError('Invalid receipt status')
            raw_checks=r.get('checks')
            failed=[k for k,v in raw_checks.items() if v is not True] if isinstance(raw_checks,dict) else []
            if status=='PASS' and (name in CHECKED_RECEIPTS or 'checks' in r) and (not isinstance(raw_checks,dict) or not raw_checks):
                status='INVALID_RECEIPT';failed.append('explicit_nonempty_checks_required')
            if failed and status=='PASS':status='INVALID_RECEIPT'
            if r.get('publication_enabled') is not False:
                status='BLOCKED';failed.append('publication_disabled_not_verified')
            if name in {'technical_video','style_parity','character_binding','phone_viewport'} and (not digest or r.get('candidate_sha256')!=digest):
                status='BLOCKED';failed.append('exact_candidate_binding_missing')
            checks[name]={'status':status,'failed_checks':failed,'receipt_sha256':hashlib.sha256(receipt_bytes).hexdigest()}
            if isinstance(r.get('reason'),str):checks[name]['reason']=r['reason'][:240]
        except (OSError,ValueError,TypeError):checks[name]={'status':'INVALID_RECEIPT'}
    diagnostics={name:checks.pop(name) for name in DIAGNOSTICS}
    video=root/'render/v2-boss-fight.mp4'
    current_digest=candidate_digest(video)
    if current_digest!=digest:
        for check in checks.values():
            check['status']='BLOCKED'
            check.setdefault('failed_checks',[]).append('candidate_changed_during_summary')
    digest=current_digest
    return {'schema_version':1,'run_id':run_id,'source_commit':source_commit,'workflow_outcome':outcome,'recorded_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'workflow_url':f'https://github.com/wecreates/content-control/actions/runs/{run_id}','candidate_sha256':digest,'candidate_generated':digest is not None,'checks':checks,'diagnostics':diagnostics,**classify_readiness(checks,digest is not None),'production_approved':False,'publication_enabled':False,'scope':'Recorded build result; no full audiovisual or competitor approval.'}
def should_replace(existing,incoming):
    # Never let a delayed retry replace a newer build report.
    if not isinstance(existing,dict):raise ValueError('Invalid existing report')
    old=existing.get('run_id',0)
    if not isinstance(old,int) or isinstance(old,bool):raise ValueError('Invalid existing run ID')
    return incoming['run_id']>=old
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--root',required=True);ap.add_argument('--run-id',required=True,type=int);ap.add_argument('--source-commit',required=True);ap.add_argument('--outcome',required=True);ap.add_argument('--out',required=True);a=ap.parse_args()
    out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(summarize(a.root,a.run_id,a.source_commit,a.outcome),indent=2)+'\n')

