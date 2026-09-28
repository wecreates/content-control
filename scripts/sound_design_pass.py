#!/usr/bin/env python3
import argparse,json
from pathlib import Path
MOTIFS={"dave":"soft_pop","points_monk":"dry_clack","cashback_goblin":"coin_chirp"}
def apply(ccsd):
    out=json.loads(json.dumps(ccsd))
    for s in out.get("scenes",[]):
        audio=s.setdefault("audio",{});sfx=audio.setdefault("sfx",[])
        for ch in s.get("characters",[]): sfx.append({"type":MOTIFS.get(ch.get("id"),"soft_pop"),"time":float(s["start"])+.08,"function":"character_signature"})
        if s.get("props"): sfx.append({"type":"prop_contact","time":float(s["start"])+.35,"function":"punctuate_action"})
        audio["room_tone"]="light_neutral";audio["ducking_db"]=-8;audio["sfx_sync_tolerance_ms"]=80
    out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS"}))
if __name__=="__main__":main()
