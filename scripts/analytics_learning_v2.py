#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def learn(ccsd,analytics):
    examples=[]
    for p in analytics.get("retention_points",[]):
        t=float(p["time"]);s=next((x for x in ccsd.get("scenes",[]) if float(x["start"])<=t<float(x["end"])),None)
        if not s: continue
        ch=s.get("choreography") or {};cam=s.get("camera") or {};audio=s.get("audio") or {}
        features={
          "camera_move":cam.get("move"),"shot_scale":cam.get("shot_scale"),
          "characters":[x.get("id") for x in s.get("characters",[])],
          "object_actions":len(ch.get("object_actions",[])),"text_actions":len(ch.get("text_actions",[])),
          "visual_gags":len(ch.get("visual_gags",[])),"transition_out":(ch.get("transition_out") or {}).get("type"),
          "dialogue_words":sum(len(x.get("text","").split()) for x in audio.get("dialogue",[])),
          "music_energy":(audio.get("music") or {}).get("energy"),"duration":float(s["end"])-float(s["start"])
        }
        examples.append({"scene_id":s.get("id"),"time":t,"retention":p.get("retention"),"features":features})
    rules=[]
    for e in examples:
        if float(e.get("retention",1) or 1)<.55: rules.append({"scene_id":e["scene_id"],"direction":"downweight_similar","features":e["features"]})
        elif float(e.get("retention",0) or 0)>.75: rules.append({"scene_id":e["scene_id"],"direction":"reinforce_similar","features":e["features"]})
    return {"schema_version":2,"examples":examples,"rules":rules,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--analytics",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=learn(json.loads(Path(a.ccsd).read_text()),json.loads(Path(a.analytics).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","examples":len(r["examples"]),"rules":len(r["rules"])}))
if __name__=="__main__":main()
