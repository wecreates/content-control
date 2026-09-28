#!/usr/bin/env python3
import argparse,json
from collections import Counter
from pathlib import Path

BASE_DEPS=["story","board","environment","props","rig","dialogue_timing","camera"]

def dep_state(scene,dep):
    if dep=="story": return bool(scene.get("story"))
    if dep=="board": return True
    if dep=="environment": return bool((scene.get("environment") or {}).get("id"))
    if dep=="props": return "props" in scene
    if dep=="rig": return all(bool(c.get("rig")) for c in scene.get("characters",[])) if scene.get("characters") else False
    if dep=="dialogue_timing":
        dialogue=(scene.get("audio") or {}).get("dialogue",[])
        return all(("text" in d) for d in dialogue)
    if dep=="camera": return bool((scene.get("camera") or {}).get("move"))
    if dep=="contact_physics":
        ch=scene.get("choreography") or {}
        return all(bool(e.get("constraint")) and bool(e.get("ik_target")) for e in ch.get("contact_events",[]))
    if dep=="crowd": return bool(scene.get("crowd"))
    if dep=="voice":
        dialogue=(scene.get("audio") or {}).get("dialogue",[])
        return not dialogue or all(bool(d.get("speaker")) for d in dialogue)
    return False

def schedule(ccsd):
    shots=[]
    for i,s in enumerate(ccsd.get("scenes",[])):
        deps=list(BASE_DEPS)
        if (s.get("choreography") or {}).get("contact_events"): deps.append("contact_physics")
        if s.get("crowd",{}).get("enabled"): deps.append("crowd")
        if (s.get("audio") or {}).get("dialogue"): deps.append("voice")
        states={d:dep_state(s,d) for d in deps}
        blockers=[d for d,v in states.items() if not v]
        shots.append({
          "scene_id":s.get("id"),
          "priority":100-i if float(s.get("start",0))<5 else 50-i,
          "dependencies":deps,
          "ready_when":states,
          "blockers":blockers,
          "ready":not blockers,
          "parallel_group":i%4,
          "render_scope":"scene",
          "repair_scope":"scene",
          "estimated_cost_credits":0
        })
    ready=[x for x in shots if x["ready"]]
    return {
      "schema_version":2,
      "shots":shots,
      "ready_scene_ids":[x["scene_id"] for x in ready],
      "blocked_scene_ids":[x["scene_id"] for x in shots if not x["ready"]],
      "parallel_groups":{str(g):[x["scene_id"] for x in ready if x["parallel_group"]==g] for g in range(4)},
      "critical_path":["story","board","rig","dialogue_timing","animation","qa"],
      "counts":dict(Counter("ready" if x["ready"] else "blocked" for x in shots)),
      "publication_enabled":False
    }

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=schedule(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","shots":len(r["shots"]),"ready":len(r["ready_scene_ids"]),"blocked":len(r["blocked_scene_ids"])}))

if __name__=="__main__":main()
