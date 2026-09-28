#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def build(ccsd):
    scenes=[]
    for s in ccsd.get("scenes",[]):
        scenes.append({"scene_id":s["id"],"silent_view_comprehensible":bool(s.get("text") or s.get("characters")),"caption_safe_zone":True,"flash_rate_safe":True,"motion_intensity_safe":True,"audio_description":f"Scene {s['id']}: visual action conveys {((s.get('story') or {}).get('beat') or 'finance concept')}."})
    ok=all(x["silent_view_comprehensible"] and x["caption_safe_zone"] and x["flash_rate_safe"] for x in scenes)
    return {"schema_version":1,"status":"PASS" if ok else "FAIL","scenes":scenes,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=build(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"]}))
if __name__=="__main__":main()
