#!/usr/bin/env python3
import argparse,copy,json,re
from pathlib import Path
MAP={"a":"AI","e":"E","i":"AI","o":"O","u":"U","m":"MBP","b":"MBP","p":"MBP","f":"FV","v":"FV","l":"L","w":"WQ","q":"WQ"}
def visemes(text,frames):
 chars=[c.lower() for c in text if c.isalpha()];seq=[]
 for i,c in enumerate(chars or ["x"]):
  seq.append({"frame":round(i*max(1,frames-1)/max(1,len(chars)-1)),"viseme":MAP.get(c,"rest")})
 return seq
def apply(doc,fps=24):
 out=copy.deepcopy(doc)
 for s in out.get("scenes",[]):
  dur=max(.1,float(s.get("end",0))-float(s.get("start",0)));dialog=(s.get("audio") or {}).get("dialogue",[])
  by={}
  for d in dialog:by.setdefault(d.get("speaker","narrator"),[]).append(d.get("text",""))
  for ch in s.get("characters",[]):
   text=" ".join(by.get(ch.get("id"),[]));pe=ch.setdefault("performance_engine",{})
   pe["viseme_track"]=visemes(text,round(dur*fps)) if text else [{"frame":0,"viseme":"rest"}]
   pe["blink_frames"]=[round(dur*fps*.22),round(dur*fps*.71)]
   pe["gaze_track"]=[{"frame":0,"target":"active_speaker"},{"frame":round(dur*fps*.55),"target":"story_prop" if s.get("props") else "reaction_partner"}]
 out["publication_enabled"]=False;return out
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS"}))
if __name__=="__main__":main()
