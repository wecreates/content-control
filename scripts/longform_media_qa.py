#!/usr/bin/env python3
import argparse,json,subprocess
from pathlib import Path
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--video",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    d=json.loads(subprocess.check_output(["ffprobe","-v","error","-show_streams","-show_format","-of","json",a.video],text=True))
    vs=[x for x in d["streams"] if x.get("codec_type")=="video"];au=[x for x in d["streams"] if x.get("codec_type")=="audio"]
    v=vs[0] if vs else {};audio=au[0] if au else {}
    dur=float(d.get("format",{}).get("duration",0) or 0)
    checks={"video_present":bool(vs),"audio_present":bool(au),"h264":v.get("codec_name")=="h264","aac":audio.get("codec_name")=="aac","sixteen_by_nine":v.get("width",0)*9==v.get("height",1)*16,"duration_longform":dur>=300,"publication_disabled":True}
    failed=[k for k,v in checks.items() if not v]
    r={"schema_version":1,"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"duration_seconds":dur,"publication_enabled":False}
    Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r,sort_keys=True));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
