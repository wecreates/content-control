#!/usr/bin/env python3
import argparse,json,os,re
from pathlib import Path

ELEVEN_ENV={
 "narrator":"ELEVENLABS_VOICE_NARRATOR",
 "dave":"ELEVENLABS_VOICE_DAVE",
 "points_monk":"ELEVENLABS_VOICE_POINTS_MONK",
 "cashback_goblin":"ELEVENLABS_VOICE_CASHBACK_GOBLIN",
}
CARTESIA_ENV={
 "narrator":"CARTESIA_VOICE_NARRATOR",
 "dave":"CARTESIA_VOICE_DAVE",
 "points_monk":"CARTESIA_VOICE_POINTS_MONK",
 "cashback_goblin":"CARTESIA_VOICE_CASHBACK_GOBLIN",
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

def _provider_ready(env,key_name,voice_envs,roles):
    if not env.get(key_name): return False
    return all(bool(env.get(voice_envs[s])) for s in roles)

def build_provider_plan(lock,env=None):
    # Credentials never authorize spending under the user-selected free-only policy.
    voices={"narrator":"am_adam","dave":"am_fenrir","points_monk":"am_michael","cashback_goblin":None}
    return {
      "schema_version":3,
      "primary":{"provider":"kokoro","model_id":"Kokoro-82M","mode":"local_cpu","ready":False,"readiness":"requires_local_runtime_probe","output_format":"wav_pcm_s16le_44100"},
      "dialogue_specialist":{"provider":None,"ready":False,"enabled":False},
      "fallback":{"provider":None,"enabled":False,"reason":"paid voice providers disabled"},
      "selected_strategy":"kokoro_local_cpu",
      "selected_provider":"kokoro",
      "voices":{speaker:{"voice_id":voice,"nonverbal":voice is None} for speaker,voice in voices.items()},
      "paid_providers_enabled":False,
      "publication_enabled":False
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--lock",default="control/voice-lock-v1.json")
    ap.add_argument("--out",required=True)
    a=ap.parse_args()
    plan=build_provider_plan(json.loads(Path(a.lock).read_text()))
    Path(a.out).write_text(json.dumps(plan,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":"PASS","selected_strategy":plan["selected_strategy"],"local_runtime_verified":plan["primary"]["ready"],"paid_providers_enabled":False},sort_keys=True))

if __name__=="__main__":
    main()
