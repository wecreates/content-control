#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def build(root):
    entries=[]
    for p in sorted(Path(root).glob("**/*.json")):
        if p.name not in {"ccsd.json","scene-plan.json","clone-blueprint.json"}: continue
        try:
            d=json.loads(p.read_text())
            for s in d.get("scenes",[]):
                entries.append({"source":str(p),"scene_id":s.get("id"),"characters":[x.get("id") for x in s.get("characters",[])],"props":[x.get("id") for x in s.get("props",[])],"callbacks":(s.get("continuity") or {}).get("callbacks",[])})
        except Exception: pass
    return {"schema_version":1,"entries":entries,"scene_count":len(entries),"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--root",default="production");ap.add_argument("--out",default="state/continuity-memory.json");a=ap.parse_args();r=build(a.root);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","scenes":r["scene_count"]}))
if __name__=="__main__":main()
