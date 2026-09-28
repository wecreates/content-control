#!/usr/bin/env python3
import argparse,json
from pathlib import Path

def collect_takes(specs):
    takes=[]
    for provider,report_path,audio_path in specs:
        p=Path(report_path)
        if not p.exists():
            continue
        r=json.loads(p.read_text())
        r["provider"]=provider
        r["path"]=str(audio_path)
        r.setdefault("duration_error_ratio",0)
        takes.append(r)
    return {"schema_version":1,"takes":takes,"publication_enabled":False}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--cartesia-report")
    ap.add_argument("--cartesia-audio")
    ap.add_argument("--eleven-report")
    ap.add_argument("--eleven-audio")
    ap.add_argument("--out",required=True)
    a=ap.parse_args()
    specs=[]
    if a.cartesia_report and a.cartesia_audio:
        specs.append(("cartesia",a.cartesia_report,a.cartesia_audio))
    if a.eleven_report and a.eleven_audio:
        specs.append(("elevenlabs",a.eleven_report,a.eleven_audio))
    r=collect_takes(specs)
    Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":"PASS","takes":len(r["takes"])},sort_keys=True))

if __name__=="__main__":
    main()
