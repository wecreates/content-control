#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def build(ccsd,original):
    by_id={s.get("id"):s for s in ccsd.get("scenes",[])}
    out=json.loads(json.dumps(original))
    for i,s in enumerate(out.get("scenes",[])):
        sid=f"scene-{s.get('index',i):03d}"
        c=by_id.get(sid)
        if not c: continue
        cam=c.get("camera") or {};chars=c.get("characters") or [];audio=c.get("audio") or {}
        if chars:
            ch=chars[0];s["character"]=ch.get("id",s.get("character"));s["pose"]=ch.get("motion_clip",ch.get("pose",s.get("pose")));s["facial_performance"]=ch.get("face_track");s["acting"]=ch.get("acting");s["characters"]=chars
        s["camera"]=cam.get("move",s.get("camera"));s["shot_scale"]=cam.get("shot_scale",s.get("shot_scale"))
        s["lighting"]=c.get("lighting");s["fx"]=c.get("fx",[]);s["simulation"]=c.get("simulation");s["editorial"]=c.get("editorial")
        s["audio_design"]={"sfx":audio.get("sfx",[]),"music":audio.get("music",{}),"room_tone":audio.get("room_tone")}
        s["color_script"]=c.get("color_script");s["crowd"]=c.get("crowd");s["environment"]=c.get("environment");s["composition"]=c.get("composition",{});s["choreography"]=c.get("choreography",{});s["longform"]=c.get("longform",{})
    out["studio_processed"]=True;out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--scene-plan",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=build(json.loads(Path(a.ccsd).read_text()),json.loads(Path(a.scene_plan).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","scenes":len(r.get("scenes",[]))}))
if __name__=="__main__":main()
