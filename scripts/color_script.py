#!/usr/bin/env python3
import argparse,json
from pathlib import Path
PALETTES={"setup":["#FFFFFF","#111111","#11A7A7"],"danger":["#FFFFFF","#111111","#EF3E36"],"reward":["#FFFFFF","#111111","#F4C542"],"resolution":["#FFFFFF","#111111","#11A7A7"]}
def apply(ccsd):
    scenes=[]
    n=max(1,len(ccsd.get("scenes",[])))
    for i,s in enumerate(ccsd.get("scenes",[])):
        phase="setup" if i<n*.3 else "danger" if i<n*.65 else "reward" if i<n*.85 else "resolution"
        x=dict(s);x["color_script"]={"phase":phase,"palette":PALETTES[phase]};scenes.append(x)
    out=dict(ccsd);out["scenes"]=scenes;out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","scenes":len(r.get("scenes",[]))}))
if __name__=="__main__":main()
