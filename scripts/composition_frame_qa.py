#!/usr/bin/env python3
import argparse,json
from pathlib import Path
import cv2,numpy as np

def inspect_dir(folder):
    files=sorted([p for p in Path(folder).glob("*") if p.suffix.lower() in {".jpg",".jpeg",".png"}])
    rows=[];ok=True
    for p in files:
        im=cv2.imread(str(p))
        if im is None: continue
        h,w=im.shape[:2];gray=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY)
        edges=cv2.Canny(gray,80,160)>0
        inset=max(1,int(min(h,w)*.05))
        border=np.zeros_like(edges);border[:inset,:]=1;border[-inset:,:]=1;border[:,:inset]=1;border[:,-inset:]=1
        border_activity=float(edges[border.astype(bool)].mean())
        edge_density=float(edges.mean())
        white_fraction=float((gray>238).mean())
        center=edges[int(h*.2):int(h*.82),int(w*.12):int(w*.88)]
        center_activity=float(center.mean()) if center.size else 0
        checks={
          "safe_border":border_activity<.12,
          "not_overcluttered":edge_density<.24,
          "meaningful_subject":center_activity>.004,
          "white_space_preserved":white_fraction>.42,
        }
        pass_frame=all(checks.values());ok=ok and pass_frame
        rows.append({"file":p.name,"checks":checks,"border_activity":round(border_activity,6),"edge_density":round(edge_density,6),"white_fraction":round(white_fraction,6),"center_activity":round(center_activity,6)})
    return {"schema_version":1,"status":"PASS" if ok and rows else "FAIL","frames":rows,"publication_enabled":False}

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--frames",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=inspect_dir(a.frames);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"frames":len(r["frames"])}));raise SystemExit(0 if r["status"]=="PASS" else 2)

if __name__=="__main__":main()
