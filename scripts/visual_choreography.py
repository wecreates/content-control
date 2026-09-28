#!/usr/bin/env python3
import argparse,json,re
from pathlib import Path

OBJECT_BEHAVIORS={
 "card":["flick_in","bend","swipe","slam","spin","hover","magnetize"],
 "coin":["toss","bounce","orbit","rain","ricochet","stack"],
 "receipt":["print","unroll","tear","whip","wrap"],
 "calculator":["drop","slam","counter_pop"],
 "phone":["buzz","slide","tilt","notification_pop"],
 "price_tag":["swing","snap","inflate"],
 "fee_meter":["pressure_rise","needle_snap"],
 "wallet":["open","clutch","empty_drop"],
}
TEXT_MOTIONS=["slam","type","counter","stamp","highlight","stretch","shake","track_subject"]
TRANSITIONS=["object_wipe","match_cut","whip_pan","prop_collision","zoom_through","coin_iris","foreground_wipe"]
CURVES={
 "comedic_pop":{"ease":"back","overshoot":1.18,"settle":0.82},
 "heavy_drop":{"ease":"expo","overshoot":1.04,"settle":0.7},
 "nervous_hesitation":{"ease":"steps","overshoot":1.0,"settle":0.9},
 "deadpan":{"ease":"linear_hold","overshoot":1.0,"settle":1.0},
 "elastic_goblin":{"ease":"spring","overshoot":1.32,"settle":0.74},
}
METAPHORS=[
 (re.compile(r"annual fee|fee",re.I),"toll_gate"),
 (re.compile(r"apr|interest",re.I),"pressure_meter"),
 (re.compile(r"cashback|cash back|reward",re.I),"cash_leak"),
 (re.compile(r"points|expiration",re.I),"melting_reward"),
 (re.compile(r"minimum payment|debt",re.I),"weight_drop"),
]

def metaphor_for(scene):
    blob=" ".join([
      str((scene.get("story") or {}).get("beat","")),
      str((scene.get("story") or {}).get("purpose","")),
      str((scene.get("text") or {}).get("content","")),
    ])
    for rx,name in METAPHORS:
        if rx.search(blob):
            return {"type":name,"physicalized":True,"source":blob[:160]}
    return {"type":"scale_imbalance","physicalized":True,"source":blob[:160]}

def curve_for_character(cid):
    return "elastic_goblin" if cid=="cashback_goblin" else "deadpan" if cid=="points_monk" else "comedic_pop"

