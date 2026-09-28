#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def verify(root,map_path):
    m=json.loads(Path(map_path).read_text());missing=[];ids=[]
    for d in m.get("departments",[]):
        ids.append(d.get("id"));p=Path(root)/d.get("impl","")
        if not p.is_file(): missing.append({"department":d.get("id"),"impl":d.get("impl")})
    checks={"departments_present":len(ids)>=25,"unique_departments":len(ids)==len(set(ids)),"all_implementations_exist":not missing,"publication_disabled":m.get("publication_enabled") is False}
    failed=[k for k,v in checks.items() if not v]
    return {"schema_version":1,"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"missing":missing,"department_count":len(ids),"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--root",default=".");ap.add_argument("--map",default="control/studio-department-map-v1.json");ap.add_argument("--out",default="state/studio-department-health.json");a=ap.parse_args();r=verify(a.root,a.map);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r,sort_keys=True));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
