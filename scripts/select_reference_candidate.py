#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def score(r):
    shots=len(r.get("shot_timeline",[]));motion=max([x.get("motion_activity",0) for x in r.get("shot_timeline",[])] or [0]);mech=len(r.get("transferable_mechanics",[]));dur=float((r.get("source") or {}).get("duration_seconds",0) or 0)
    perf=r.get("performance") or {}
    views=max(0,float(perf.get("views",0) or 0));likes=max(0,float(perf.get("likes",0) or 0));comments=max(0,float(perf.get("comments",0) or 0))
    engagement=((likes+comments)/views) if views>0 else 0
    import math
    performance_bonus=min(30,math.log10(max(1,views))*3 + min(.12,engagement)*100)
    return round(min(100,shots*3+motion*150+mech*5+(10 if 3<=dur<=60 else 0)+performance_bonus),2)
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--root",default="production/reference-clones");ap.add_argument("--out",default="state/reference-selection.json");a=ap.parse_args()
    rows=[]
    for p in Path(a.root).glob("*/reference.json"):
        try:r=json.loads(p.read_text());rows.append({"id":(r.get("source") or {}).get("id"),"path":str(p),"score":score(r)})
        except Exception:pass
    rows.sort(key=lambda x:x["score"],reverse=True);res={"schema_version":1,"status":"PASS" if rows else "EMPTY","selected":rows[0] if rows else None,"candidates":rows,"publication_enabled":False};Path(a.out).write_text(json.dumps(res,indent=2,sort_keys=True)+"\n");print(json.dumps(res,sort_keys=True))
if __name__=="__main__":main()
