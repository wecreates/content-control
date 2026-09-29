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
    env=env or os.environ
    roles={"narrator":lock.get("narrator",{}),**lock.get("characters",{})}
    role_names=list(roles)
    cartesia_ready=bool(env.get("CARTESIA_API_KEY"))
    eleven_ready=_provider_ready(env,"ELEVENLABS_API_KEY",ELEVEN_ENV,role_names)
    voices={}
    for speaker,meta in roles.items():
        voices[speaker]={
          "voice_profile":meta.get("voice_profile"),
          "cartesia_voice_id":env.get(CARTESIA_ENV[speaker]) or None,
          "elevenlabs_voice_id":env.get(ELEVEN_ENV[speaker]) or None,
        }
    if cartesia_ready and eleven_ready:
        selected="cartesia_with_optional_eleven_comparison"
    elif cartesia_ready:
        selected="cartesia"
    else:
        selected="required_provider_missing"
    return {
      "schema_version":2,
      "primary":{"provider":"cartesia","model_id":"sonic-3.6","mode":"offline_quality","ready":bool(cartesia_ready),"output_format":"wav_pcm_s16le_44100"},
      "dialogue_specialist":{"provider":"elevenlabs","model_id":"eleven_v3","mode":"offline_cinematic_dialogue","ready":bool(eleven_ready),"optional_comparison_only":True,"output_format":"mp3_44100_128","seed_policy":"locked_per_character_plus_variant"},
      "fallback":{"provider":None,"enabled":False,"reason":"legacy and zero-credit voice fallbacks are forbidden"},
      "selected_strategy":selected,
      "selected_provider":selected,
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
    print(json.dumps({"status":"PASS","selected_strategy":plan["selected_strategy"],"cartesia_ready":plan["primary"]["ready"],"eleven_ready":plan["dialogue_specialist"]["ready"]},sort_keys=True))

if __name__=="__main__":
    main()
