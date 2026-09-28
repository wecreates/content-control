#!/usr/bin/env python3
import argparse,json
from pathlib import Path

def critique(room):
    pitches=room.get("pitches",[])
    seen=set();rows=[]
    for p in pitches:
        sig=(p.get("arc"),tuple(p.get("turns",[])),p.get("location_changes"),p.get("visual_metaphors"))
        distinct=sig not in seen;seen.add(sig)
        feats=p.get("selection_features") or {}
        score=.34*float(feats.get("visuality",0))+.28*float(feats.get("surprise",0))+.24*float(feats.get("clarity",0))+.14*min(1,len(p.get("callbacks",[]))*.5)
        rows.append({"id":p.get("id"),"distinct":distinct,"score":round(score,3),"arc":p.get("arc"),"notes":[] if distinct else ["too structurally similar to another pitch"]})
    good=[x for x in rows if x["distinct"]]
    selected=max(good,key=lambda x:x["score"])["id"] if good else None
    return {"schema_version":1,"status":"PASS" if len(good)>=8 and selected else "FAIL","pitches":rows,"selected_id":selected,"distinct_count":len(good),"publication_enabled":False}

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--room",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=critique(json.loads(Path(a.room).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"distinct":r["distinct_count"],"selected":r["selected_id"]}));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
