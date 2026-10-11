#!/usr/bin/env python3
import argparse,json,cv2,numpy as np,subprocess,math,hashlib,re
from pathlib import Path
def duplicate_run_stats(hashes,threshold=1.0):
 diffs=[float(np.mean(np.abs(a.astype(float)-b.astype(float)))) for a,b in zip(hashes,hashes[1:])]
 duplicate_pairs=sum(d<threshold for d in diffs)
 run=0;max_run=0
 for d in diffs:
  if d<threshold:
   run+=1;max_run=max(max_run,run)
  else:
   run=0
 return {"duplicate_pairs":duplicate_pairs,"max_duplicate_run_pairs":max_run,"pair_diffs":diffs}

def validate_decode(fps,reported_frames,decoded_frames):
 return (math.isfinite(fps) and fps>0 and reported_frames>0
         and decoded_frames==reported_frames)

def decode_all_streams(video):
 try:
  result=subprocess.run(["ffmpeg","-v","error","-xerror","-err_detect","explode","-i",str(video),"-map","0:v:0","-map","0:a:0","-f","null","-"],capture_output=True,text=True,timeout=180)
  return result.returncode==0
 except (OSError,subprocess.TimeoutExpired):
  return False

def measure_audio(video):
 """Measure the actual first audio stream; metadata presence is insufficient."""
 empty={"audio_duration":None,"audio_start":None,"audio_mean_db":None,"audio_audible":False}
 try:
  r=subprocess.run(["ffprobe","-v","error","-select_streams","a:0","-show_entries","stream=duration,start_time","-of","json",str(video)],capture_output=True,text=True,timeout=30)
  if r.returncode:return empty
  streams=json.loads(r.stdout).get('streams',[])
  if not streams:return empty
  duration=float(streams[0]['duration']);start=float(streams[0].get('start_time',0))
  if not math.isfinite(duration) or duration<=0 or not math.isfinite(start):return empty
  r=subprocess.run(["ffmpeg","-nostdin","-hide_banner","-i",str(video),"-map","0:a:0","-af","volumedetect","-f","null","-"],capture_output=True,text=True,timeout=180)
  match=re.search(r'mean_volume:\s*(-?[0-9.]+|[+-]?inf)\s*dB',r.stderr)
  level=float(match.group(1)) if match else float('-inf')
  return {"audio_duration":duration,"audio_start":start,"audio_mean_db":level if math.isfinite(level) else None,"audio_audible":r.returncode==0 and math.isfinite(level) and level>-60}
 except (OSError,ValueError,KeyError,TypeError,subprocess.TimeoutExpired):return empty

def audio_covers_video(audio,duration):
 start,length=audio.get('audio_start'),audio.get('audio_duration')
 return (isinstance(start,(int,float)) and isinstance(length,(int,float))
         and math.isfinite(start) and math.isfinite(length) and duration>0
         and abs(start)<=.1 and abs(start+length-duration)<=.15)

def probe(video):
 cap=cv2.VideoCapture(str(video));fps=float(cap.get(cv2.CAP_PROP_FPS) or 0);n=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));prev=None;hashes=[];motion=[];black=0;border=[];i=0;stride=max(1,round(fps/8)) if math.isfinite(fps) and fps>0 else 1
 while True:
  ok,f=cap.read()
  if not ok:break
  if i%stride==0:
   g=cv2.cvtColor(cv2.resize(f,(180,320)),cv2.COLOR_BGR2GRAY);black+=int(g.mean()<8)
   h=cv2.resize(g,(16,16));hashes.append(h)
   if prev is not None:motion.append(float(cv2.absdiff(g,prev).mean()/255))
   e=cv2.Canny(g,80,160)>0;b=np.r_[e[:10,:].ravel(),e[-10:,:].ravel(),e[:,:8].ravel(),e[:,-8:].ravel()];border.append(float(b.mean()));prev=g
  i+=1
 cap.release();dupstats=duplicate_run_stats(hashes)
 try:
  streams=subprocess.check_output(["ffprobe","-v","error","-show_entries","stream=codec_type","-of","csv=p=0",str(video)],text=True)
 except:streams=""
 sample_interval=(stride/fps) if math.isfinite(fps) and fps>0 else 0
 return {**measure_audio(video),"fps":fps if math.isfinite(fps) else 0,"frames":n,"decoded_frames":i,"complete_video_decode":validate_decode(fps,n,i),"complete_av_decode":decode_all_streams(video),"duration":i/fps if math.isfinite(fps) and fps>0 else 0,"black_samples":black,"duplicate_pairs":dupstats["duplicate_pairs"],"max_duplicate_run_pairs":dupstats["max_duplicate_run_pairs"],"max_duplicate_run_seconds":dupstats["max_duplicate_run_pairs"]*sample_interval,"mean_motion":float(np.mean(motion)) if motion else 0,"max_border":max(border or [1]),"has_video":"video" in streams,"has_audio":"audio" in streams}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--video",required=True);ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();m=probe(a.video);d=json.loads(Path(a.ccsd).read_text());target=max([float(s.get("end",0)) for s in d.get("scenes",[])] or [0])
 checks={"decodes":m["has_video"] and m["complete_video_decode"],"complete_av_decode":m["complete_av_decode"],"audio_present":m["has_audio"],"audio_audible":m["audio_audible"],"audio_covers_video":audio_covers_video(m,m["duration"]),"duration_match":abs(m["duration"]-target)<max(.75,target*.02),"no_black":m["black_samples"]==0,"no_duplicate_run":m["max_duplicate_run_seconds"]<.75,"motion_alive":m["mean_motion"]>.004,"safe_border":m["max_border"]<.18,"publication_disabled":d.get("publication_enabled") is False,"v4_installed":bool(d.get("production_reality_v4",{}).get("installed"))}
 r={"schema_version":1,"candidate_sha256":hashlib.file_digest(open(a.video,"rb"),"sha256").hexdigest(),"status":"PASS" if all(checks.values()) else "FAIL","checks":checks,"metrics":m,"publication_enabled":False};Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"failed":[k for k,v in checks.items() if not v]}));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
