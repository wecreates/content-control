#!/usr/bin/env python3
import argparse,html,json
from pathlib import Path
def svg_for(s):
    title=html.escape(str((s.get("story") or {}).get("beat","scene")))
    chars=", ".join(html.escape(str(x.get("id"))) for x in s.get("characters",[])) or "none"
    prop=", ".join(html.escape(str(x.get("id"))) for x in s.get("props",[])) or "none"
    cam=s.get("camera") or {}
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
<rect width="720" height="1280" fill="#fff"/><rect x="28" y="28" width="664" height="1224" fill="none" stroke="#111" stroke-width="5"/>
<text x="360" y="95" text-anchor="middle" font-family="Arial" font-weight="700" font-size="36" fill="#111">{title}</text>
<rect x="90" y="220" width="540" height="650" rx="24" fill="#f8f8f8" stroke="#111" stroke-width="4"/>
<text x="360" y="510" text-anchor="middle" font-family="Arial" font-size="30" fill="#111">CHARACTERS: {chars}</text>
<text x="360" y="570" text-anchor="middle" font-family="Arial" font-size="26" fill="#555">PROP: {prop}</text>
<text x="360" y="930" text-anchor="middle" font-family="Arial" font-size="24" fill="#111">{html.escape(str(cam.get("shot_scale","medium")))} • {html.escape(str(cam.get("move","static")))}</text>
<text x="360" y="1160" text-anchor="middle" font-family="Arial" font-size="20" fill="#666">{html.escape(str(s.get("id")))}</text></svg>'''
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out-dir",required=True);ap.add_argument("--manifest",required=True);a=ap.parse_args()
    doc=json.loads(Path(a.ccsd).read_text());out=Path(a.out_dir);out.mkdir(parents=True,exist_ok=True);rows=[]
    for s in doc.get("scenes",[]):
        p=out/f"{s['id']}.svg";p.write_text(svg_for(s));rows.append({"scene_id":s["id"],"file":str(p),"start":s["start"],"end":s["end"]})
    m={"schema_version":1,"status":"PASS" if rows else "FAIL","boards":rows,"publication_enabled":False};Path(a.manifest).write_text(json.dumps(m,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":m["status"],"boards":len(rows)}))
if __name__=="__main__":main()
