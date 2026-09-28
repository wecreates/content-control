#!/usr/bin/env python3
import argparse,json,struct,subprocess
from pathlib import Path

def sh(cmd):
    p=subprocess.run(cmd,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=False)
    if p.returncode!=0:
        raise RuntimeError(p.stderr)
    return p.stdout

def atoms(path):
    data=Path(path).read_bytes()
    out=[]; i=0; n=len(data)
    while i+8<=n:
        size=struct.unpack(">I",data[i:i+4])[0]
        typ=data[i+4:i+8].decode("latin1","replace")
        hdr=8
        if size==1:
            if i+16>n: break
            size=struct.unpack(">Q",data[i+8:i+16])[0]
            hdr=16
        elif size==0:
            size=n-i
        if size<hdr or i+size>n: break
        out.append({"type":typ,"offset":i,"size":size})
        i+=size
    return out

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--video",required=True)
    ap.add_argument("--output",required=True)
    a=ap.parse_args()
    p=Path(a.video)
    probe=json.loads(sh([
        "ffprobe","-v","error","-show_streams","-show_format","-of","json",str(p)
    ]))
    vs=next((x for x in probe["streams"] if x.get("codec_type")=="video"),{})
    au=next((x for x in probe["streams"] if x.get("codec_type")=="audio"),{})
    fps_expr=vs.get("avg_frame_rate") or "0/1"
    num,den=[float(x) for x in fps_expr.split("/")]
    fps=num/den if den else 0.0
    ats=atoms(p)
    order={x["type"]:x["offset"] for x in ats}
    checks={
      "video_codec_h264":vs.get("codec_name")=="h264",
      "pixel_format_yuv420p":vs.get("pix_fmt")=="yuv420p",
      "resolution_720x1280":int(vs.get("width",0))==720 and int(vs.get("height",0))==1280,
      "fps_24":abs(fps-24.0)<0.01,
      "audio_codec_aac":au.get("codec_name")=="aac",
      "audio_48khz":int(au.get("sample_rate",0))==48000,
      "stereo_audio":int(au.get("channels",0))==2,
      "mp4_container":"mp4" in (probe.get("format",{}).get("format_name") or ""),
      "faststart_moov_before_mdat":"moov" in order and "mdat" in order and order["moov"]<order["mdat"],
    }
    report={
      "schema_version":1,
      "status":"PASS" if all(checks.values()) else "FAIL",
      "checks":checks,
      "failed_checks":[k for k,v in checks.items() if not v],
      "video":{"codec":vs.get("codec_name"),"profile":vs.get("profile"),"pix_fmt":vs.get("pix_fmt"),"width":vs.get("width"),"height":vs.get("height"),"fps":fps},
      "audio":{"codec":au.get("codec_name"),"sample_rate":au.get("sample_rate"),"channels":au.get("channels"),"channel_layout":au.get("channel_layout")},
      "atoms":ats[:12],
      "publication_enabled":False,
    }
    Path(a.output).write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    print(json.dumps(report,sort_keys=True))
    raise SystemExit(0 if report["status"]=="PASS" else 2)
if __name__=="__main__":
    main()
