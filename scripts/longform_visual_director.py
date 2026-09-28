#!/usr/bin/env python3
import argparse,json,math
from pathlib import Path
LOCATIONS=["apartment","retail_store","bank_counter","finance_metaphor_world","airport_lounge","casino","rewards_factory","debt_dungeon","credit_score_lab","white_stage"]
ENGINES=["dialogue","physical_gag","literal_metaphor","comparison","mini_mystery","challenge","callback","transformation"]
def apply(ccsd):
    out=json.loads(json.dumps(ccsd));scenes=out.get("scenes",[]);n=max(1,len(scenes))
    for i,s in enumerate(scenes):
        act=min(4,int(i/max(1,n/5)))
        loc=LOCATIONS[(i//2+act)%len(LOCATIONS)]
        s["environment"]={"id":loc}
        chars=s.setdefault("characters",[])
        existing={x.get("id") for x in chars}
        partner="points_monk" if (i%4 in [1,2]) else "cashback_goblin" if i%7==4 else None
        if partner and partner not in existing:
            chars.append({"id":partner,"pose":"deadpan_point" if partner=="points_monk" else "coin_scamper","emotion":"deadpan" if partner=="points_monk" else "mischievous"})
        s["longform"]={
          "act":act+1,"engine":ENGINES[i%len(ENGINES)],"dialogue_partner":partner,
          "subplot":"Dave shortcut" if act<2 else "Points Monk counter-plan" if act<4 else "payoff convergence",
          "callback_seed":i%6==0,"callback_payoff":i%6==5,
          "energy":round(.42+.38*math.sin((i/max(1,n-1))*math.pi),3),
          "location_pivot":i==0 or (i>0 and scenes[i-1].get("environment",{}).get("id")!=loc),
          "quiet_beat":i%9==7
        }
    out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","scenes":len(r.get("scenes",[]))}))
if __name__=="__main__":main()
