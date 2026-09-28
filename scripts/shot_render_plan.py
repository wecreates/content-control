#!/usr/bin/env python3
import argparse,json,math
from pathlib import Path
def build(ccsd,max_shard=6):
    scenes=ccsd.get("scenes",[]);shards=[]
    for i in range(0,len(scenes),max_shard):
        group=scenes[i:i+max_shard]
        shards.append({"id":f"shard-{len(shards)+1:03d}","scene_ids":[s["id"] for s in group],"start":group[0]["start"] if group else 0,"end":group[-1]["end"] if group else 0,"cache_key":"|".join(s["id"] for s in group),"retry_scope":"shard_only"})
    return {"schema_version":1,"shards":shards,"scene_count":len(scenes),"parallelism":min(8,max(1,len(shards))),"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=build(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","shards":len(r["shards"])}))
if __name__=="__main__":main()
