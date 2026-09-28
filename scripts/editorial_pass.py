#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def apply(ccsd):
    out=json.loads(json.dumps(ccsd));prev=None
    for i,s in enumerate(out.get("scenes",[])):
        dur=float(s["end"])-float(s["start"])
        s["editorial"]={"cut_type":"hard" if dur<2.3 else "motivated_match","audio_transition":"J" if i%3==1 else "straight","target_duration":round(min(dur,2.2 if dur<5 else dur),3),"retention_reset":i==0 or i%3==0,"continuity_from":prev};prev=s["id"]
    out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS"}))
if __name__=="__main__":main()
