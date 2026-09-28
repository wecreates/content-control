#!/usr/bin/env python3
import argparse,json
from pathlib import Path

def build_manifest(ccsd):
    segs=[]
    for s in sorted(ccsd.get("scenes",[]),key=lambda x:float(x.get("start",0))):
        for d in (s.get("audio") or {}).get("dialogue",[]):
            text=(d.get("text") or "").strip()
            if not text: continue
            segs.append({
              "scene_id":s.get("id"),
              "start":s.get("start"),
              "speaker":d.get("speaker","narrator"),
              "text":text,
              "performance":d.get("performance",{}),
            })
    return {"schema_version":1,"status":"PASS" if segs else "EMPTY","segments":segs,"publication_enabled":False}

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=build_manifest(json.loads(Path(a.ccsd).read_text()))
    Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":r["status"],"segments":len(r["segments"])},sort_keys=True))

if __name__=="__main__":main()
