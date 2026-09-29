#!/usr/bin/env python3
import argparse,json,cv2,numpy as np
from pathlib import Path
def inspect(video,ccsd):
 cap=cv2.VideoCapture(str(video));fps=cap.get(cv2.CAP_PROP_FPS) or 24;prev=None;motion=[];black=0;frames=0
 while True:
  ok,f=cap.read()
  if not ok:break
  if frames%max(1,round(fps/4))==0:
   g=cv2.cvtColor(cv2.resize(f,(160,284)),cv2.COLOR_BGR2GRAY);black+=int(g.mean()<8)
   if prev is not None:motion.append(float(cv2.absdiff(g,prev).mean()/255))
   prev=g
  frames+=1
 cap.release()
 scenes=ccsd.get("scenes",[]);checks={
 "video_decodes":frames>0,"no_black_samples":black==0,"motion_present":bool(motion) and float(np.mean(motion))>.006,
 "publication_disabled":ccsd.get("publication_enabled") is False,
 "attention_models":all(bool(s.get("attention_model")) for s in scenes),
 "acting_memory":all(all(bool(c.get("acting_memory")) for c in s.get("characters",[])) for s in scenes),
 "prop_state":all(all(bool(p.get("state_machine")) for p in s.get("props",[])) for s in scenes),
 "music_architecture":all(bool((s.get("audio") or {}).get("music_architecture")) for s in scenes),
 "macro_retention":bool(ccsd.get("macro_retention")),"packaging_promise":bool(ccsd.get("packaging_promise_gate"))}
 failed=[k for k,v in checks.items() if not v]
 return {"schema_version":1,"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"mean_motion":round(float(np.mean(motion)) if motion else 0,5),"publication_enabled":False}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--video",required=True);ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=inspect(a.video,json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"failed":r["failed_checks"]}));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
