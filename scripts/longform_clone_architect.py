#!/usr/bin/env python3
import argparse,json,math
from pathlib import Path
def build(ref):
    dur=float((ref.get("source") or {}).get("duration_seconds",0) or 0)
    acts=[];start=0;i=0
    while start<dur:
        end=min(dur,start+45)
        acts.append({"index":i,"start":round(start,3),"end":round(end,3),"pivot_required":True,"callback_seed":i%2==0,"entertainment_engine":["physical_gag","dialogue","metaphor","transformation"][i%4]})
        start=end;i+=1
    return {"schema_version":1,"duration_seconds":dur,"acts":acts,"max_act_seconds":45,"character_source":"control/character-bible-v1.json","publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--reference",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=build(json.loads(Path(a.reference).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","acts":len(r["acts"])}))
if __name__=="__main__":main()
