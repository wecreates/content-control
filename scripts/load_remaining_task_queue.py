#!/usr/bin/env python3
import argparse,json
from pathlib import Path
ORDER=["INTEGRATED","TESTED","RENDER_PROVEN"]
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--progress",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();d=json.loads(Path(a.progress).read_text());tasks=[]
 for k,v in sorted(d.get("capabilities",{}).items(),key=lambda x:int(x[0])):
  state=v.get("state","INTEGRATED")
  if state=="RENDER_PROVEN":continue
  tasks.append({"position":len(tasks)+1,"capability_id":int(k),"capability":v.get("capability",f"capability_{k}"),"group":v.get("group","unknown"),"current_state":state,"next_state":"TESTED" if state=="INTEGRATED" else "RENDER_PROVEN","status":"QUEUED","publication_enabled":False})
 r={"schema_version":1,"mode":"ORDERED_COMPLETION","total_tasks":len(tasks),"tasks":tasks,"publication_enabled":False};Path(a.out).parent.mkdir(parents=True,exist_ok=True);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","tasks":len(tasks),"first":tasks[0]["capability_id"] if tasks else None,"last":tasks[-1]["capability_id"] if tasks else None}))
if __name__=="__main__":main()
