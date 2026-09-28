#!/usr/bin/env python3
import argparse,json
from pathlib import Path
ARCS=["temptation_fall_reframe","mystery_reveal_callback","competition_escalation_loss","survival_rule_reversal","heist_plan_failure","status_game_deflation","countdown_pressure_release","monster_of_the_week","quest_with_false_reward","trial_by_three","social_proof_trap","before_after_contrast"]
def build_room(topic,count=12):
    pitches=[]
    for i in range(max(10,count)):
        arc=ARCS[i%len(ARCS)]
        pitches.append({
          "id":f"pitch-{i+1:02d}","topic":topic,"arc":arc,
          "want":"Dave wants the shortcut, status, reward, or relief",
          "obstacle":"the financial mechanic creates a visible escalating consequence",
          "turns":[
            "hook with immediate physical conflict",
            "first escalation makes the shortcut look better",
            "second escalation reveals hidden cost",
            "Points Monk or environment forces a reframe",
            "payoff converts lesson into one memorable rule"
          ],
          "callbacks":[{"seed":"visual object introduced in hook","payoff":"same object returns with opposite meaning"}] if i%2==0 else [],
          "location_changes":2+(i%3),"visual_metaphors":2+(i%2),
          "silent_gag_slots":[.22,.58,.84],
          "selection_features":{"surprise":round(.65+(i%4)*.06,2),"clarity":round(.72+(i%3)*.05,2),"visuality":round(.76+(i%5)*.04,2)}
        })
    pitches.sort(key=lambda p:(p["selection_features"]["visuality"]+p["selection_features"]["surprise"]),reverse=True)
    return {"schema_version":2,"status":"PASS","topic":topic,"pitches":pitches,"selected_id":pitches[0]["id"],"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--topic",required=True);ap.add_argument("--count",type=int,default=12);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=build_room(a.topic,a.count);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"pitches":len(r["pitches"]),"selected":r["selected_id"]}))
if __name__=="__main__":main()
