#!/usr/bin/env python3
import argparse,json
from pathlib import Path
ENV_BEDS={"airport_lounge":"soft_airport","retail_store":"store_room","bank_counter":"bank_room","casino":"casino_murmur","apartment":"room_tone","restaurant_table":"restaurant_murmur","airplane_cabin":"cabin_hum","gas_station":"outdoor_light","office_cubicle":"office_hum"}
SFX_MAP={"card":"card_flick","coin":"coin_ping","receipt":"paper_snap","calculator":"button_clack","phone":"phone_buzz","wallet":"leather_snap","fee_meter":"meter_tick","price_tag":"tag_whip"}
def apply(ccsd):
 out=json.loads(json.dumps(ccsd))
 for s in out.get("scenes",[]):
  audio=s.setdefault("audio",{});env=(s.get("environment") or {}).get("id","white_stage")
  audio["environment_bed"]={"id":ENV_BEDS.get(env,"light_neutral"),"gain_db":-24}
  cues=[]
  for p in s.get("props",[]):
   cues.append({"id":SFX_MAP.get(p.get("id"),"prop_contact"),"time":round(float(s["start"])+.18,3),"gain_db":-10,"sync":"frame_locked"})
  for e in (s.get("choreography") or {}).get("contact_events",[]):
   cues.append({"id":"impact_sweetener","time":round(float(s["start"])+float(e.get("contact_frame",0))/24,3),"gain_db":-7,"sync":"contact"})
  audio["foley"]=cues;audio["silence_windows"]= [{"start":round(float(s["end"])-.18,3),"end":float(s["end"]),"reason":"punchline_space"}] if (s.get("choreography") or {}).get("visual_gags") else []
  audio["mix"]={"dialogue_target_lufs":-16,"music_duck_db":-8,"sfx_peak_db":-5}
 out["publication_enabled"]=False;return out
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS"}))
if __name__=="__main__":main()
