#!/usr/bin/env python3
import argparse,json,cv2,numpy as np
from pathlib import Path
def extract(video,scene_plan):
    cap=cv2.VideoCapture(str(video));fps=cap.get(cv2.CAP_PROP_FPS) or 24;idx=0;prev=None;motion=[];hashes=[];stride=max(1,round(fps/5))
    while True:
        ok,f=cap.read()
        if not ok:break
        if idx%stride==0:
            g=cv2.cvtColor(cv2.resize(f,(96,54)),cv2.COLOR_BGR2GRAY)
            if prev is not None:motion.append(float(cv2.absdiff(g,prev).mean()/255))
            hashes.append(cv2.resize(g,(16,9)).astype(np.float32))
            prev=g
        idx+=1
    cap.release()
    static=float(np.mean([m<.008 for m in motion])) if motion else 1
    repeat=0
    if len(hashes)>2:
        sims=[]
        for a,b in zip(hashes,hashes[1:]):
            sims.append(float(np.mean(np.abs(a-b))<8))
        repeat=float(np.mean(sims))
    scenes=scene_plan.get("scenes",[])
    scales=len({s.get("shot_scale") for s in scenes if s.get("shot_scale")})
    trans=len({((s.get("choreography") or {}).get("transition_out") or {}).get("type") for s in scenes})
    jokes=sum(len((s.get("choreography") or {}).get("visual_gags",[])) for s in scenes)/max(1,len(scenes))
    metaph=sum(bool((s.get("choreography") or {}).get("visual_metaphor")) for s in scenes)/max(1,len(scenes))
    return {"shot_scale_diversity":scales,"transition_diversity":trans,"static_fraction":round(static,4),"composition_repeat":round(repeat,4),"joke_density":round(jokes,4),"visual_metaphor_density":round(metaph,4)}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--video",required=True);ap.add_argument("--scene-plan",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=extract(a.video,json.loads(Path(a.scene_plan).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r,sort_keys=True))
if __name__=="__main__":main()
