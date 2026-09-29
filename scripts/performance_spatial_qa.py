#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def check(doc):
 rows=[];ok=True
 for s in doc.get("scenes",[]):
  for ch in s.get("characters",[]):
   pe=ch.get("performance_engine") or {};mt=ch.get("motion_engine") or {}
   checks={"gaze_track":len(pe.get("gaze_track",[]))>=2,"viseme_track":bool(pe.get("viseme_track")),"foot_lock":mt.get("foot_lock") is True,"contact_ik":mt.get("contact_ik") is True}
   if (s.get("choreography") or {}).get("contact_events"):checks["contact_constraints"]=all(e.get("constraint") and e.get("ik_target") for e in s["choreography"]["contact_events"])
   good=all(checks.values());ok=ok and good;rows.append({"scene_id":s.get("id"),"character":ch.get("id"),"checks":checks,"status":"PASS" if good else "FAIL"})
 r={"schema_version":1,"status":"PASS" if ok and rows else "FAIL","rows":rows,"publication_enabled":False};return r
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=check(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"rows":len(r["rows"])}));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
