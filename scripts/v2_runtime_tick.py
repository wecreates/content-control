#!/usr/bin/env python3
import json,os,time
from pathlib import Path
from scripts.v2_orchestrator import build_plan,derive_metrics,creative_gate
from scripts.v2_acceptance import evaluate

ROOT=Path(__file__).resolve().parents[1]
JOB=ROOT/"projects/v2/amex-vs-chase-boss-fight/job.json"
CCSD=ROOT/"projects/v2/amex-vs-chase-boss-fight/ccsd.json"
STATE=ROOT/"state/v2-runtime.json"

def tick():
    publication=os.getenv("PUBLICATION_ENABLED","false").lower()=="true"
    if publication: raise RuntimeError("V2 runtime refuses to run with publication enabled")
    job=json.loads(JOB.read_text());ccsd=json.loads(CCSD.read_text())
    reference={"transferable_mechanics":["cold_open","escalation","counter_attack","payoff"],"beats":[]}
    plan=build_plan(job,reference);metrics=derive_metrics(ccsd);creative=creative_gate(metrics)
    state={"timestamp":int(time.time()),"publication_enabled":False,"plan":plan,"creative":creative,
           "acceptance":evaluate({"story_locked":True,"fact_locked":True,"audio_locked":False,"rendered":False,
                                  "technical_qa":False,"creative_qa":creative["pass"],"stream_url":None,"stream_verified":False})}
    STATE.parent.mkdir(parents=True,exist_ok=True);STATE.write_text(json.dumps(state,indent=2)+"\n")
    return state

if __name__=="__main__": print(json.dumps(tick()))
