#!/usr/bin/env python3
import argparse,json,subprocess
from pathlib import Path
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--receipt",required=True);ap.add_argument("--duration",type=float,required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=json.loads(Path(a.receipt).read_text())
    if r.get("status")!="PASS" or not r.get("segments"):
        print(json.dumps({"status":"SKIPPED","reason":r.get("status")}));return
    ins=[];filters=[];labels=[]
    for i,s in enumerate(r["segments"]):
        ins += ["-i",s["path"]]
        delay=max(0,int(float(s.get("start",0))*1000))
        filters.append(f"[{i}:a]adelay={delay}|{delay},aresample=48000[a{i}]");labels.append(f"[a{i}]")
    filters.append("".join(labels)+f"amix=inputs={len(labels)}:duration=longest:normalize=0,atrim=0:{a.duration}[mix]")
    cmd=["ffmpeg","-y",*ins,"-filter_complex",";".join(filters),"-map","[mix]","-c:a","pcm_s16le",a.out]
    Path(a.out).parent.mkdir(parents=True,exist_ok=True);subprocess.run(cmd,check=True)
    print(json.dumps({"status":"PASS","out":a.out,"segments":len(labels)}))
if __name__=="__main__":main()
