#!/usr/bin/env python3
import argparse,json,math
from pathlib import Path
def analyze(ccsd):
 scenes=ccsd.get("scenes",[]);rows=[];unresolved=[];last_intent=None
 for i,s in enumerate(scenes):
  st=s.get("story") or {};intent=st.get("intent","setup");dur=max(.01,float(s.get("end",0))-float(s.get("start",0)))
  setup=st.get("setup");pay=st.get("payoff") or st.get("turn")
  novelty=len(s.get("props",[]))+len(s.get("characters",[]))+bool((s.get("text") or {}).get("content"))+bool((s.get("fx") or []))
  clarity=1.0 if st.get("beat") else .45
  change=1.0 if intent!=last_intent else .55
  density=min(1,novelty/4); cognitive=max(0,density-.85)
  score=.34*clarity+.28*change+.24*density+.14*(1-cognitive)
  if setup:unresolved.append({"scene":s.get("id"),"setup":setup})
  if pay and unresolved:unresolved.pop(0)
  rows.append({"scene_id":s.get("id"),"intent":intent,"clarity":round(clarity,2),"state_change":round(change,2),"information_density":round(density,2),"comprehension_score":round(score,3),"duration":round(dur,2)})
  last_intent=intent
 weak=[x for x in rows if x["comprehension_score"]<.62]
 return {"schema_version":1,"status":"PASS" if not weak and len(unresolved)<=1 else "REWRITE","scenes":rows,"weak_scene_ids":[x["scene_id"] for x in weak],"unresolved_setups":unresolved,"publication_enabled":False}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=analyze(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"weak":len(r["weak_scene_ids"]),"unresolved":len(r["unresolved_setups"])}));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
