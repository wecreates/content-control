#!/usr/bin/env python3
import json,sys
from pathlib import Path

src=Path(sys.argv[1] if len(sys.argv)>1 else "state/narration-transcription-health.json")
out=Path(sys.argv[2] if len(sys.argv)>2 else "public-review/episode1-v10-free.vtt")
d=json.loads(src.read_text())
assert d.get("status")=="PASS"
segments=d.get("segments",[])
assert segments

def ts(x):
    ms=round(float(x)*1000)
    h,rem=divmod(ms,3600000)
    m,rem=divmod(rem,60000)
    s,ms=divmod(rem,1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"

lines=["WEBVTT",""]
prev=0.0
for i,s in enumerate(segments,1):
    start=float(s["start"]); end=float(s["end"]); text=" ".join(str(s["text"]).split())
    assert start>=prev-0.05,(i,start,prev)
    assert end>start,(i,start,end)
    assert text,(i,text)
    lines += [str(i),f"{ts(start)} --> {ts(end)}",text,""]
    prev=end
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text("\n".join(lines),encoding="utf-8")
print(json.dumps({"status":"PASS","segments":len(segments),"end_seconds":prev,"output":str(out)},sort_keys=True))
