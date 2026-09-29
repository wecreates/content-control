#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def main():
 ap=argparse.ArgumentParser()
 for n in range(7,11):ap.add_argument(f"--batch{n}",required=True)
 ap.add_argument("--out",required=True);a=ap.parse_args()
 docs=[json.loads(Path(getattr(a,f"batch{n}")).read_text()) for n in range(7,11)];rows=sum([d.get("capabilities",[]) for d in docs],[]);ids=[x.get("id") for x in rows]
 checks={"exactly_2000":len(rows)==2000,"ids_1_to_2000":sorted(ids)==list(range(1,2001)),"unique_ids":len(set(ids))==2000,"evidence_required":all(x.get("evidence_required") is True for x in rows),"publication_locked":all(d.get("publication_enabled") is False for d in docs) and all(x.get("publication_enabled") is False for x in rows),"target_render_proven":all(x.get("target_state")=="RENDER_PROVEN" for x in rows)}
 failed=[k for k,v in checks.items() if not v];r={"schema_version":1,"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"total":len(rows),"publication_enabled":False};Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
