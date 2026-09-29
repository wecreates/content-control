#!/usr/bin/env python3
import argparse,json,cv2,numpy as np,subprocess
from pathlib import Path
def probe(video):
 cap=cv2.VideoCapture(str(video));fps=cap.get(cv2.CAP_PROP_FPS) or 24;n=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));prev=None;hashes=[];motion=[];black=0;border=[];i=0;stride=max(1,round(fps/8))
 while True:
  ok,f=cap.read()
  if not ok:break
  if i%stride==0:
   g=cv2.cvtColor(cv2.resize(f,(180,320)),cv2.COLOR_BGR2GRAY);black+=int(g.mean()<8)
   h=cv2.resize(g,(16,16));hashes.append(h)
   if prev is not None:motion.append(float(cv2.absdiff(g,prev).mean()/255))
   e=cv2.Canny(g,80,160)>0;b=np.r_[e[:10,:].ravel(),e[-10:,:].ravel(),e[:,:8].ravel(),e[:,-8:].ravel()];border.append(float(b.mean()));prev=g
  i+=1
 cap.release();dups=sum(float(np.mean(np.abs(a.astype(float)-b.astype(float))))<1 for a,b in zip(hashes,hashes[1:]))
 try:
  streams=subprocess.check_output(["ffprobe","-v","error","-show_entries","stream=codec_type","-of","csv=p=0",str(video)],text=True)
 except:streams=""
 return {"fps":fps,"frames":n,"duration":n/fps if fps else 0,"black_samples":black,"duplicate_pairs":dups,"mean_motion":float(np.mean(motion)) if motion else 0,"max_border":max(border or [1]),"has_video":"video" in streams,"has_audio":"audio" in streams}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--video",required=True);ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();m=probe(a.video);d=json.loads(Path(a.ccsd).read_text());target=max([float(s.get("end",0)) for s in d.get("scenes",[])] or [0])
 checks={"decodes":m["has_video"],"audio_present":m["has_audio"],"duration_match":abs(m["duration"]-target)<max(.75,target*.02),"no_black":m["black_samples"]==0,"no_duplicate_run":m["duplicate_pairs"]<3,"motion_alive":m["mean_motion"]>.004,"safe_border":m["max_border"]<.18,"publication_disabled":d.get("publication_enabled") is False,"v4_installed":bool(d.get("production_reality_v4",{}).get("installed"))}
 r={"schema_version":1,"status":"PASS" if all(checks.values()) else "FAIL","checks":checks,"metrics":m,"publication_enabled":False};Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"failed":[k for k,v in checks.items() if not v]}));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
