#!/usr/bin/env python3
import argparse,json,cv2,numpy as np
from pathlib import Path

def review(video,animatic):
    cap=cv2.VideoCapture(str(video));fps=cap.get(cv2.CAP_PROP_FPS) or 24;frames=[];idx=0
    stride=max(1,round(fps/4));prev=None
    while True:
        ok,fr=cap.read()
        if not ok: break
        if idx%stride==0:
            small=cv2.resize(fr,(180,320));gray=cv2.cvtColor(small,cv2.COLOR_BGR2GRAY)
            motion=float(cv2.absdiff(gray,prev).mean()/255) if prev is not None else 0
            edges=float((cv2.Canny(gray,80,160)>0).mean());white=float((gray>238).mean())
            frames.append({"time":round(idx/fps,3),"motion":round(motion,6),"edge_density":round(edges,6),"white_fraction":round(white,6)})
            prev=gray
        idx+=1
    cap.release()
    notes=[];shots=animatic.get("shots",[])
    if frames:
        static=[x for x in frames if x["motion"]<.008]
        if len(static)/len(frames)>.35: notes.append({"department":"animation","blocking":True,"time":static[0]["time"] if static else 0,"note":"rough cut contains too much visually static time"})
        clutter=[x for x in frames if x["edge_density"]>.24]
        if clutter: notes.append({"department":"layout","blocking":True,"time":clutter[0]["time"],"note":"frame density indicates clutter or competing hierarchy"})
        dark=[x for x in frames if x["white_fraction"]<.38]
        if dark: notes.append({"department":"lighting","blocking":False,"time":dark[0]["time"],"note":"white-space/style target drops substantially"})
    durations=[float(x.get("duration",0)) for x in shots]
    if durations and sum(durations)/len(durations)>2.4: notes.append({"department":"editorial","blocking":False,"time":0,"note":"average shot duration is slow for target style"})
    if len({(x.get("camera") or {}).get("shot_scale") for x in shots})<2 and len(shots)>3: notes.append({"department":"layout","blocking":True,"time":0,"note":"shot-scale grammar repeats too heavily"})
    blocking=[n for n in notes if n["blocking"]]
    return {"schema_version":2,"status":"FAIL" if blocking else "PASS","notes":notes,"blocking_count":len(blocking),"frame_samples":frames,"publication_enabled":False}

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--video",required=True);ap.add_argument("--animatic",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=review(a.video,json.loads(Path(a.animatic).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"notes":len(r["notes"])}));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
