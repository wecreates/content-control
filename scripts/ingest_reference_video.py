#!/usr/bin/env python3
import argparse,json,subprocess,sys,hashlib,os,re,uuid
from datetime import datetime,timezone
from pathlib import Path

def run(cmd): subprocess.run(cmd,check=True,env={**os.environ,"PUBLICATION_ENABLED":"false"})

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--video",required=True)
    ap.add_argument("--id",required=True)
    ap.add_argument("--source-type",default="chat_upload")
    ap.add_argument("--characters",default="dave,points_monk,cashback_goblin")
    ap.add_argument("--root",default="production/reference-clones")
    a=ap.parse_args()

    result=ingest(a)
    print(json.dumps(result,sort_keys=True))

def ingest(a):
    if not isinstance(a.id,str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*",a.id):
        raise ValueError("Reference ID must be a nonempty safe single path component")
    root=Path(a.root).resolve()
    pkg=(root/a.id).resolve()
    if not pkg.is_relative_to(root) or pkg==root:
        raise ValueError("Reference package must remain within root")
    pkg.mkdir(parents=True,exist_ok=True)
    status_path=pkg/"intake-status.json"
    def save(report):
        report["updated_at"]=datetime.now(timezone.utc).isoformat()
        temporary=status_path.with_name(status_path.name+"."+uuid.uuid4().hex+".tmp")
        try:
            temporary.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
            os.replace(temporary,status_path)
        finally:
            temporary.unlink(missing_ok=True)
    base=pkg/"reference-base.json"
    optical=pkg/"optical-flow.json"
    motion=pkg/"motion-summary.json"
    structure=pkg/"reference-structure.json"
    ref=pkg/"reference.json"
    bp=pkg/"clone-blueprint.json"
    sp=pkg/"scene-plan.json"
    plan=[
        ("decompose",[sys.executable,"scripts/decompose_reference_video.py","--video",a.video,"--id",a.id,"--source-type",a.source_type,"--out",str(base)]),
        ("optical_flow",[sys.executable,"scripts/reference_optical_flow.py","--video",a.video,"--out",str(optical)]),
        ("motion_summary",[sys.executable,"scripts/reference_motion_v2.py","--reference",str(base),"--out",str(motion)]),
        ("structure",[sys.executable,"scripts/reference_structure_v2.py","--video",a.video,"--out",str(structure)]),
        ("enrich",[sys.executable,"scripts/reference_clone_enrich.py","--reference",str(base),"--optical",str(optical),"--motion",str(motion),"--structure",str(structure),"--out",str(ref)]),
        ("validate_reference",[sys.executable,"scripts/validate_reference_clone.py","--reference",str(ref)]),
        ("compile_clone",[sys.executable,"scripts/reference_clone_compiler.py","--reference",str(ref),"--characters",a.characters,"--out",str(bp)]),
        ("validate_clone",[sys.executable,"scripts/validate_reference_clone.py","--clone",str(bp)]),
        ("scene_plan",[sys.executable,"scripts/generate_clone_scene_plan.py","--blueprint",str(bp),"--out",str(sp)]),
    ]
    report={"schema_version":1,"status":"RUNNING","scope":"internal_draft_only","publication_enabled":False,"production_approved":False,"attempt_id":uuid.uuid4().hex,"failed_stage":None,"exit_code":None,"artifacts_sha256":{},"stages":[{"name":name,"status":"NOT_STARTED"} for name,_ in plan]}
    # A retry immediately invalidates any stale completed receipt and its hashes.
    save(report)
    for index,(name,cmd) in enumerate(plan):
        report["active_stage"]=name;report["stages"][index]["status"]="RUNNING";save(report)
        try:
            run(cmd)
        except Exception as error:
            code=error.returncode if isinstance(error,subprocess.CalledProcessError) else None
            report.update(status="BLOCKED",failed_stage=name,exit_code=code,active_stage=None)
            report["stages"][index].update(status="BLOCKED",exit_code=code)
            report["failure_kind"]="stage_exit" if code is not None else "stage_execution_error"
            save(report)
            raise
        report["stages"][index].update(status="COMPLETED",exit_code=0);save(report)
    try:
        artifacts={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (ref,bp,sp)}
    except OSError:
        report.update(status="BLOCKED",failed_stage="artifact_verification",exit_code=None,active_stage=None,failure_kind="required_artifact_unavailable")
        save(report)
        raise
    report.update(status="COMPLETED",active_stage=None,exit_code=0,artifacts_sha256=artifacts)
    save(report)
    return report

if __name__=="__main__":
    main()
