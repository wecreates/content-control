#!/usr/bin/env python3
import argparse,json
from pathlib import Path
ENGINES=["physical_consequence","dialogue_reversal","literal_metaphor","transformation","mystery_reveal","status_game","countdown","competition","heist_parody","survival_rule","social_choice","callback_chain"]
def build_story_room(topic):
    pitches=[]
    for i,e in enumerate(ENGINES):
        pitches.append({"id":f"pitch-{i+1}","engine":e,"topic":topic,"hook":f"{e}: immediate conflict around {topic}","character_goal":"Dave wants the tempting shortcut","obstacle":"the finance mechanic creates a visible consequence","reversal":"Points Monk reframes the incentive","payoff":"one memorable rule","theme":"incentives change behavior","visual_potential":0.8-(i%3)*0.05})
    return {"schema_version":1,"status":"PASS" if len(pitches)>=10 else "FAIL","topic":topic,"pitches":pitches,"selected_id":pitches[0]["id"],"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--topic",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=build_story_room(a.topic);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"pitches":len(r["pitches"]),"selected":r["selected_id"]}))
if __name__=="__main__":main()
