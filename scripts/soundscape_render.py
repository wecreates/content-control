#!/usr/bin/env python3
import argparse,json,math,random,wave
from array import array
from pathlib import Path
SR=48000

def add_tone(buf,start,dur,freq,amp,kind="sine"):
    a=max(0,int(start*SR));b=min(len(buf),a+int(dur*SR));ln=max(1,b-a)
    for i in range(a,b):
        t=(i-a)/SR;env=max(0,1-(i-a)/ln)
        if kind=="noise":v=(random.random()*2-1)
        elif kind=="square":v=1 if math.sin(2*math.pi*freq*t)>=0 else -1
        else:v=math.sin(2*math.pi*freq*t)
        buf[i]+=v*amp*env

def render(ccsd,out):
    scenes=ccsd.get("scenes",[]);duration=max([float(s.get("end",0)) for s in scenes] or [1]);n=int((duration+.5)*SR)
    buf=array("f",[0.0])*n
    random.seed(1337)
    for s in scenes:
        audio=s.get("audio") or {};music=audio.get("music") or {};energy=float(music.get("energy",.35) or .35)
        st=float(s.get("start",0));en=float(s.get("end",st+.5));base=92+energy*44
        t=st
        while t<en:
            add_tone(buf,t,min(.16,en-t),base,0.012+energy*.009)
            add_tone(buf,t,min(.16,en-t),base*1.5,0.004)
            t+=.5
        for cue in audio.get("foley",[]):
            typ=cue.get("id","");freq=1500 if "coin" in typ else 700 if "card" in typ else 260 if "impact" in typ else 520
            kind="noise" if any(x in typ for x in ["paper","impact","snap"]) else "sine"
            add_tone(buf,float(cue.get("time",st)),.09 if "impact" not in typ else .16,freq,.07 if "impact" not in typ else .11,kind)
        for win in audio.get("silence_windows",[]):
            a=max(0,int(float(win.get("start",0))*SR));b=min(n,int(float(win.get("end",0))*SR))
            for i in range(a,b):buf[i]*=.12
    peak=max(max((abs(x) for x in buf),default=.001),.001);scale=min(.9/peak,1)
    pcm=array("h",(int(max(-1,min(1,x*scale))*32767) for x in buf))
    Path(out).parent.mkdir(parents=True,exist_ok=True)
    with wave.open(str(out),"wb") as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
    return {"duration_seconds":round(duration+.5,3),"sample_rate":SR,"peak_normalized":round(min(peak,1),4)}

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);ap.add_argument("--receipt",required=True);a=ap.parse_args();meta=render(json.loads(Path(a.ccsd).read_text()),a.out);r={"schema_version":2,"status":"PASS","path":a.out,**meta,"publication_enabled":False};Path(a.receipt).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r,sort_keys=True))
if __name__=="__main__":main()
