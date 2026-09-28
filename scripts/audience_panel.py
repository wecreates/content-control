#!/usr/bin/env python3
import argparse,json
from pathlib import Path
PERSONAS=["bored_scroller","finance_beginner","credit_card_nerd","skeptic","comedy_first","silent_viewer","mobile_viewer","share_likelihood"]
def run_panel(metrics):
    personas=[]
    hook=float(metrics.get("hook_strength",.5));clarity=float(metrics.get("clarity",.5));humor=float(metrics.get("humor",.5));pace=float(metrics.get("pace",.5))
    base=(hook+clarity+humor+pace)/4
    for i,p in enumerate(PERSONAS):
        bias=[.08,.02,.0,-.05,.06,-.03,.01,.04][i]
        score=max(0,min(1,base+bias))
        personas.append({"id":p,"score":round(score,3),"pass":score>=.58})
    return {"schema_version":1,"status":"PASS" if sum(x["pass"] for x in personas)>=6 else "REWRITE","personas":personas,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--metrics",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=run_panel(json.loads(Path(a.metrics).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"personas":len(r["personas"])}))
if __name__=="__main__":main()
