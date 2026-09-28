#!/usr/bin/env python3
import argparse,json,cv2,numpy as np
from pathlib import Path
PERSONAS=["bored_scroller","finance_beginner","credit_card_nerd","skeptic","comedy_first","silent_viewer","mobile_viewer","share_likelihood"]
def video_metrics(path):
    cap=cv2.VideoCapture(str(path));fps=cap.get(cv2.CAP_PROP_FPS) or 24;idx=0;prev=None;motion=[];edges=[];stride=max(1,round(fps/5))
    while True:
        ok,f=cap.read()
        if not ok:break
        if idx%stride==0:
            g=cv2.cvtColor(cv2.resize(f,(160,284)),cv2.COLOR_BGR2GRAY);edges.append(float((cv2.Canny(g,80,160)>0).mean()))
            if prev is not None: motion.append(float(cv2.absdiff(g,prev).mean()/255))
            prev=g
        idx+=1
    cap.release()
    return {"motion":float(np.mean(motion)) if motion else 0,"motion_active":float(np.mean([x>.008 for x in motion])) if motion else 0,"edge_density":float(np.mean(edges)) if edges else 0}
def run(video,ccsd):
    vm=video_metrics(video);scenes=ccsd.get("scenes",[])
    joke=sum(len((s.get("choreography") or {}).get("visual_gags",[])) for s in scenes)/max(1,len(scenes))
    metaph=sum(bool((s.get("choreography") or {}).get("visual_metaphor")) for s in scenes)/max(1,len(scenes))
    text=sum(bool((s.get("text") or {}).get("content")) for s in scenes)/max(1,len(scenes))
    prop_action=sum(bool(s.get("props")) for s in scenes)/max(1,len(scenes))
    conflict=sum(len(s.get("characters",[]))>=1 and bool((s.get("story") or {}).get("turn") or (s.get("story") or {}).get("purpose")) for s in scenes)/max(1,len(scenes))
    camera_variety=min(1,len({((s.get("camera") or {}).get("shot_scale"),(s.get("camera") or {}).get("move")) for s in scenes})/max(1,min(5,len(scenes))))
    environment_variety=min(1,len({(s.get("environment") or {}).get("id") for s in scenes})/max(1,min(4,len(scenes))))
    base=.30+min(.23,vm["motion_active"]*.28)+min(.10,joke*.10)+min(.10,metaph*.10)+min(.05,text*.05)+.09*prop_action+.08*conflict+.08*camera_variety+.05*environment_variety
    rows=[]
    bias={"bored_scroller":.02,"finance_beginner":.04,"credit_card_nerd":0,"skeptic":-.04,"comedy_first":.02,"silent_viewer":-.01,"mobile_viewer":0,"share_likelihood":-.03}
    for p in PERSONAS:
        score=max(0,min(1,base+bias[p]));rows.append({"id":p,"score":round(score,3),"pass":score>=.58,"evidence":{"motion_active":round(vm["motion_active"],3),"joke_density":round(joke,3),"metaphor_density":round(metaph,3),"prop_action":round(prop_action,3),"conflict":round(conflict,3),"camera_variety":round(camera_variety,3),"environment_variety":round(environment_variety,3)}})
    return {"schema_version":2,"status":"PASS" if sum(x["pass"] for x in rows)>=6 else "REWRITE","personas":rows,"video_metrics":vm,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--video",required=True);ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=run(a.video,json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"passes":sum(x["pass"] for x in r["personas"])}));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