def build_choreography(scene):
    duration=max(.1,float(scene.get("end",0))-float(scene.get("start",0)))
    reference=scene.get("reference_mechanics") or {}
    ref_prop=str(reference.get("prop_action","")).lower()
    ref_char=str(reference.get("character_action","")).lower()
    ref_intensity=max(0.0,min(1.0,float(reference.get("motion_intensity",0) or 0)*8))
    ref_flow_direction=str(reference.get("flow_direction","stable"))
    ref_flow_speed=max(0.0,float(reference.get("flow_speed",0) or 0))
    ref_structure=reference.get("structure") or {}
    object_actions=[]
    for i,p in enumerate(scene.get("props",[])):
        pid=p.get("id","prop")
        family=OBJECT_BEHAVIORS.get(pid,["pop_in","overshoot","settle"])
        object_actions.append({
          "target":pid,
          "entry":family[i%len(family)],
          "action":family[(i+1)%len(family)],
          "exit":family[(i+2)%len(family)],
          "start":round(min(duration*.12+i*.08,duration*.35),3),
          "impact":round(min(duration*.55+i*.06,duration*.82),3),
          "secondary_motion":True,
          "curve":"heavy_drop" if any(x in pid for x in ["fee","calculator"]) else "comedic_pop",
          "reference_action":ref_prop,
          "intensity":round(max(.45,ref_intensity),3)
        })
    character_actions=[]
    for i,ch in enumerate(scene.get("characters",[])):
        cid=ch.get("id","dave")
        character_actions.append({
          "target":cid,"pose":ch.get("pose","recoil"),
          "anticipation_frames":4 if cid!="points_monk" else 2,
          "overshoot_frames":5,"settle_frames":7,
          "eye_target":(scene.get("props") or [{}])[0].get("id","camera"),
          "curve":curve_for_character(cid),
          "reference_action":ref_char,
          "intensity":round(max(.5,ref_intensity),3)
        })
    text=scene.get("text") or {}
    text_actions=[]
    if text.get("content"):
        text_density=float(ref_structure.get("text_region_count",0) or 0)
        preferred=["type","highlight","track_subject"] if text_density>1.2 else TEXT_MOTIONS
        motion=preferred[abs(hash(text.get("content")))%len(preferred)]
        text_actions.append({
          "content":text.get("content"),"zone":text.get("zone","upper_third"),
          "motion":motion,"entry_frame":2,"emphasis":"numeric" if re.search(r"[$%\d]",text.get("content","")) else "keyword",
          "interaction_target":(scene.get("props") or [{}])[0].get("id"),
          "design":text.get("design",{}),
          "exit":"impact_cut"
        })
    overlays=[]
    if scene.get("props"):
        overlays.append({"type":"tracked_callout","target":scene["props"][0].get("id"),"purpose":"attention_direction","opacity":.88,"max_frames":36})
    cam=(scene.get("camera") or {}).get("move","tracking")
    camera_events=[{"type":cam,"start_frame":0,"impact_frame":max(1,round(duration*24*.55)),"micro_shake":bool(object_actions),"parallax":True,"reference_direction":ref_flow_direction,"reference_speed":round(ref_flow_speed,5)}]
    contacts=[]
    if scene.get("characters") and scene.get("props"):
        contacts.append({"actor":scene["characters"][0].get("id"),"target":scene["props"][0].get("id"),"type":"grab_or_block","contact_frame":max(3,round(duration*24*.45)),"release_frame":max(5,round(duration*24*.72)),"ik":True})
    return {
      "object_actions":object_actions,
      "character_actions":character_actions,
      "text_actions":text_actions,
      "overlays":overlays,
      "camera_events":camera_events,
      "transition_in":{"type":"match_cut" if ref_structure.get("transition") else TRANSITIONS[int(float(scene.get("start",0))*10)%len(TRANSITIONS)],"frames":6},
      "transition_out":{"type":"prop_collision" if int(ref_structure.get("contact_count",0) or 0)>0 else TRANSITIONS[(int(float(scene.get("start",0))*10)+3)%len(TRANSITIONS)],"frames":6},
      "contact_events":contacts,
      "physics":{"enabled":True,"gravity":980,"restitution":.42,"drag":.08,"spring":170,"damping":18},
      "animation_curves":CURVES,
      "visual_gags":[{"type":"reaction_or_prop_misbehavior","frame":max(4,round(duration*24*.7)),"silent":True}],
      "depth_layers":[{"id":"foreground","z":3,"parallax":1.25},{"id":"midground","z":2,"parallax":1.0},{"id":"background","z":1,"parallax":.55}],
      "visual_metaphor":metaphor_for(scene),
      "reference_transfer":{"character_action":ref_char,"prop_action":ref_prop,"motion_intensity":round(ref_intensity,3),"flow_direction":ref_flow_direction,"flow_speed":round(ref_flow_speed,5),"structure":ref_structure,"retention_reason":reference.get("retention_reason","")},
      "continuous_motion":{"required":True,"minimum_sources":2},
      "publication_enabled":False
    }

def apply(ccsd):
    out=json.loads(json.dumps(ccsd))
    for scene in out.get("scenes",[]):
        scene["choreography"]=build_choreography(scene)
    out["publication_enabled"]=False
    return out

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    result=apply(json.loads(Path(a.ccsd).read_text()))
    Path(a.out).write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":"PASS","scenes":len(result.get("scenes",[]))}))

if __name__=="__main__":main()
