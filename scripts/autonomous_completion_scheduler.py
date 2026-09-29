#!/usr/bin/env python3
import argparse,json
from pathlib import Path
BATCHES=[7,8,9,10,11]
DOMAINS=["renderer","animation","physics","camera","editing","composition","audio","voice","story","retention","reference","qa","repair","learning","reliability","acceptance"]
def load(root):
 rows=[]
 for b in BATCHES:
  p=Path(root,f"batch{b}-500-registry.json")
  if p.is_file():rows+=json.loads(p.read_text()).get("capabilities",[])
 return rows
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--root",default="state/studio");ap.add_argument("--out",required=True);ap.add_argument("--shards",type=int,default=16);ap.add_argument("--limit",type=int,default=160);a=ap.parse_args()
 rows=load(a.root);remaining=[x for x in rows if x.get("state")!="RENDER_PROVEN"][:a.limit];tasks=[]
 for i,x in enumerate(remaining):
  tasks.append({"capability_id":x["id"],"capability":x["capability"],"group":x["group"],"domain":DOMAINS[i%len(DOMAINS)],"shard":i%a.shards,"required":["implement","integrate","test","render_or_media_evidence","promote"],"publication_enabled":False})
 r={"schema_version":1,"status":"READY" if tasks else "COMPLETE","parallel_shards":a.shards,"tasks":tasks,"remaining_selected":len(tasks),"publication_enabled":False};Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"tasks":len(tasks),"shards":a.shards}))
if __name__=="__main__":main()
