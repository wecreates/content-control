#!/usr/bin/env python3
import argparse,json
from collections import Counter
from pathlib import Path
def aggregate(root):
    refs=[]
    for p in sorted(Path(root).glob("*/reference.json")):
        try: refs.append(json.loads(p.read_text()))
        except Exception: pass
    cameras=Counter();motions=Counter();mechanics=Counter();durations=[]
    for r in refs:
        durations.append(float((r.get("source") or {}).get("duration_seconds",0) or 0))
        cameras.update(r.get("camera_verbs",[]));motions.update(r.get("motion_verbs",[]));mechanics.update(r.get("transferable_mechanics",[]))
    return {"schema_version":1,"reference_count":len(refs),"camera_grammar":cameras.most_common(20),"motion_vocabulary":motions.most_common(20),"transferable_mechanics":mechanics.most_common(30),"mean_duration_seconds":round(sum(durations)/len(durations),3) if durations else None,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--root",default="production/reference-clones");ap.add_argument("--out",default="state/style-memory.json");a=ap.parse_args();r=aggregate(a.root);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r,sort_keys=True))
if __name__=="__main__":main()
