#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--blueprint",required=True);ap.add_argument("--lock",default="control/voice-lock-v1.json");ap.add_argument("--out",required=True);a=ap.parse_args()
    bp=json.loads(Path(a.blueprint).read_text());lock=json.loads(Path(a.lock).read_text())
    selected=bp.get("selected_characters",[])
    assignments={"narrator":lock["narrator"]["voice_profile"]}
    for ch in selected: assignments[ch]=lock["characters"][ch]["voice_profile"]
    segs=[{"speaker":k,"voice_profile":v,"text":"profile-lock"} for k,v in assignments.items()]
    r={"schema_version":1,"assignments":assignments,"segments":segs,"publication_enabled":False}
    Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","assignments":assignments},sort_keys=True))
if __name__=="__main__":main()
