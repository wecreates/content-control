#!/usr/bin/env python3
import argparse,json,hashlib
from pathlib import Path
def digest(obj): return hashlib.sha256(json.dumps(obj,sort_keys=True,separators=(",",":")).encode()).hexdigest()
def append(history,artifact,reason,source=None):
    h=json.loads(json.dumps(history));h.setdefault("versions",[])
    h["versions"].append({"version":len(h["versions"])+1,"artifact_sha256":digest(artifact),"reason":reason,"source_failure":source})
    h["schema_version"]=1;h["publication_enabled"]=False;return h
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--history",required=True);ap.add_argument("--artifact",required=True);ap.add_argument("--reason",required=True);ap.add_argument("--source-failure");ap.add_argument("--out",required=True);a=ap.parse_args()
    hp=Path(a.history);hist=json.loads(hp.read_text()) if hp.exists() else {};art=json.loads(Path(a.artifact).read_text());r=append(hist,art,a.reason,a.source_failure);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","versions":len(r["versions"])}))
if __name__=="__main__":main()
