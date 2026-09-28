#!/usr/bin/env python3
import argparse,html,json,math
from pathlib import Path

def esc(x): return html.escape(str(x or ""))
def board_svg(s,w=720,h=1280):
    comp=s.get("composition") or {};f=comp.get("focal_point",[.5,.58])
    chars=s.get("characters",[]);props=s.get("props",[]);env=(s.get("environment") or {}).get("id","white_stage")
    cam=s.get("camera") or {};story=s.get("story") or {};txt=(s.get("text") or {}).get("content","")
    parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
      f'<rect width="{w}" height="{h}" fill="#fff"/><rect x="24" y="24" width="{w-48}" height="{h-48}" rx="18" fill="none" stroke="#111" stroke-width="4"/>',
      f'<text x="{w/2}" y="72" text-anchor="middle" font-family="Arial" font-weight="700" font-size="30" fill="#111">{esc(story.get("beat","scene"))}</text>',
      f'<text x="{w/2}" y="108" text-anchor="middle" font-family="Arial" font-size="18" fill="#666">{esc(cam.get("shot_scale","medium"))} • {esc(cam.get("move","static"))} • {esc(env)}</text>']
    # environment shorthand
    floor=int(h*.76);parts.append(f'<line x1="50" y1="{floor}" x2="{w-50}" y2="{floor}" stroke="#bbb" stroke-width="3"/>')
    if env=="bank_counter": parts.append(f'<rect x="{w*.18}" y="{h*.58}" width="{w*.64}" height="{h*.12}" fill="none" stroke="#bbb" stroke-width="4"/>')
    if env=="airport_lounge":
        parts.append(f'<rect x="{w*.12}" y="{h*.55}" width="{w*.24}" height="{h*.13}" rx="22" fill="none" stroke="#bbb" stroke-width="4"/><rect x="{w*.64}" y="{h*.55}" width="{w*.24}" height="{h*.13}" rx="22" fill="none" stroke="#bbb" stroke-width="4"/>')
    cx=w*float(f[0]);cy=h*float(f[1])
    for i,ch in enumerate(chars):
        x=cx+(i-(len(chars)-1)/2)*150;y=cy+120
        parts += [f'<circle cx="{x}" cy="{y-150}" r="40" fill="#fff" stroke="#111" stroke-width="6"/>',
                  f'<line x1="{x}" y1="{y-110}" x2="{x}" y2="{y+30}" stroke="#111" stroke-width="6"/>',
                  f'<line x1="{x}" y1="{y-55}" x2="{x-65}" y2="{y-15}" stroke="#111" stroke-width="6"/>',
                  f'<line x1="{x}" y1="{y-55}" x2="{x+65}" y2="{y-15}" stroke="#111" stroke-width="6"/>',
                  f'<line x1="{x}" y1="{y+30}" x2="{x-50}" y2="{y+120}" stroke="#111" stroke-width="6"/>',
                  f'<line x1="{x}" y1="{y+30}" x2="{x+50}" y2="{y+120}" stroke="#111" stroke-width="6"/>',
                  f'<text x="{x}" y="{y+158}" text-anchor="middle" font-family="Arial" font-size="17" fill="#111">{esc(ch.get("id"))}: {esc(ch.get("pose"))}</text>']
    for i,p in enumerate(props):
        x=w*(.22+.18*i);y=h*.38
        parts += [f'<rect x="{x-55}" y="{y-34}" width="110" height="68" rx="10" fill="#fff" stroke="#111" stroke-width="4"/>',
                  f'<text x="{x}" y="{y+6}" text-anchor="middle" font-family="Arial" font-size="15" fill="#111">{esc(p.get("id"))}</text>']
    if txt: parts.append(f'<text x="{w/2}" y="{h*.19}" text-anchor="middle" font-family="Arial" font-weight="700" font-size="28" fill="#111">{esc(txt)[:42]}</text>')
    ch=s.get("choreography") or {}
    for c in ch.get("contact_events",[]):
        parts.append(f'<text x="{w/2}" y="{h*.87}" text-anchor="middle" font-family="Arial" font-size="16" fill="#EF3E36">CONTACT: {esc(c.get("actor"))} → {esc(c.get("target"))}</text>')
    parts.append(f'<text x="{w/2}" y="{h-54}" text-anchor="middle" font-family="Arial" font-size="16" fill="#666">{esc(s.get("id"))}</text></svg>')
    return "".join(parts)

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out-dir",required=True);ap.add_argument("--manifest",required=True);a=ap.parse_args()
    doc=json.loads(Path(a.ccsd).read_text());out=Path(a.out_dir);out.mkdir(parents=True,exist_ok=True);rows=[]
    for s in doc.get("scenes",[]):
        p=out/f"{s['id']}.svg";p.write_text(board_svg(s));rows.append({"scene_id":s["id"],"file":str(p),"start":s["start"],"end":s["end"],"composition":s.get("composition"),"camera":s.get("camera")})
    r={"schema_version":2,"status":"PASS" if rows else "FAIL","boards":rows,"publication_enabled":False};Path(a.manifest).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"boards":len(rows)}))
if __name__=="__main__":main()
