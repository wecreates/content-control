#!/usr/bin/env python3
import argparse,json
from pathlib import Path

def validate_choreography(c,duration):
    events=sum(len(c.get(k,[])) for k in ["object_actions","character_actions","text_actions","overlays","camera_events","contact_events","visual_gags"])
    motion_sources=sum(bool(c.get(k)) for k in ["object_actions","character_actions","text_actions","camera_events","contact_events","depth_layers"])
    density=events/max(.1,float(duration))
    checks={
      "meaningful_motion":motion_sources>=2,
      "state_change_density":density>=1.5,
      "text_not_static":all(x.get("motion") not in (None,"static") for x in c.get("text_actions",[])),
      "physics_enabled":bool((c.get("physics") or {}).get("enabled")),
      "camera_present":bool(c.get("camera_events")),
      "motivated_transitions":(c.get("transition_in") or {}).get("type")!="fade" and (c.get("transition_out") or {}).get("type")!="fade",
      "metaphor_present":bool((c.get("visual_metaphor") or {}).get("type")),
      "depth_staging":len(c.get("depth_layers",[]))>=3,
    }
    failed=[k for k,v in checks.items() if not v]
    return {"schema_version":1,"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"event_density":round(density,3),"publication_enabled":False}

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    doc=json.loads(Path(a.ccsd).read_text());scenes=[];ok=True
    for s in doc.get("scenes",[]):
        r=validate_choreography(s.get("choreography") or {},float(s.get("end",0))-float(s.get("start",0)))
        scenes.append({"scene_id":s.get("id"),**r})
        ok=ok and r["status"]=="PASS"
    result={"schema_version":1,"status":"PASS" if ok and scenes else "FAIL","scenes":scenes,"publication_enabled":False}
    Path(a.out).write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":result["status"],"scenes":len(scenes)}))
    raise SystemExit(0 if result["status"]=="PASS" else 2)

if __name__=="__main__":main()
