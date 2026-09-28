#!/usr/bin/env python3
import argparse,json
from pathlib import Path
DEPTS=["story","animation","layout","editorial","sound","lighting","continuity","bored_viewer"]
def review_dailies(animatic):
    shots=animatic.get("shots",[])
    departments={}
    avg=sum(float(x.get("duration",0)) for x in shots)/max(1,len(shots))
    for d in DEPTS:
        notes=[]
        if d=="story" and len(shots)<3: notes.append("increase escalation before payoff")
        if d=="animation" and any(not x.get("motion") for x in shots): notes.append("replace static beat with acted state change")
        if d=="editorial" and avg>2.5: notes.append("tighten average shot duration")
        if d=="sound" and all(not x.get("temp_sfx") for x in shots): notes.append("add punctuation SFX to action beats")
        if d=="bored_viewer" and avg>2.2: notes.append("add faster retention reset")
        departments[d]={"status":"PASS" if not notes else "NOTES","notes":notes}
    blocking=[d for d,v in departments.items() if v["status"]=="BLOCK"]
    return {"schema_version":1,"status":"PASS" if not blocking else "FAIL","departments":departments,"blocking":blocking,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--animatic",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=review_dailies(json.loads(Path(a.animatic).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"departments":len(r["departments"])}))
if __name__=="__main__":main()
