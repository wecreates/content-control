#!/usr/bin/env python3
import argparse,json
from pathlib import Path
LANGS=["en","es","fr","de","pt","ja","ko"]
def build(ccsd):
    text=[(s.get("text") or {}).get("content","") for s in ccsd.get("scenes",[])]
    return {"schema_version":1,"source_language":"en","languages":[{"code":x,"text_safe_reflow":True,"voice_localization":True,"caption_regeneration":True,"cultural_review_required":x!="en"} for x in LANGS],"source_text_count":sum(bool(x) for x in text),"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=build(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","languages":len(r["languages"])}))
if __name__=="__main__":main()
