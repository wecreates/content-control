"""Persist generated V2 files on fresh main without rebasing binary commits."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

PATHS={'draft':('public-review/v2-draft.mp4','state/v2-draft.json'),
       'report':('state/v2-production-status.json',),
       'review':('state/visual-analysis/reconciled-review.json','state/v2-production-status.json')}

def git(repo,*args,env=None,check=True,input=None):
    r=subprocess.run(['git','-C',str(repo),*args],input=input,capture_output=True,env=env)
    if check and r.returncode:raise RuntimeError(r.stderr.decode()[-1500:])
    return r

def persist(repo,kind):
    repo=Path(repo).resolve();paths=PATHS[kind]
    # Snapshot before fetching: generated artifacts belong to this run, not main.
    payload={p:(repo/p).read_bytes() for p in paths}
    incoming=json.loads(payload[paths[-1]])
    run_id=incoming.get('run_id')
    if type(run_id) is not int or run_id<=0:raise ValueError('Positive run_id required')
    if incoming.get('publication_enabled') is not False or incoming.get('production_approved') is not False:raise ValueError('Unapproved, publication-disabled artifacts only')
    if kind=='draft' and (incoming.get('full_av_review') is not False or incoming.get('candidate_sha256')!=hashlib.sha256(payload[paths[0]]).hexdigest()):raise ValueError('Draft hash and pending review required')
    if kind=='review' and incoming.get('checks',{}).get('style_parity',{}).get('receipt_sha256')!=hashlib.sha256(payload[paths[0]]).hexdigest():raise ValueError('Review receipt hash mismatch')
    with tempfile.TemporaryDirectory(prefix='v2-index-') as tmp:
        env={**os.environ,'GIT_INDEX_FILE':str(Path(tmp)/'index')}
        for attempt in range(3):
            git(repo,'fetch','origin','main')
            head=git(repo,'rev-parse','origin/main').stdout.decode().strip()
            old=git(repo,'show',f'{head}:{paths[-1]}',check=False)
            if old.returncode==0:
                previous=json.loads(old.stdout)
                prior_id=previous.get('run_id',0)
                if type(prior_id) is not int or prior_id<0:raise ValueError('Invalid previous run_id')
                if kind=='review':
                    reconciliation=incoming.get('review_reconciliation',{})
                    if hashlib.sha256(old.stdout).hexdigest()!=reconciliation.get('source_report_sha256'):
                        return {'status':'SUPERSEDED','reason':'Build report changed during review'}
                    draft=git(repo,'show',f'{head}:state/v2-draft.json',check=False)
                    media=git(repo,'show',f'{head}:public-review/v2-draft.mp4',check=False)
                    if draft.returncode or media.returncode or json.loads(draft.stdout).get('candidate_sha256')!=incoming.get('candidate_sha256') or hashlib.sha256(media.stdout).hexdigest()!=incoming.get('candidate_sha256'):
                        return {'status':'SUPERSEDED','reason':'Draft changed during review'}
                if prior_id>run_id:return {'status':'SUPERSEDED','run_id':run_id,'newer_run_id':prior_id}
            if kind=='review' and old.returncode!=0:raise ValueError('Existing build report required for review')
            git(repo,'read-tree',head,env=env)
            for path,data in payload.items():
                blob=git(repo,'hash-object','-w','--stdin',input=data).stdout.decode().strip()
                git(repo,'update-index','--add','--cacheinfo',f'100644,{blob},{path}',env=env)
            tree=git(repo,'write-tree',env=env).stdout.decode().strip()
            if tree==git(repo,'rev-parse',head+'^{tree}').stdout.decode().strip():return {'status':'UNCHANGED','run_id':run_id}
            message=f'Save V2 {kind} for run {run_id} without production approval [skip ci]\n'
            commit=git(repo,'commit-tree',tree,'-p',head,input=message.encode()).stdout.decode().strip()
            pushed=git(repo,'push','origin',f'{commit}:refs/heads/main',check=False)
            if pushed.returncode==0:return {'status':'SAVED','run_id':run_id,'commit':commit}
        raise RuntimeError('Could not persist after three fresh-head attempts; no force push used')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--kind',choices=PATHS,required=True);p.add_argument('--repo',default='.');a=p.parse_args()
    print(json.dumps(persist(a.repo,a.kind)))
