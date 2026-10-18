#!/usr/bin/env python3
import argparse, json, hashlib, math
from pathlib import Path
from urllib.parse import urlparse
import cv2
import numpy as np

METRIC_WEIGHTS={"edge_density":0.35,"white_fraction":0.35,"mean_brightness":0.30}

def frame_metrics(img):
    gray=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    edge=cv2.Canny(gray,80,180)
    return {
        "edge_density":float((edge>0).mean()),
        "white_fraction":float((gray>245).mean()),
        "mean_brightness":float(gray.mean()/255.0),
    }

def compare_metric_series(refs,cands,threshold=0.14):
    if not math.isfinite(threshold) or threshold<=0:
        raise ValueError("threshold must be finite and positive")
    if len(refs)!=len(cands):
        raise ValueError("reference and candidate sample counts must match")
    n=min(len(refs),len(cands))
    if n<2:
        return {"framewise_style_parity":False,"mean_frame_distance":1.0,"frame_distances":[],"paired_frames":n}
    distances=[]
    components={k:[] for k in METRIC_WEIGHTS}
    for r,c in zip(refs[:n],cands[:n]):
        d=0.0
        for k,w in METRIC_WEIGHTS.items():
            rv,cv=float(r[k]),float(c[k])
            if not all(math.isfinite(v) and 0<=v<=1 for v in (rv,cv)):
                raise ValueError("frame metrics must be finite normalized values")
            delta=abs(rv-cv)*w
            d+=delta
            components[k].append(delta)
        distances.append(d)
    mean=float(np.mean(distances))
    p90=float(np.percentile(distances,90))
    return {
        "framewise_style_parity":mean<=threshold and p90<=threshold*1.5,
        "mean_frame_distance":mean,
        "p90_frame_distance":p90,
        "frame_distances":distances,
        "paired_frames":n,
        "weighted_mean_distance_components":{k:float(np.mean(v)) for k,v in components.items()},
    }

def explain_comparison(comp):
    if not comp.get('paired_frames',0)>=2:
        return 'Insufficient paired reference frames; no comparison established.'
    components=comp['weighted_mean_distance_components']
    key=max(components,key=components.get)
    if comp['framewise_style_parity']:
        return 'Sampled brightness and edge statistics match; this does not establish creative or competitive quality.'
    return (f"Reference frame statistics differ; dominant component: {key} "
            f"({components[key]:.4f} of {comp['mean_frame_distance']:.4f}). "
            'This does not assess creative quality or override the required brand style.')

