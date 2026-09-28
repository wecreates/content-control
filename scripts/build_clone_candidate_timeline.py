#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--scene-plan",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    sp=json.loads(Path(a.scene_plan).read_text());shots=[]
    for s in sp.get("scenes",[]): shots.append({"start":s["start"],"end":s["end"],"camera":s["camera"],"shot_scale":s["shot_scale"],"character":s["character"]})
    r={"schema_version":1,"shots":shots,"publication_enabled":False};Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","shots":len(shots)}))
if __name__=="__main__":main()
