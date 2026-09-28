#!/usr/bin/env python3
import argparse,json
from pathlib import Path
ROUTES={"character_identity":"rerender_changed_scene_with_locked_character","timing_parity":"retime_changed_scene_only","camera_parity":"patch_camera_transform_only","audio_sync":"remix_changed_audio_segment","caption_sync":"rebuild_captions_only","layout":"reposition_changed_scene_only","composition":"recompose_changed_scene_only","motion":"increase_choreography_motion_changed_scene_only","overlay":"retime_or_remove_overlay_changed_scene_only","transition":"replace_transition_changed_scene_only","factual":"rewrite_claim_and_rerender_affected_scene"}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--findings",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();f=json.loads(Path(a.findings).read_text());rep=[]
    for item in f.get("findings",f.get("failed_checks",[])):
        key=item if isinstance(item,str) else item.get("dimension","unknown")
        route=next((v for k,v in ROUTES.items() if k in key), "manual_review_or_smallest_scene_patch")
        rep.append({"finding":key,"repair":route})
    r={"schema_version":1,"repairs":rep,"full_rerender_required":False,"publication_enabled":False};Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r,sort_keys=True))
if __name__=="__main__":main()