def sample_video(path,count):
    if type(count) is not int or count<2:
        raise ValueError("at least two candidate samples required")
    cap=cv2.VideoCapture(str(path))
    try:
        fps=float(cap.get(cv2.CAP_PROP_FPS) or 0)
        frame_count=float(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if not math.isfinite(fps) or fps<=0 or not math.isfinite(frame_count) or frame_count<1 or not frame_count.is_integer():
            raise RuntimeError("invalid candidate video metadata")
        total=int(frame_count)
        if total<count:
            raise RuntimeError("insufficient distinct candidate frames")
        out=[]
        for i in range(count):
            pos=round((total-1)*i/(count-1))
            if not cap.set(cv2.CAP_PROP_POS_FRAMES,pos):
                raise RuntimeError(f"cannot seek candidate frame {pos}")
            ok,frame=cap.read()
            if not ok or frame is None:
                raise RuntimeError(f"cannot sample candidate frame {pos}")
            # OpenCV reports the next frame index after a successful read.
            # Unsupported position reporting is not evidence of correct sampling.
            actual=float(cap.get(cv2.CAP_PROP_POS_FRAMES))
            if not math.isfinite(actual) or abs(actual-(pos+1))>.5:
                raise RuntimeError(f"candidate seek position unverified at frame {pos}")
            out.append(frame_metrics(frame))
        return out,total/fps
    finally:
        cap.release()


def load_reference_metrics(path):
    refs=[]
    for p in sorted(Path(path).glob("ref-*.jpg")):
        img=cv2.imread(str(p))
        if img is None:
            raise RuntimeError(f"cannot decode reference frame: {p.name}")
        refs.append(frame_metrics(img))
    if len(refs)<4:
        raise RuntimeError("insufficient reference frames")
    return refs

def sha256(path):
    h=hashlib.sha256()
    with open(path,"rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):
            h.update(chunk)
    return h.hexdigest()

def compare_aligned_images(reference, candidate):
    """Qualified same-art comparison; not cross-story creative/style approval."""
    try:
        from scripts.style_structure_diagnostic import compare_structure
    except ModuleNotFoundError:
        from style_structure_diagnostic import compare_structure
    result=compare_structure(reference,candidate)
    iou=result.get('mask_iou')
    distance=1-iou if iou is not None else None
    return {'foreground_distance':distance,
            'foreground_present_in_both':result.get('foreground_present_in_both',False),
            'calibrated':False,'acceptance_effect':'none',
            'scope':'Aligned foreground geometry only; not creative approval'}


def qualified_structure_comparison(reference_dir, candidate_video, contract, threshold=0.14):
    blocked={'status':'BLOCKED','blocker':'BLOCKED_UNSUPPORTED_REFERENCE','framewise_style_parity':False,'reason':'Reference provenance and exact-candidate aligned-frame contract required; raw background difference is diagnostic only.'}
    if not isinstance(contract,dict) or contract.get('method')!='aligned_line_art' or contract.get('status')!='VERIFIED':
        return blocked
    if contract.get('candidate_sha256')!=sha256(candidate_video):
        return dict(blocked,reason='Reference alignment is not bound to this candidate')
    source=urlparse(str(contract.get('source_url','')))
    pairs=contract.get('pairs')
    if source.scheme!='https' or not source.hostname or source.username or source.password or not isinstance(pairs,list) or len(pairs)<4:
        return blocked
    allowed={p.name:p for p in Path(reference_dir).glob('ref-*.jpg')}
    cap=cv2.VideoCapture(str(candidate_video))
    results=[]
    seen=set()
    try:
        total=cap.get(cv2.CAP_PROP_FRAME_COUNT)
        for pair in pairs:
            if not isinstance(pair,dict):return blocked
            name=pair.get('reference_file');index=pair.get('candidate_frame');seconds=pair.get('source_seconds')
            if name not in allowed or name in seen or pair.get('reference_sha256')!=sha256(allowed[name]):return blocked
            if type(index) is not int or not math.isfinite(total) or not 0<=index<total:return blocked
            if type(seconds) not in (float,int) or not math.isfinite(seconds) or seconds<0:return blocked
            seen.add(name)
            if not cap.set(cv2.CAP_PROP_POS_FRAMES,index):return blocked
            ok,image=cap.read();actual=cap.get(cv2.CAP_PROP_POS_FRAMES)
            if not ok or not math.isfinite(actual) or abs(actual-index-1)>.5:return blocked
            results.append(compare_aligned_images(cv2.imread(str(allowed[name])),image))
    finally:
        cap.release()
    return {'status':'BLOCKED','framewise_style_parity':False,
            'blocker':'STRUCTURE_CALIBRATION_REQUIRED',
            'method':'aligned_line_art_experiment','pairs':results,
            'reason':'Aligned measurements available, but no independently validated structural acceptance calibration exists. Full audiovisual and competitor review remain mandatory.'}


def analyze_comparison(reference_dir, candidate_video, output_dir):
    """Produce inspectable cross-story evidence without treating similarity as approval.

    Reference order and candidate duration-normalized order are paired only for
    display. They are not asserted to depict the same story beat or geometry.
    """
    files=sorted(Path(reference_dir).glob('ref-*.jpg'))
    if len(files)<4:
        raise ValueError('At least four decoded reference frames required')
    manifest_path=Path(reference_dir)/'reference-manifest.json'
    provenance={'status':'UNVERIFIED_LEGACY_FRAMES','source_url':None,
                'reason':'Reference images have no source-video extraction manifest; analysis is diagnostic only.'}
    if manifest_path.exists():
        manifest=json.loads(manifest_path.read_text())
        entries=manifest.get('frames')
        if not isinstance(entries,list) or len(entries)!=len(files):
            raise ValueError('Reference manifest frame set does not match images')
        indexed={entry.get('file'):entry for entry in entries if isinstance(entry,dict)}
        if len(indexed)!=len(files) or set(indexed)!={path.name for path in files}:
            raise ValueError('Reference manifest has duplicate or missing frame entries')
        for path in files:
            if indexed[path.name].get('sha256')!=sha256(path):
                raise ValueError(f'Reference manifest hash mismatch: {path.name}')
        provenance={'status':'FRAME_HASHES_VERIFIED','manifest_sha256':sha256(manifest_path),
                    'source_url':manifest.get('source_url'),
                    'source_url_attribution_verified':False,
                    'source_video_sha256':manifest.get('source_video_sha256'),
                    'reason':'Frame bytes match extraction manifest; source URL attribution is not independently verified.'}
    output_dir=Path(output_dir)
    output_dir.mkdir(parents=True,exist_ok=True)
    cap=cv2.VideoCapture(str(candidate_video))
    rows=[]; records=[]; references=[]; candidates=[]
    try:
        total=float(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps=float(cap.get(cv2.CAP_PROP_FPS))
        if not math.isfinite(total) or not total.is_integer() or total<len(files) or not math.isfinite(fps) or fps<=0:
            raise ValueError('Invalid or insufficient candidate frames')
        for i,path in enumerate(files):
            reference=cv2.imread(str(path))
            if reference is None:raise ValueError(f'Cannot decode reference {path.name}')
            index=round((int(total)-1)*i/(len(files)-1))
            if not cap.set(cv2.CAP_PROP_POS_FRAMES,index):raise ValueError('Candidate seek failed')
            ok,candidate=cap.read(); actual=float(cap.get(cv2.CAP_PROP_POS_FRAMES))
            if not ok or candidate is None or not math.isfinite(actual) or abs(actual-index-1)>.5:
                raise ValueError('Candidate sampling position unverified')
            references.append(frame_metrics(reference));candidates.append(frame_metrics(candidate))
            records.append({'reference_file':path.name,'reference_sha256':sha256(path),
                            'candidate_frame':index,'candidate_seconds':index/fps,
                            'reference_metrics':references[-1],'candidate_metrics':candidates[-1]})
            # Letterbox rather than distort mixed source aspect ratios.
            def tile(image,label):
                width,height=320,360
                canvas=np.full((height+36,width,3),245,dtype=np.uint8)
                h,w=image.shape[:2];scale=min(width/w,height/h)
                resized=cv2.resize(image,(max(1,round(w*scale)),max(1,round(h*scale))),interpolation=cv2.INTER_AREA)
                rh,rw=resized.shape[:2];x=(width-rw)//2;y=36+(height-rh)//2
                canvas[y:y+rh,x:x+rw]=resized
                cv2.putText(canvas,label,(8,24),cv2.FONT_HERSHEY_SIMPLEX,.48,(20,20,20),1,cv2.LINE_AA)
                return canvas
            rows.append(np.concatenate([tile(reference,path.name),tile(candidate,f'Candidate {index/fps:.2f}s / frame {index}')],axis=1))
    finally:
        cap.release()
    sheets=[]
    for start in range(0,len(rows),4):
        path=output_dir/f'comparison-{start//4+1:02d}.jpg'
        if not cv2.imwrite(str(path),np.concatenate(rows[start:start+4],axis=0)):
            raise RuntimeError('Could not write comparison sheet')
        sheets.append({'file':path.name,'sha256':sha256(path),'first_pair':start,'pair_count':len(rows[start:start+4])})
    # Distributional descriptors remain useful across different story beats;
    # frame-to-frame deltas must not be represented as motion or retention.
    distributions={}
    for key in METRIC_WEIGHTS:
        r=np.array([m[key] for m in references]);c=np.array([m[key] for m in candidates])
        distributions[key]={'reference_mean':float(r.mean()),'candidate_mean':float(c.mean()),
                            'reference_range':[float(r.min()),float(r.max())],
                            'candidate_range':[float(c.min()),float(c.max())],
                            'mean_difference':float(c.mean()-r.mean())}
    return {'status':'COMPLETE','acceptance_effect':'none','production_approved':False,
            'publication_enabled':False,'candidate_sha256':sha256(candidate_video),
            'pairing':'duration-normalized display order; not semantic or same-art alignment',
            'scope':'Decoded sampled visual evidence and cross-story appearance distributions; no full audiovisual review, motion, retention, or competitive-quality approval.',
            'reference_provenance':provenance,
            'sample_count':len(records),'samples':records,'contact_sheets':sheets,
            'appearance_distributions':distributions}



REVIEW_DIMENSIONS={'typography','character_scale','staging','character_consistency','phone_readability'}

def evaluate_visual_review(reference_dir, candidate_video, review):
    """Validate a documented sampled-frame judgment, never full audiovisual approval.

    Hashes bind the claim to artifacts, not the reviewer's honesty. The review
    must come from an actual documented inspection, not generated metric scores.
    """
    base={'status':'BLOCKED','blocker':'INVALID_VISUAL_REVIEW','framewise_style_parity':False,
          'scope':'Documented sampled static-frame review only; full audiovisual review remains separate.',
          'production_approved':False,'publication_enabled':False}
    def blocked(reason):return dict(base,reason=reason)
    if not isinstance(review,dict):return blocked('Visual review object required')
    candidate=review.get('candidate');reviewer=review.get('reviewer');coverage=review.get('coverage')
    if not isinstance(candidate,dict) or candidate.get('sha256')!=sha256(candidate_video):
        return blocked('Review candidate hash does not match exact video')
    if not isinstance(reviewer,dict) or not all(isinstance(reviewer.get(k),str) and reviewer[k].strip() for k in ('id','method')):
        return blocked('Reviewer identity and inspection method required')
    if review.get('review_type')!='independent_sampled_frame_visual_analysis':
        return blocked('Unsupported visual review method')
    if not isinstance(review.get('reviewed_at'),str) or not review['reviewed_at'].strip():
        return blocked('Review timestamp required')
    if not isinstance(coverage,dict):return blocked('Sample coverage required')
    indices=coverage.get('sampled_frame_indices')
    if not isinstance(indices,list) or len(indices)<8 or any(type(i) is not int for i in indices) or len(set(indices))!=len(indices):
        return blocked('At least eight distinct reviewed frame indices required')
    if coverage.get('sample_count')!=len(indices):return blocked('Review sample count inconsistent')
    cap=cv2.VideoCapture(str(candidate_video))
    try:
        total=float(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if not math.isfinite(total) or not total.is_integer() or any(not 0<=i<total for i in indices):
            return blocked('Reviewed frame index outside candidate')
        for index in indices:
            if not cap.set(cv2.CAP_PROP_POS_FRAMES,index):return blocked('Reviewed frame seek failed')
            ok,image=cap.read();actual=float(cap.get(cv2.CAP_PROP_POS_FRAMES))
            if not ok or image is None or not math.isfinite(actual) or abs(actual-index-1)>.5:
                return blocked('Reviewed candidate frame cannot be decoded at claimed position')
    finally:cap.release()
    files={p.name:p for p in Path(reference_dir).glob('ref-*.jpg')}
    references=review.get('reference_frames')
    if len(files)<4 or not isinstance(references,list) or len(references)!=len(files):
        return blocked('Complete reference frame hash set required')
    seen=set()
    for entry in references:
        if not isinstance(entry,dict) or not isinstance(entry.get('path'),str):return blocked('Invalid reference entry')
        name=Path(entry['path']).name
        if name not in files or name in seen or entry.get('sha256')!=sha256(files[name]):
            return blocked('Reference hashes or frame set do not match')
        seen.add(name)
    findings=review.get('findings');decision=review.get('decision');issues=review.get('unresolved_issues')
    if decision not in ('PASS','FAIL') or not isinstance(issues,list) or any(not isinstance(x,str) or not x.strip() for x in issues):
        return blocked('Explicit PASS/FAIL decision and unresolved issues list required')
    if not isinstance(findings,list):return blocked('Visual rubric findings required')
    rubric={}
    for finding in findings:
        if not isinstance(finding,dict):return blocked('Invalid rubric finding')
        dimension=finding.get('dimension')
        if dimension not in REVIEW_DIMENSIONS:continue
        if dimension in rubric:return blocked('Duplicate rubric dimension')
        evidence=finding.get('candidate_frames');observation=finding.get('observation')
        if not isinstance(evidence,list) or not evidence or any(type(i) is not int or i not in indices for i in evidence):
            return blocked('Every rubric dimension requires inspected frame evidence')
        if not isinstance(observation,str) or not observation.strip():return blocked('Every rubric dimension requires an observation')
        if finding.get('status') not in ('PASS','MISMATCH','NOT_VERIFIED'):
            return blocked('Unsupported rubric status')
        rubric[dimension]=finding
    if set(rubric)!=REVIEW_DIMENSIONS:return blocked('Visual rubric is incomplete')
    adverse=[k for k,v in rubric.items() if v['status']!='PASS']
    if decision=='PASS' and (issues or adverse):return blocked('PASS contradicts unresolved issues or adverse findings')
    if decision=='FAIL' and not (issues or adverse):return blocked('FAIL requires documented adverse findings or unresolved issues')
    return {'status':decision,'framewise_style_parity':decision=='PASS',
            'method':'documented_sampled_frame_visual_review','reviewer':reviewer,
            'reviewed_at':review['reviewed_at'],'reviewed_frame_indices':indices,
            'rubric':rubric,'unresolved_issues':issues,
            'reason':'Documented exact-artifact sampled visual review '+decision.lower()+'. Full audiovisual approval remains separate.',
            'scope':base['scope'],'production_approved':False,'publication_enabled':False}


def comparison_summary(report):
    """Expose the actual approval outcome separately from pixel diagnostics.

    Keep the historical distance keys for log consumers, but never present
    them without their non-acceptance scope or hide an exact-review blocker.
    """
    approval=report.get('visual_review') or report.get('qualified_structure') or {}
    diagnostic=report['raw_pixel_diagnostic']
    return {
        'status':report['status'],
        'analysis_status':report['analysis_status'],
        'candidate_sha256':report['candidate_sha256'],
        'reason':report['reason'],
        'blocker':approval.get('blocker'),
        'failed_checks':[name for name,value in report['checks'].items() if value is not True],
        'mean_frame_distance':diagnostic['mean_frame_distance'],
        'p90_frame_distance':diagnostic['p90_frame_distance'],
        'raw_pixel_diagnostic_acceptance_effect':diagnostic['acceptance_effect'],
    }


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--reference-dir",required=True)
    ap.add_argument("--candidate-video",required=True)
    ap.add_argument("--out",required=True)
    ap.add_argument("--threshold",type=float,default=0.14)
    ap.add_argument("--reference-contract",help="Verified exact-candidate aligned-frame provenance JSON; absent contract blocks approval")
    ap.add_argument("--analysis-only",action="store_true",help="Exit successfully for completed diagnostic analysis; never changes approval status")
    ap.add_argument("--visual-review",help="Documented exact-artifact sampled visual-review JSON; does not approve full audiovisual production")
    a=ap.parse_args()
    refs=load_reference_metrics(a.reference_dir)
    cands,duration=sample_video(a.candidate_video,len(refs))
    comp=compare_metric_series(refs,cands,a.threshold)
    contract=json.loads(Path(a.reference_contract).read_text()) if a.reference_contract else None
    structural=qualified_structure_comparison(a.reference_dir,a.candidate_video,contract,a.threshold)
    review=json.loads(Path(a.visual_review).read_text()) if a.visual_review else None
    approval=evaluate_visual_review(a.reference_dir,a.candidate_video,review) if a.visual_review else structural
    analysis=analyze_comparison(a.reference_dir,a.candidate_video,Path(a.out).parent / (Path(a.out).stem+"-evidence"))
    checks={
        "candidate_decodes":duration>0,
        "reference_frames_present":len(refs)>=4,
        "framewise_style_parity":approval["framewise_style_parity"],
    }
    report={
        "schema_version":2,
        "analysis_status":analysis["status"],
        "visual_analysis":analysis,
        "engine":"reference-qualified-parity-v2",
        "candidate_sha256":sha256(a.candidate_video),
        "candidate_duration_seconds":duration,
        "reference_frames":len(refs),
        "reference_manifest":[{"file":p.name,"sha256":sha256(p)} for p in sorted(Path(a.reference_dir).glob('ref-*.jpg'))],
        "threshold":a.threshold,
        "metric_weights":METRIC_WEIGHTS,
        "scope":"Sampled visual analysis and optional documented static-frame review; full audiovisual approval remains separate.",
        "reason":approval["reason"],
        "raw_pixel_diagnostic":dict(comp,reason=explain_comparison(comp),acceptance_effect="none"),
        "qualified_structure":structural,
        "visual_review":approval if a.visual_review else None,
        "visual_review_sha256":sha256(a.visual_review) if a.visual_review else None,
        "checks":checks,
        **{k:v for k,v in comp.items() if k!="framewise_style_parity"},
        "framewise_style_parity":approval["framewise_style_parity"],
        "status":"BLOCKED" if approval["status"]=="BLOCKED" else ("PASS" if all(checks.values()) else "FAIL"),
        "publication_enabled":False,
    }
    Path(a.out).parent.mkdir(parents=True,exist_ok=True)
    Path(a.out).write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    print(json.dumps(comparison_summary(report),sort_keys=True))
    raise SystemExit(0 if report["status"]=="PASS" or (a.analysis_only and analysis["status"]=="COMPLETE") else 2)

if __name__=="__main__":
    main()
