#!/usr/bin/env python3
import argparse,json,math
from pathlib import Path

def score_take(t):
    if not t.get("audio_pass"): return -999.0
    sim=float(t.get("transcript_similarity",0) or 0)
    sem=float(t.get("semantic_recall",0) or 0)
    err=float(t.get("duration_error_ratio",1) or 1)
    return round(sim*.55+sem*.35-max(0,err)*.10,6)

def choose_take(takes):
    ranked=sorted(takes,key=score_take,reverse=True)
    if not ranked or score_take(ranked[0])<0: raise ValueError("no valid voice takes")
    out=dict(ranked[0]);out["score"]=score_take(ranked[0]);return out

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--takes",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    data=json.loads(Path(a.takes).read_text());takes=data.get("takes",data if isinstance(data,list) else [])
    best=choose_take(takes)
    r={"schema_version":1,"status":"PASS","best":best,"ranked":[{**x,"score":score_take(x)} for x in sorted(takes,key=score_take,reverse=True)],"publication_enabled":False}
    Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","best":best.get("path"),"score":best.get("score")},sort_keys=True))

if __name__=="__main__":main()
