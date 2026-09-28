#!/usr/bin/env python3
import argparse,json
from pathlib import Path
PROFILES={
 "narrator":{"pace":1.0,"tone":"dry_confident","breath":"minimal"},
 "dave":{"pace":1.08,"tone":"anxious_excited","breath":"natural"},
 "points_monk":{"pace":.88,"tone":"calm_deadpan","breath":"sparse"},
 "cashback_goblin":{"pace":1.18,"tone":"mischievous_chirp","breath":"none"}
}
def apply(ccsd):
    out=json.loads(json.dumps(ccsd))
    for s in out.get("scenes",[]):
        for d in (s.get("audio") or {}).get("dialogue",[]):
            speaker=d.get("speaker","narrator");p=PROFILES.get(speaker,PROFILES["narrator"])
            d["performance"]={**p,"emphasis_words":d.get("emphasis_words",[]),"pause_after_ms":180 if speaker=="points_monk" else 80,"interruptible":speaker!="narrator"}
    out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS"}))
if __name__=="__main__":main()
