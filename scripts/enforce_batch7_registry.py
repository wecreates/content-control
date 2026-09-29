#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--registry",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();d=json.loads(Path(a.registry).read_text());rows=d.get("capabilities",[])
 checks={"exactly_500":len(rows)==500,"unique_ids":len({x.get("id") for x in rows})==500,"valid_states":all(x.get("state") in d.get("lifecycle",[]) for x in rows),"evidence_required":all(x.get("evidence_required") is True for x in rows),"publication_locked":d.get("publication_enabled") is False and all(x.get("publication_enabled") is False for x in rows)}
 failed=[k for k,v in checks.items() if not v];r={"schema_version":1,"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"counts":{s:sum(x.get("state")==s for x in rows) for s in d.get("lifecycle",[])},"publication_enabled":False};Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
