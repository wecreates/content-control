#!/usr/bin/env python3
import argparse,json
from pathlib import Path

def apply(ccsd,room,critique):
    out=json.loads(json.dumps(ccsd))
    selected=critique.get("selected_id") or room.get("selected_id")
    pitch=next((p for p in room.get("pitches",[]) if p.get("id")==selected),None)
    if not pitch:return out
    turns=pitch.get("turns",[]);callbacks=pitch.get("callbacks",[])
    scenes=out.get("scenes",[])
    n=max(1,len(scenes))
    for i,s in enumerate(scenes):
        turn=turns[min(len(turns)-1,int(i/max(1,n/len(turns))))] if turns else ""
        story=s.setdefault("story",{})
        story["room_pitch_id"]=selected;story["arc"]=pitch.get("arc");story["turn"]=turn
        if callbacks and i==0:
            s.setdefault("continuity",{}).setdefault("callbacks",[]).append({"type":"seed","value":callbacks[0]["seed"]})
        if callbacks and i==len(scenes)-1:
            s.setdefault("continuity",{}).setdefault("callbacks",[]).append({"type":"payoff","value":callbacks[0]["payoff"]})
    out["story_strategy"]={"selected_id":selected,"arc":pitch.get("arc"),"location_changes":pitch.get("location_changes"),"visual_metaphors":pitch.get("visual_metaphors")}
    out["publication_enabled"]=False
    return out

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--room",required=True);ap.add_argument("--critique",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=apply(json.loads(Path(a.ccsd).read_text()),json.loads(Path(a.room).read_text()),json.loads(Path(a.critique).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","selected":r.get("story_strategy",{}).get("selected_id")}))
if __name__=="__main__":main()
