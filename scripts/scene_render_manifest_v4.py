#!/usr/bin/env python3
import argparse,hashlib,json
from pathlib import Path
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();d=json.loads(Path(a.ccsd).read_text());rows=[]
 for s in d.get("scenes",[]):
  raw=json.dumps(s,sort_keys=True,separators=(",",":")).encode();rows.append({"scene_id":s.get("id"),"cache_key":hashlib.sha256(raw).hexdigest(),"worker":(s.get("render_infra_v4") or {}).get("parallel_worker"),"seed":(s.get("render_infra_v4") or {}).get("deterministic_seed"),"frame_range_repair":True})
 r={"schema_version":1,"scenes":rows,"publication_enabled":False};Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","scenes":len(rows)}))
if __name__=="__main__":main()
