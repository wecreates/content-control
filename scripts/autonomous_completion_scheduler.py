#!/usr/bin/env python3
import argparse,json
from pathlib import Path
DOMAINS=["renderer","animation","physics","camera","editing","composition","audio","voice","story","retention","reference","qa","repair","learning","reliability","acceptance"]
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--progress",required=True);ap.add_argument("--out",required=True);ap.add_argument("--shards",type=int,default=32);ap.add_argument("--limit",type=int,default=500);a=ap.parse_args()
 d=json.loads(Path(a.progress).read_text());caps=d.get("capabilities",{})
 remaining=[(int(k),v) for k,v in caps.items() if v.get("state")!="RENDER_PROVEN"];remaining.sort();remaining=remaining[:a.limit];tasks=[]
 for i,(cid,row) in enumerate(remaining):
  tasks.append({"capability_id":cid,"capability":row.get("capability",f"capability_{cid}"),"group":row.get("group","unknown"),"domain":row.get("domain",DOMAINS[i%len(DOMAINS)]),"shard":i%a.shards,"current_state":row.get("state","INSTALLED"),"required":["implement","integrate"],"publication_enabled":False})
 r={"schema_version":1,"status":"READY" if tasks else "COMPLETE","parallel_shards":a.shards,"tasks":tasks,"remaining_total":len([1 for x in caps.values() if x.get("state")!="RENDER_PROVEN"]),"remaining_selected":len(tasks),"publication_enabled":False};Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"tasks":len(tasks),"remaining_total":r["remaining_total"]}))
if __name__=="__main__":main()
