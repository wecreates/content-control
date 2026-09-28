#!/usr/bin/env python3
import argparse,json
from pathlib import Path
REQ_SCENE={"id","start","end","story","camera","characters","environment","props","lighting","audio","text","fx","continuity"}
def validate_ccsd(doc):
    scenes=doc.get("scenes",[])
    checks={
      "publication_disabled":doc.get("publication_enabled") is False,
      "project_id":bool(doc.get("project_id")),
      "scenes_present":bool(scenes),
      "scene_fields":all(REQ_SCENE <= set(s) for s in scenes),
      "timing_valid":all(float(s.get("end",0))>float(s.get("start",0)) for s in scenes),
      "unique_scene_ids":len({s.get("id") for s in scenes})==len(scenes),
      "camera_defined":all(bool((s.get("camera") or {}).get("shot_scale")) and bool((s.get("camera") or {}).get("move")) for s in scenes),
      "audio_layers":all(all(k in (s.get("audio") or {}) for k in ["dialogue","sfx","music"]) for s in scenes),
    }
    failed=[k for k,v in checks.items() if not v]
    return {"schema_version":1,"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--input",required=True);ap.add_argument("--out");a=ap.parse_args()
    r=validate_ccsd(json.loads(Path(a.input).read_text()))
    if a.out: Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n")
    print(json.dumps(r,sort_keys=True));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
