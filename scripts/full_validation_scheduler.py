#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--progress",required=True);ap.add_argument("--out",required=True);ap.add_argument("--limit",type=int,default=500);ap.add_argument("--shards",type=int,default=50);a=ap.parse_args();d=json.loads(Path(a.progress).read_text());rows=[]
 for k,v in sorted(d.get("capabilities",{}).items(),key=lambda x:int(x[0])):
  if v.get("state")=="RENDER_PROVEN":continue
  rows.append({"capability_id":int(k),"current_state":v.get("state","INTEGRATED"),"capability":v.get("capability",f"capability_{k}"),"group":v.get("group","unknown"),"shard":len(rows)%a.shards,"required":["test","render_or_media_proof","diagnose_on_fail","repair","retest"],"publication_enabled":False})
  if len(rows)>=a.limit:break
 r={"schema_version":1,"phase":"FULL_VALIDATION","status":"READY" if rows else "COMPLETE","tasks":rows,"shards":a.shards,"selected":len(rows),"remaining_total":sum(v.get("state")!="RENDER_PROVEN" for v in d.get("capabilities",{}).values()),"publication_enabled":False};Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"selected":r["selected"],"remaining":r["remaining_total"]}))
if __name__=="__main__":main()
