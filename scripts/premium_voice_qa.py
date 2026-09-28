#!/usr/bin/env python3
import argparse,json,subprocess
from pathlib import Path
def validate(receipt,assignments):
    if receipt.get("status")=="NOT_CONFIGURED":
        return {"schema_version":1,"status":"READY_NO_CREDENTIALS","checks":{"fallback_allowed":True},"publication_enabled":False}
    rows=receipt.get("segments",[]);assigned=assignments.get("assignments",{})
    checks={}
    checks["provider_cartesia"]=receipt.get("provider")=="cartesia" and receipt.get("model_id")=="sonic-3.6"
    checks["segments_present"]=bool(rows)
    checks["speakers_locked"]=all(r.get("speaker") in assigned for r in rows)
    checks["audio_present"]=all(Path(r["path"]).is_file() and Path(r["path"]).stat().st_size>1000 for r in rows)
    checks["duration_plausible"]=all(.15<float(r.get("duration_seconds",0))<120 for r in rows)
    checks["no_spoken_sfx"]=all(not any(x in r.get("text","").lower() for x in ["sfx:","whoosh","door slam","coin ping"]) for r in rows)
    checks["publication_disabled"]=receipt.get("publication_enabled") is False
    failed=[k for k,v in checks.items() if not v]
    return {"schema_version":1,"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--receipt",required=True);ap.add_argument("--assignments",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=validate(json.loads(Path(a.receipt).read_text()),json.loads(Path(a.assignments).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r,sort_keys=True));raise SystemExit(0 if r["status"] in ["PASS","READY_NO_CREDENTIALS"] else 2)
if __name__=="__main__":main()
