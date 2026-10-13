#!/usr/bin/env python3
"""Reconcile a review of the existing draft, preserving bound build evidence."""
import argparse, copy, datetime, hashlib, json, re
from pathlib import Path
try:
    from scripts.rendered_visual_parity import evaluate_visual_review
except ModuleNotFoundError:
    from rendered_visual_parity import evaluate_visual_review

def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def reconcile(video, references, review_path, report_path, draft_path, technical_path, run_id, source_commit):
    if type(run_id) is not int or run_id<=0 or not re.fullmatch('[0-9a-f]{40}',source_commit):raise ValueError('Invalid reconciliation identity')
    report=json.loads(Path(report_path).read_text());draft=json.loads(Path(draft_path).read_text());technical=json.loads(Path(technical_path).read_text())
    candidate=digest(video)
    if any(x.get('candidate_sha256')!=candidate for x in (report,draft,technical)):raise ValueError('Candidate evidence does not match existing draft')
    if report.get('run_id')!=draft.get('run_id') or type(report.get('run_id')) is not int:raise ValueError('Draft/build run identity mismatch')
    if any(x.get('publication_enabled') is not False for x in (report,draft,technical)) or report.get('production_approved') is not False or draft.get('production_approved') is not False:raise ValueError('Only unapproved publication-disabled drafts may be reconciled')
    prior_technical=report.get('checks',{}).get('technical_video',{})
    if digest(technical_path)!=prior_technical.get('receipt_sha256'):raise ValueError('Technical receipt hash does not match recorded build')
    if technical.get('status')!=prior_technical.get('status') or technical.get('status') not in ('PASS','FAIL','BLOCKED'):raise ValueError('Technical receipt status mismatch')
    if technical['status']=='PASS' and (not technical.get('checks') or any(v is not True for v in technical['checks'].values())):raise ValueError('Technical PASS contradicts its checks')
    judgment=evaluate_visual_review(references,video,json.loads(Path(review_path).read_text()))
    evidence={'schema_version':1,'candidate_sha256':candidate,'status':judgment['status'],
              'reason':judgment['reason'],'visual_review':judgment,'visual_review_sha256':digest(review_path),
              'publication_enabled':False,'production_approved':False}
    payload=(json.dumps(evidence,indent=2,sort_keys=True)+'\n').encode()
    updated=copy.deepcopy(report)
    # Keep the original build receipt immutable across repeated review updates.
    updated.setdefault('original_build_checks',{})
    updated['original_build_checks'].setdefault('style_parity',copy.deepcopy(report['checks']['style_parity']))
    updated['checks']['style_parity']={'status':judgment['status'],'failed_checks':[] if judgment['status']=='PASS' else ['framewise_style_parity'],
                                     'reason':judgment['reason'],'receipt_sha256':hashlib.sha256(payload).hexdigest()}
    updated['status']='REVIEW_REQUIRED' if all(v.get('status')=='PASS' for v in updated['checks'].values()) else 'BLOCKED'
    updated['remaining_review']={'full_audiovisual':'NOT_APPROVED','competitive_motion':'NOT_VERIFIED'}
    updated['review_reconciliation']={'run_id':run_id,'source_commit':source_commit,'source_report_sha256':digest(report_path),
                                      'candidate_sha256':candidate,'technical_receipt_sha256':digest(technical_path),
                                      'review_sha256':digest(review_path),'recorded_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    # Preserve original build run/source/outcome; this run reviews, never rerenders.
    return updated,payload

def main():
    p=argparse.ArgumentParser()
    for name in ('video','references','review','report','draft','technical','source-commit','out-report','out-evidence'):p.add_argument('--'+name,required=True)
    p.add_argument('--run-id',required=True,type=int);a=p.parse_args()
    report,evidence=reconcile(a.video,a.references,a.review,a.report,a.draft,a.technical,a.run_id,a.source_commit)
    Path(a.out_report).parent.mkdir(parents=True,exist_ok=True);Path(a.out_report).write_text(json.dumps(report,indent=2)+'\n')
    Path(a.out_evidence).parent.mkdir(parents=True,exist_ok=True);Path(a.out_evidence).write_bytes(evidence)
    print(json.dumps({'status':report['status'],'style_parity':report['checks']['style_parity']['status'],'candidate_sha256':report['candidate_sha256']}))
if __name__=='__main__':main()
