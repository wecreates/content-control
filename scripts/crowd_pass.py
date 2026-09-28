#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def apply(ccsd):
    out=json.loads(json.dumps(ccsd))
    for s in out.get("scenes",[]):
        env=(s.get("environment") or {}).get("id","")
        count=12 if env in {"airport_lounge","retail_store","bank_counter"} else 0
        s["crowd"]={"enabled":count>0,"count":count,"archetypes":["neutral","impatient","curious"],"seed":abs(hash(s["id"]))%100000}
    out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS"}))
if __name__=="__main__":main()
