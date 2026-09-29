#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--batch7",required=True);ap.add_argument("--batch8",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();a7=json.loads(Path(a.batch7).read_text());a8=json.loads(Path(a.batch8).read_text());rows=a7.get("capabilities",[])+a8.get("capabilities",[]);ids=[x.get("id") for x in rows]
 checks={"exactly_1000":len(rows)==1000,"ids_1_to_1000":sorted(ids)==list(range(1,1001)),"unique_ids":len(set(ids))==1000,"evidence_required":all(x.get("evidence_required") is True for x in rows),"publication_locked":a7.get("publication_enabled") is False and a8.get("publication_enabled") is False and all(x.get("publication_enabled") is False for x in rows),"target_render_proven":all(x.get("target_state")=="RENDER_PROVEN" for x in rows)}
 failed=[k for k,v in checks.items() if not v];r={"schema_version":1,"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"total":len(rows),"publication_enabled":False};Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
