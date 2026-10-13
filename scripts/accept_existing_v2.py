#!/usr/bin/env python3
"""Apply authentic reviews to existing bytes; never generate or publish socially."""
import argparse
import json
import os
import math
from pathlib import Path
import subprocess

from scripts.revalidate_v2_candidate import validate_inputs, digest
from scripts.v2_build_status import RECEIPTS

REVIEW_PATH='projects/v2/amex-vs-chase-boss-fight/rendered-creative-review.json'


def assess(root, artifact, run):
    root, artifact=Path(root),Path(artifact)
    expected,candidate=validate_inputs(root,artifact,run)
    report=json.loads((root/'state/v2-production-status.json').read_text())
    reasons=[]
    for name in RECEIPTS:
        if name!='style_parity' and report.get('checks',{}).get(name,{}).get('status')!='PASS':
            reasons.append(name+'_not_passed')
    from scripts.rendered_visual_parity import evaluate_visual_review
    visual_path=root/'state/visual-analysis/frame-review.json'
    visual=evaluate_visual_review(root/'reference/frames',candidate,json.loads(visual_path.read_text()))
    if visual.get('status')!='PASS':reasons.append('current_candidate_visual_review_not_passed')
    media=json.loads((artifact/'receipts/render.json').read_text())
    # Duration remains measured and hash-bound, even when visual review blocks.
    duration=media.get('metrics',{}).get('duration')
    if type(duration) not in (int,float) or not math.isfinite(duration) or duration<=0:raise ValueError('Measured media duration required')
    evidence={'candidate_sha256':expected,'duration_seconds':duration,'verified':True}
    review_path=root/REVIEW_PATH
    review=json.loads(review_path.read_text()) if review_path.exists() else None
    command='import fs from "node:fs"; import {creativeHandoff} from "./creative-handoff.js"; const x=JSON.parse(fs.readFileSync(0,"utf8")); console.log(JSON.stringify(creativeHandoff(x.review,x.hash,x.media)));'
    gate=subprocess.run(['node','--input-type=module','-e',command],cwd=root,input=json.dumps({'review':review,'hash':expected,'media':evidence}),text=True,capture_output=True,check=True)
    creative=json.loads(gate.stdout)
    reasons.extend(creative['reasons'])
    if creative.get('ready') is not True and not creative['reasons']:reasons.append('creative_review_not_passed')
    result={'schema_version':1,'status':'ELIGIBLE' if not reasons else 'BLOCKED','candidate_sha256':expected,
            'original_run_id':run['id'],'reasons':reasons,'production_approved':False,'publication_enabled':False,'render_attempted':False,
            'visual_review_sha256':digest(visual_path),'creative_review_sha256':digest(review_path) if review else None}
    health=None
    if not reasons:
        health={'status':'READY','candidate_sha256':expected,'publication_enabled':False,'technical_qa':True,
                'visual_parity_qa':True,'creative_qa':True,'creative_review':review,'media_evidence':evidence,
                'visual_review_sha256':digest(visual_path),'creative_review_sha256':digest(review_path),'original_run_id':run['id']}
    return result,health,candidate


def promote(root,candidate,health):
    if health is None:raise ValueError('Cannot promote blocked evidence')
    root=Path(root)
    if digest(candidate)!=health['candidate_sha256'] or digest(root/REVIEW_PATH)!=health['creative_review_sha256'] or digest(root/'state/visual-analysis/frame-review.json')!=health['visual_review_sha256']:
        raise ValueError('Candidate or review changed during validation')
    target=root/'public-review/v2-boss-fight.mp4';target.parent.mkdir(parents=True,exist_ok=True);temporary=target.with_suffix('.tmp')
    temporary.write_bytes(Path(candidate).read_bytes());os.replace(temporary,target)
    destination=root/'state/v2-health.json';destination.parent.mkdir(parents=True,exist_ok=True);temporary=destination.with_suffix('.tmp')
    temporary.write_text(json.dumps(health,indent=2)+'\n');os.replace(temporary,destination)


def validate_promoted_runtime(root):
    """Use the deployed runtime's actual byte validator before persisting preview."""
    from scripts.v2_runtime_tick import validate_candidate
    root=Path(root)
    result=validate_candidate(root/'state/v2-health.json',root/'public-review/v2-boss-fight.mp4',
                              publication_enabled=os.getenv('PUBLICATION_ENABLED','false').lower()!='false')
    destination=root/'state/v2-runtime-validation.json'
    destination.parent.mkdir(parents=True,exist_ok=True)
    temporary=destination.with_suffix('.tmp')
    temporary.write_text(json.dumps(result,indent=2)+'\n');os.replace(temporary,destination)
    if result.get('status')!='READY':
        raise ValueError('Promoted runtime validation blocked: '+','.join(result.get('reasons',[])))
    return result


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--root',default='.');parser.add_argument('--artifact',required=True);parser.add_argument('--run-metadata',required=True);parser.add_argument('--out',required=True);parser.add_argument('--promote',action='store_true');args=parser.parse_args()
    try:
        result,health,candidate=assess(args.root,args.artifact,json.loads(Path(args.run_metadata).read_text()))
        if args.promote and health is not None:promote(args.root,candidate,health);result['status']='PREVIEW_ACCEPTED'
    except (ValueError,OSError,KeyError,TypeError,subprocess.SubprocessError) as error:
        result={'status':'BLOCKED','reasons':[str(error)],'production_approved':False,'publication_enabled':False,'render_attempted':False}
    out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
    return 0 if result['status'] in ('ELIGIBLE','PREVIEW_ACCEPTED') else 2


if __name__=='__main__':raise SystemExit(main())
