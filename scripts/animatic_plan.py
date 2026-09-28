#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def build_animatic(ccsd):
    shots=[]
    for s in ccsd.get("scenes",[]):
        dialogue=" ".join(x.get("text","") for x in (s.get("audio") or {}).get("dialogue",[]))
        shots.append({"scene_id":s["id"],"start":s["start"],"end":s["end"],"duration":float(s["end"])-float(s["start"]),"board_frame":f"boards/{s['id']}.png","camera":s["camera"],"temp_dialogue":dialogue,"temp_sfx":(s.get("audio") or {}).get("sfx",[]),"motion":bool(s.get("characters") or s.get("props"))})
    return {"schema_version":1,"status":"PASS" if shots else "FAIL","shots":shots,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=build_animatic(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"shots":len(r["shots"])}))
if __name__=="__main__":main()
