#!/usr/bin/env python3
import argparse,json
from pathlib import Path
ORDER=["MISSING","IMPLEMENTED","INTEGRATED","TESTED","RENDER_PROVEN"]
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--registry",required=True);ap.add_argument("--id",type=int,required=True);ap.add_argument("--state",choices=ORDER,required=True);ap.add_argument("--evidence",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();d=json.loads(Path(a.registry).read_text());row=next((x for x in d["capabilities"] if x["id"]==a.id),None)
 if not row or not 1501<=a.id<=2000:raise SystemExit("unknown Batch 10 capability")
 if ORDER.index(a.state)>ORDER.index(row["state"])+1:raise SystemExit("cannot skip lifecycle")
 if a.state in {"TESTED","RENDER_PROVEN"} and not Path(a.evidence).is_file():raise SystemExit("evidence required")
 row["state"]=a.state;row.setdefault("evidence",[]).append(a.evidence);d["publication_enabled"]=False;Path(a.out).write_text(json.dumps(d,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","id":a.id,"state":a.state}))
if __name__=="__main__":main()
