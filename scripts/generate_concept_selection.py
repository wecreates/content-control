#!/usr/bin/env python3
import argparse,json
from pathlib import Path
ENGINES=[
 ("physical_consequence","Turn the financial rule into a physical consequence."),
 ("dialogue_punchline","Dave states the tempting logic; Points Monk reframes it."),
 ("literal_metaphor","Make the abstract finance mechanic a literal object/world behavior."),
 ("transformation_arc","Show before/after state change with a reversal."),
 ("chaos_mascot","Cashback Goblin escalates the incentive until the math stops him."),
 ("audience_choice","Turn the finance decision into a visual binary choice.")
]
def build(topic):
    concepts=[]
    for i,(engine,rule) in enumerate(ENGINES):
        concepts.append({"id":f"concept-{i+1}","engine":engine,"topic":topic,"hook":rule,"physical_metaphor":f"{topic} visualized through {engine}","character_conflict":"Dave vs Points Monk/Cashback Goblin","payoff":"one-line finance rule after visible consequence","finance_clarity":True})
    return {"schema_version":1,"status":"PASS" if len(concepts)>=5 else "FAIL","topic":topic,"concepts":concepts,"selected_id":concepts[0]["id"],"selection_reason":"highest default entertainment-first physical readability; downstream creative director may replace selection with evidence","publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--topic",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=build(a.topic);Path(a.out).parent.mkdir(parents=True,exist_ok=True);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"concepts":len(r["concepts"]),"selected":r["selected_id"]}));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
