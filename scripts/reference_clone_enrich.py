#!/usr/bin/env python3
import argparse,json
from pathlib import Path

def merge(reference,optical,motion,structure):
    out=json.loads(json.dumps(reference))
    out["optical_flow"]=optical
    out["motion_summary"]=motion
    out["reference_structure"]=structure
    out.setdefault("transferable_mechanics",[]).extend([
      "optical-flow camera velocity curve",
      "motion burst timing",
      "directional movement profile",
      "object-track trajectories",
      "text-region timing",
      "composition heatmaps",
      "transition-mask candidates",
      "contact/impact candidates",
      "reference easing curve"
    ])
    out["publication_enabled"]=False
    return out

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--reference",required=True)
    ap.add_argument("--optical",required=True)
    ap.add_argument("--motion",required=True)
    ap.add_argument("--structure",required=True)
    ap.add_argument("--out",required=True)
    a=ap.parse_args()
    r=merge(
      json.loads(Path(a.reference).read_text()),
      json.loads(Path(a.optical).read_text()),
      json.loads(Path(a.motion).read_text()),
      json.loads(Path(a.structure).read_text())
    )
    Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":"PASS"}))

if __name__=="__main__":
    main()
