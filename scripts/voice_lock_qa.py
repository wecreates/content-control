#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def validate(manifest,lock):
    roles=lock["characters"];checks={}
    segs=manifest.get("segments",[])
    checks["segments_present"]=bool(segs)
    checks["known_speakers"]=all(s.get("speaker") in {"narrator",*roles.keys()} for s in segs)
    checks["no_sfx_in_spoken_text"]=all(not any(tok in (s.get("text") or "").lower() for tok in ["sfx:","whoosh","door slam","coin ping"]) for s in segs)
    checks["voice_profiles_match"]=all((lock.get("narrator") if s["speaker"]=="narrator" else roles[s["speaker"]]).get("voice_profile")==s.get("voice_profile") for s in segs if s.get("speaker") in {"narrator",*roles.keys()})
    checks["publication_disabled"]=manifest.get("publication_enabled") is False
    failed=[k for k,v in checks.items() if not v]
    return {"schema_version":1,"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--manifest",required=True);ap.add_argument("--lock",default="control/voice-lock-v1.json");ap.add_argument("--out",required=True);a=ap.parse_args();r=validate(json.loads(Path(a.manifest).read_text()),json.loads(Path(a.lock).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r,sort_keys=True));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
