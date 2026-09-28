#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--scene-plan",required=True);ap.add_argument("--voice-file",required=True);ap.add_argument("--voice-public-path",required=True);ap.add_argument("--receipt");a=ap.parse_args()
    p=Path(a.scene_plan);d=json.loads(p.read_text());voice=Path(a.voice_file)
    if voice.is_file() and voice.stat().st_size>0:
        d["voiceover_path"]=a.voice_public_path
        if a.receipt:d["voice_receipt"]=a.receipt
        status="PASS"
    else:
        status="SKIPPED"
    p.write_text(json.dumps(d,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":status,"voiceover_path":d.get("voiceover_path")},sort_keys=True))
if __name__=="__main__":main()
