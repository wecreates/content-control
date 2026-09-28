#!/usr/bin/env python3
import argparse,json
from pathlib import Path
LIB={"dave":["idle_anxious","recoil","wallet_clutch","reach","stumble","run","freeze","shrug"],"points_monk":["idle_deadpan","point","door_kick","calculator_drop","ankle_yank","walk","micro_smirk"],"cashback_goblin":["scamper","ankle_drag","card_hug","jump","coin_eyes","sale_point"]}
def apply(ccsd):
    out=json.loads(json.dumps(ccsd))
    for s in out.get("scenes",[]):
        for i,ch in enumerate(s.get("characters",[])):
            cid=ch.get("id","dave");library=LIB.get(cid,LIB["dave"])
            ch["rig"]="remotion/CharacterSystem.jsx";ch["motion_clip"]=ch.get("motion_clip") or library[(i+int(float(s.get("start",0))))%len(library)]
            ch["ik_enabled"]=True;ch["facial_controls"]=True;ch["squash_stretch"]=True
    out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","scenes":len(r.get("scenes",[]))}))
if __name__=="__main__":main()
