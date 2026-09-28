#!/usr/bin/env python3
import argparse,json
from pathlib import Path
MOTIFS={"setup":"curious_pluck","danger":"low_pulse","reward":"bright_sting","resolution":"dry_resolve","mystery":"ticking_pluck","action":"percussive_drive"}
def apply(ccsd):
 out=json.loads(json.dumps(ccsd));scenes=out.get("scenes",[])
 for i,s in enumerate(scenes):
  lf=s.get("longform") or {};phase=(s.get("color_script") or {}).get("phase","setup")
  engine=lf.get("engine","")
  mood="mystery" if "mystery" in engine else "action" if engine in {"challenge","physical_gag","transformation"} else phase
  energy=float(lf.get("energy",.42))
  gag=bool((s.get("choreography") or {}).get("visual_gags"))
  music=s.setdefault("audio",{}).setdefault("music",{})
  music.update({"motif":MOTIFS.get(mood,MOTIFS["setup"]),"energy":round(energy,3),"tempo_bpm":round(82+energy*54),"duck_under_dialogue":True,"mute_for_punchline":gag,"reentry_frames":8 if gag else 0,"transition":"bar_aligned"})
 out["publication_enabled"]=False;return out
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS"}))
if __name__=="__main__":main()
