#!/usr/bin/env python3
import argparse,json
from pathlib import Path
ORDER=["BLOCKING","SPLINE","POLISH","FINAL"]
def advance(state,notes):
    out=json.loads(json.dumps(state));cur=out.get("stage","BLOCKING")
    blocking=[n for n in notes.get("notes",[]) if n.get("blocking")]
    if not blocking and cur in ORDER and cur!="FINAL": out["stage"]=ORDER[ORDER.index(cur)+1]
    out["blocking_notes"]=blocking;out["approved"]=out["stage"]=="FINAL" and not blocking;out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--state",required=True);ap.add_argument("--notes",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=advance(json.loads(Path(a.state).read_text()),json.loads(Path(a.notes).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"stage":r["stage"],"approved":r["approved"]}))
if __name__=="__main__":main()
