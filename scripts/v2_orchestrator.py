#!/usr/bin/env python3
import argparse,json
from pathlib import Path

def build_plan(job, reference):
    d=job.get("creative_directive",{})
    return {
      "engine":"content-control-v2",
      "sequence":["entertainment_mechanics","story_conflict","fact_mapping","character_choreography","audio","render","technical_qa","creative_qa","preview_verify"],
      "niche":job.get("niche"),
      "concept":d.get("concept"),
      "target_seconds":d.get("target_seconds",50),
      "reference_mechanics":reference.get("transferable_mechanics",[]),
      "reference_beats":reference.get("beats",[]),
      "rules":["facts_change_action","no_lecture_structure","original_expression","publication_fail_closed"],
      "publication_enabled":False
    }

def derive_metrics(ccsd):
    scenes=ccsd.get("scenes") or []
    durations=[max(0,float(s.get("end",0))-float(s.get("start",0))) for s in scenes]
    intents=" ".join(str((s.get("story") or {}).get("intent",""))+" "+str((s.get("story") or {}).get("beat","")) for s in scenes).lower()
    dialogue=[d for s in scenes for d in ((s.get("audio") or {}).get("dialogue") or [])]
    narrator=sum(1 for d in dialogue if str(d.get("speaker","")).lower()=="narrator")
    return {
      "duration_seconds":max([float(s.get("end",0)) for s in scenes] or [0]),
      "scene_count":len(scenes),
      "max_static_seconds":max(durations or [99]),
      "narrator_share":narrator/max(1,len(dialogue)),
      "has_conflict":any(x in intents for x in ("conflict","attack","battle","versus","vs")),
      "has_escalation":any(x in intents for x in ("escalation","counter","power","rising")),
      "has_payoff":any(x in intents for x in ("payoff","victory","reveal","finish")),
      "pattern_interrupt_max_seconds":max(durations or [99])
    }

def creative_gate(c):
    reasons=[]
    if not c.get("has_conflict"): reasons.append("no_conflict")
    if not c.get("has_escalation"): reasons.append("no_escalation")
    if not c.get("has_payoff"): reasons.append("no_payoff")
    if float(c.get("narrator_share",1))>.65: reasons.append("narrator_dominates")
    if float(c.get("max_static_seconds",99))>3.5: reasons.append("static_too_long")
    if float(c.get("pattern_interrupt_max_seconds",99))>3.5: reasons.append("weak_pattern_interrupts")
    if int(c.get("scene_count",0))<8: reasons.append("insufficient_scene_density")
    return {"pass":not reasons,"reasons":reasons}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--job",required=True);ap.add_argument("--reference",required=True);ap.add_argument("--out",required=True)
    a=ap.parse_args()
    job=json.loads(Path(a.job).read_text());ref=json.loads(Path(a.reference).read_text())
    out=build_plan(job,ref);Path(a.out).parent.mkdir(parents=True,exist_ok=True);Path(a.out).write_text(json.dumps(out,indent=2)+"\n")
    print(json.dumps({"status":"PASS","engine":out["engine"],"sequence":out["sequence"]}))
if __name__=="__main__":main()
