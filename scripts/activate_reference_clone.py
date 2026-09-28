#!/usr/bin/env python3
import argparse,json,shutil
from pathlib import Path
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--package",required=True);ap.add_argument("--active",default="production/reference-clones/active");a=ap.parse_args()
    src=Path(a.package);dst=Path(a.active);dst.mkdir(parents=True,exist_ok=True)
    required=["reference.json","clone-blueprint.json","scene-plan.json"]
    for name in required:
        p=src/name
        if not p.is_file(): raise SystemExit(f"missing {p}")
        shutil.copy2(p,dst/name)
    manifest={"schema_version":1,"source_package":src.as_posix(),"reference_id":json.loads((src/"reference.json").read_text())["source"]["id"],"publication_enabled":False}
    (dst/"activation.json").write_text(json.dumps(manifest,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":"PASS",**manifest},sort_keys=True))
if __name__=="__main__":main()
