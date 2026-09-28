#!/usr/bin/env python3
import argparse,json
from pathlib import Path
from scripts.typography_director import direct_text
def apply(ccsd,width=720,height=1280):
    out=json.loads(json.dumps(ccsd))
    for s in out.get("scenes",[]):
        text=s.get("text") or {}
        if text.get("content"):
            text["design"]=direct_text(text["content"],width,height)
            text["zone"]=text["design"]["zone"]
        s["text"]=text
    out["publication_enabled"]=False
    return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--width",type=int,default=720);ap.add_argument("--height",type=int,default=1280);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=apply(json.loads(Path(a.ccsd).read_text()),a.width,a.height);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS"}))
if __name__=="__main__":main()
