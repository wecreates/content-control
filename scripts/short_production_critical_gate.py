#!/usr/bin/env python3
import argparse,json
from pathlib import Path
REQUIRED=["story","character_identity","layout","voice","audio","animation","render","factual","sync","mobile_playback","final_av_review"]
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--receipts",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();root=Path(a.receipts);checks={}
 for k in REQUIRED:
  p=root/f"{k}.json";ok=False
  if p.is_file():
   try:
    d=json.loads(p.read_text());ok=d.get("status")=="PASS" and d.get("publication_enabled") is False
   except:pass
  checks[k]=ok
 failed=[k for k,v in checks.items() if not v];r={"schema_version":1,"status":"PASS" if not failed else "BLOCKED","checks":checks,"failed":failed,"review_ready":not failed,"publication_enabled":False};Path(a.out).parent.mkdir(parents=True,exist_ok=True);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r));raise SystemExit(0 if not failed else 2)
if __name__=="__main__":main()
