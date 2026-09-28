#!/usr/bin/env python3
import argparse,json,subprocess,sys
from pathlib import Path

def run(cmd): subprocess.run(cmd,check=True)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--video",required=True)
    ap.add_argument("--id",required=True)
    ap.add_argument("--source-type",default="chat_upload")
    ap.add_argument("--characters",default="dave,points_monk,cashback_goblin")
    ap.add_argument("--root",default="production/reference-clones")
    a=ap.parse_args()

    pkg=Path(a.root)/a.id
    pkg.mkdir(parents=True,exist_ok=True)
    base=pkg/"reference-base.json"
    optical=pkg/"optical-flow.json"
    motion=pkg/"motion-summary.json"
    ref=pkg/"reference.json"
    bp=pkg/"clone-blueprint.json"
    sp=pkg/"scene-plan.json"

    run([sys.executable,"scripts/decompose_reference_video.py","--video",a.video,"--id",a.id,"--source-type",a.source_type,"--out",str(base)])
    run([sys.executable,"scripts/reference_optical_flow.py","--video",a.video,"--out",str(optical)])
    run([sys.executable,"scripts/reference_motion_v2.py","--reference",str(base),"--out",str(motion)])
    run([sys.executable,"scripts/reference_clone_enrich.py","--reference",str(base),"--optical",str(optical),"--motion",str(motion),"--out",str(ref)])
    run([sys.executable,"scripts/validate_reference_clone.py","--reference",str(ref)])
    run([sys.executable,"scripts/reference_clone_compiler.py","--reference",str(ref),"--characters",a.characters,"--out",str(bp)])
    run([sys.executable,"scripts/validate_reference_clone.py","--clone",str(bp)])
    run([sys.executable,"scripts/generate_clone_scene_plan.py","--blueprint",str(bp),"--out",str(sp)])
    print(json.dumps({"status":"PASS","package":str(pkg),"reference":str(ref),"optical_flow":str(optical),"motion_summary":str(motion),"blueprint":str(bp),"scene_plan":str(sp),"publication_enabled":False},sort_keys=True))

if __name__=="__main__":
    main()
