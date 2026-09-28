#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def apply(ccsd):
    out=json.loads(json.dumps(ccsd))
    for s in out.get("scenes",[]):
        words=sum(len(x.get("text","").split()) for x in (s.get("audio") or {}).get("dialogue",[]))
        for ch in s.get("characters",[]):
            ch["face_track"]={"blink_interval_frames":72,"eye_target":"active_prop" if s.get("props") else "camera","mouth_states":["closed","open","wide"] if words else ["closed"],"brow_state":"worried" if ch.get("id")=="dave" else "flat" if ch.get("id")=="points_monk" else "mischievous","thought_pause_frames":6}
    out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS"}))
if __name__=="__main__":main()
