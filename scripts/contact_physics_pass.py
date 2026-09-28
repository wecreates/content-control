#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def apply(ccsd):
 out=json.loads(json.dumps(ccsd))
 for s in out.get("scenes",[]):
  ch=s.get("choreography") or {};events=ch.get("contact_events",[])
  for e in events:
   e["constraint"]={"type":"parent_attach","stiffness":.96,"release_on_frame":e.get("release_frame"),"inherit_velocity":True}
   e["ik_target"]={"actor":e.get("actor"),"target":e.get("target"),"hand":"nearest"}
  ch["physics"]["collision_iterations"]=4;ch["physics"]["substeps"]=2;ch["physics"]["contact_slop_px"]=3
  s["choreography"]=ch
 out["publication_enabled"]=False;return out
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS"}))
if __name__=="__main__":main()
