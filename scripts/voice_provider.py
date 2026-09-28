#!/usr/bin/env python3
import argparse,json,os,re
from pathlib import Path

VOICE_ENV={
 "narrator":"ELEVENLABS_VOICE_NARRATOR",
 "dave":"ELEVENLABS_VOICE_DAVE",
 "points_monk":"ELEVENLABS_VOICE_POINTS_MONK",
 "cashback_goblin":"ELEVENLABS_VOICE_CASHBACK_GOBLIN",
}
TAGS={
 "narrator":["[confident]"],
 "dave":["[anxious]","[excited]"],
 "points_monk":["[deadpan]","[calm]"],
 "cashback_goblin":["[mischievous]"],
}

def add_v3_tags(speaker,text,performance=None):
    performance=performance or {}
    tone=str(performance.get("tone","")).lower()
    tags=list(TAGS.get(speaker,[]))
    if "whisper" in tone: tags.append("[whispering]")
    if "excited" in tone and speaker!="dave": tags.append("[excited]")
    if "calm" in tone and speaker!="points_monk": tags.append("[calm]")
    cleaned=re.sub(r"(?i)\bSFX\s*:[^\n]*","",text).strip()
    return " ".join(tags+[cleaned]).strip()

def build_provider_plan(lock,env=None):
    env=env or os.environ
    api=bool(env.get("ELEVENLABS_API_KEY"))
    voices={}
    ready=api
    roles={"narrator":lock.get("narrator",{}),**lock.get("characters",{})}
    for speaker,meta in roles.items():
        vid=env.get(VOICE_ENV[speaker],"")
        voices[speaker]={"voice_profile":meta.get("voice_profile"),"voice_id":vid or None}
        ready=ready and bool(vid)
    return {
      "schema_version":1,
      "primary":{"provider":"elevenlabs","model_id":"eleven_v3","mode":"offline_cinematic","ready":bool(ready),"output_format":"mp3_44100_128","seed_policy":"locked_per_character_plus_variant"},
      "fallback":{"provider":"content_control_zero_credit","enabled":True,"reason":"used when ElevenLabs key, voice IDs, quota, or generation QA fail"},
      "selected_provider":"elevenlabs" if ready else "fallback",
      "voices":voices,
      "publication_enabled":False
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--lock",default="control/voice-lock-v1.json")
    ap.add_argument("--out",required=True)
    a=ap.parse_args()
    plan=build_provider_plan(json.loads(Path(a.lock).read_text()))
    Path(a.out).write_text(json.dumps(plan,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":"PASS","selected_provider":plan["selected_provider"],"eleven_ready":plan["primary"]["ready"]},sort_keys=True))

if __name__=="__main__":
    main()
