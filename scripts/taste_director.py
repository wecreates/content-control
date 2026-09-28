#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def score_taste(f):
    diversity=(min(4,float(f.get("shot_scale_diversity",0)))/4 + min(6,float(f.get("transition_diversity",0)))/6)/2
    static_penalty=min(1,float(f.get("static_fraction",0)))
    repeat_penalty=min(1,float(f.get("composition_repeat",0)))
    joke=min(1,float(f.get("joke_density",0)))
    metaphor=min(1,float(f.get("visual_metaphor_density",0)))
    score=.28*diversity+.2*joke+.2*metaphor+.18*(1-static_penalty)+.14*(1-repeat_penalty)
    reasons=[]
    if diversity<.5: reasons.append("visual grammar too repetitive")
    if static_penalty>.35: reasons.append("too much static screen time")
    if repeat_penalty>.45: reasons.append("composition repeats too often")
    if joke<.3: reasons.append("insufficient visual/comedic punctuation")
    if metaphor<.3: reasons.append("finance concepts insufficiently physicalized")
    return {"schema_version":1,"status":"PASS" if score>=.62 and not any(x in reasons for x in ["too much static screen time"]) else "REJECT","taste_score":round(score,3),"reasons":reasons,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--features",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=score_taste(json.loads(Path(a.features).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r,sort_keys=True));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
