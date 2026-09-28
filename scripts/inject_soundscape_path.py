#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--scene-plan",required=True);ap.add_argument("--file",required=True);ap.add_argument("--public-path",required=True);a=ap.parse_args()
    p=Path(a.scene_plan);d=json.loads(p.read_text())
    d["soundscape_path"]=a.public_path if Path(a.file).is_file() and Path(a.file).stat().st_size>1000 else None
    p.write_text(json.dumps(d,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":"PASS","soundscape_path":d["soundscape_path"]},sort_keys=True))
if __name__=="__main__":main()
